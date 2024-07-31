import type { RgthreeBaseVirtualNodeConstructor } from "typings/rgthree.js";
import type {
  Vector2,
  LLink,
  INodeInputSlot,
  INodeOutputSlot,
  LGraphNode as TLGraphNode,
  IWidget,
} from "typings/litegraph.js";

import { app } from "scripts/app.js";
import { RgthreeBaseVirtualNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";

import {
  PassThroughFollowing,
  addConnectionLayoutSupport,
  addMenuItem,
  getConnectedInputNodes,
  getConnectedInputNodesAndFilterPassThroughs,
  getConnectedOutputNodes,
  getConnectedOutputNodesAndFilterPassThroughs,
} from "./utils.js";

/**
 * A Virtual Node that allows any node's output to connect to it.
 */
export class BaseAnyInputConnectedNode extends RgthreeBaseVirtualNode {
  override isVirtualNode = true;

  /**
   * Whether inputs show the immediate nodes, or follow and show connected nodes through
   * passthrough nodes.
   */
  readonly inputsPassThroughFollowing: PassThroughFollowing = PassThroughFollowing.NONE;

  debouncerTempWidth: number = 0;
  schedulePromise: Promise<void> | null = null;

  constructor(title = BaseAnyInputConnectedNode.title) {
    super(title);
  }

  override onConstructed() {
    this.addInput("", "*");
    return super.onConstructed();
  }

  /** Schedules a promise to run a stabilization. */
  scheduleStabilizeWidgets(ms = 100) {
    if (!this.schedulePromise) {
      this.schedulePromise = new Promise((resolve) => {
        setTimeout(() => {
          this.schedulePromise = null;
          this.doStablization();
          resolve();
        }, ms);
      });
    }
    return this.schedulePromise;
  }

  override clone() {
    const cloned = super.clone();
    // Copying to clipboard (and also, creating node templates) work by cloning nodes and, for some
    // reason, it manually manipulates the cloned data. So, we want to keep the present input slots
    // so if it's pasted/templatized the data is correct. Otherwise, clear the inputs and so the new
    // node is ready to go, fresh.
    if (!rgthree.canvasCurrentlyCopyingToClipboardWithMultipleNodes) {
      while (cloned.inputs.length > 1) {
        cloned.removeInput(cloned.inputs.length - 1);
      }
      if (cloned.inputs[0]) {
        cloned.inputs[0].label = "";
      }
    }
    return cloned;
  }
  /**
   * Ensures we have at least one empty input at the end.
   */
  stabilizeInputsOutputs() {
    const hasEmptyInput = !this.inputs[this.inputs.length - 1]?.link;
    if (!hasEmptyInput) {
      this.addInput("", "*");
    }
    for (let index = this.inputs.length - 2; index >= 0; index--) {
      const input = this.inputs[index]!;
      if (!input.link) {
        this.removeInput(index);
      } else {
        const node = getConnectedInputNodesAndFilterPassThroughs(
          this,
          this,
          index,
          this.inputsPassThroughFollowing,
        )[0];
        input.name = node?.title || "";
      }
    }
  }

  /**
   * Stabilizes the node's inputs and widgets.
   */
  private doStablization() {
    if (!this.graph) {
      return;
    }
    // When we add/remove widgets, litegraph is going to mess up the size, so we
    // store it so we can retrieve it in computeSize. Hacky..
    (this as any)._tempWidth = this.size[0];

    const linkedNodes = getConnectedInputNodesAndFilterPassThroughs(this);
    this.stabilizeInputsOutputs();

    this.handleLinkedNodesStabilization(linkedNodes);

    app.graph.setDirtyCanvas(true, true);

    // Schedule another stabilization in the future.
    this.scheduleStabilizeWidgets(500);
  }

  handleLinkedNodesStabilization(linkedNodes: TLGraphNode[]) {
    linkedNodes; // No-op, but makes overridding in VSCode cleaner.
    throw new Error("handleLinkedNodesStabilization should be overridden.");
  }

  onConnectionsChainChange() {
    this.scheduleStabilizeWidgets();
  }

  override onConnectionsChange(
    type: number,
    index: number,
    connected: boolean,
    linkInfo: LLink,
    ioSlot: INodeOutputSlot | INodeInputSlot,
  ) {
    super.onConnectionsChange &&
      super.onConnectionsChange(type, index, connected, linkInfo, ioSlot);
    if (!linkInfo) return;
    // Follow outputs to see if we need to trigger an onConnectionChange.
    const connectedNodes = getConnectedOutputNodesAndFilterPassThroughs(this);
    for (const node of connectedNodes) {
      if ((node as BaseAnyInputConnectedNode).onConnectionsChainChange) {
        (node as BaseAnyInputConnectedNode).onConnectionsChainChange();
      }
    }
    this.scheduleStabilizeWidgets();
  }

  override removeInput(slot: number) {
    (this as any)._tempWidth = this.size[0];
    return super.removeInput(slot);
  }

  override addInput(name: string, type: string | -1, extra_info?: Partial<INodeInputSlot>) {
    (this as any)._tempWidth = this.size[0];
    return super.addInput(name, type, extra_info);
  }

  override addWidget<T extends IWidget>(
    type: T["type"],
    name: string,
    value: T["value"],
    callback?: T["callback"] | string,
    options?: T["options"],
  ) {
    (this as any)._tempWidth = this.size[0];
    return super.addWidget(type, name, value, callback, options);
  }

  /**
   * Guess this doesn't exist in Litegraph...
   */
  override removeWidget(widgetOrSlot?: IWidget | number) {
    (this as any)._tempWidth = this.size[0];
    super.removeWidget(widgetOrSlot);
  }

  override computeSize(out: Vector2) {
    let size = super.computeSize(out);
    if ((this as any)._tempWidth) {
      size[0] = (this as any)._tempWidth;
      // We sometimes get repeated calls to compute size, so debounce before clearing.
      this.debouncerTempWidth && clearTimeout(this.debouncerTempWidth);
      this.debouncerTempWidth = setTimeout(() => {
        (this as any)._tempWidth = null;
      }, 32);
    }
    // If we're collapsed, then subtract the total calculated height of the other input slots.
    if (this.properties["collapse_connections"]) {
      const rows = Math.max(this.inputs?.length || 0, this.outputs?.length || 0, 1) - 1;
      size[1] = size[1] - rows * LiteGraph.NODE_SLOT_HEIGHT;
    }
    setTimeout(() => {
      app.graph.setDirtyCanvas(true, true);
    }, 16);
    return size;
  }

  /**
   * When we connect our output, check our inputs and make sure we're not trying to connect a loop.
   */
  override onConnectOutput(
    outputIndex: number,
    inputType: string | -1,
    inputSlot: INodeInputSlot,
    inputNode: TLGraphNode,
    inputIndex: number,
  ): boolean {
    let canConnect = true;
    if (super.onConnectOutput) {
      canConnect = super.onConnectOutput(outputIndex, inputType, inputSlot, inputNode, inputIndex);
    }
    if (canConnect) {
      const nodes = getConnectedInputNodes(this); // We want passthrough nodes, since they will loop.
      if (nodes.includes(inputNode)) {
        alert(
          `Whoa, whoa, whoa. You've just tried to create a connection that loops back on itself, ` +
            `a situation that could create a time paradox, the results of which could cause a ` +
            `chain reaction that would unravel the very fabric of the space time continuum, ` +
            `and destroy the entire universe!`,
        );
        canConnect = false;
      }
    }
    return canConnect;
  }

  override onConnectInput(
    inputIndex: number,
    outputType: string | -1,
    outputSlot: INodeOutputSlot,
    outputNode: TLGraphNode,
    outputIndex: number,
  ): boolean {
    let canConnect = true;
    if (super.onConnectInput) {
      canConnect = super.onConnectInput(
        inputIndex,
        outputType,
        outputSlot,
        outputNode,
        outputIndex,
      );
    }
    if (canConnect) {
      const nodes = getConnectedOutputNodes(this); // We want passthrough nodes, since they will loop.
      if (nodes.includes(outputNode)) {
        alert(
          `Whoa, whoa, whoa. You've just tried to create a connection that loops back on itself, ` +
            `a situation that could create a time paradox, the results of which could cause a ` +
            `chain reaction that would unravel the very fabric of the space time continuum, ` +
            `and destroy the entire universe!`,
        );
        canConnect = false;
      }
    }
    return canConnect;
  }

  /**
   * If something is dropped on us, just add it to the bottom. onConnectInput should already cancel
   * if it's disallowed.
   */
  override connectByTypeOutput<T = any>(
    slot: string | number,
    sourceNode: TLGraphNode,
    sourceSlotType: string,
    optsIn: string,
  ): T | null {
    const lastInput = this.inputs[this.inputs.length - 1];
    if (!lastInput?.link && lastInput?.type === "*") {
      var sourceSlot = sourceNode.findOutputSlotByType(sourceSlotType, false, true);
      return sourceNode.connect(sourceSlot, this, slot);
    }
    return super.connectByTypeOutput(slot, sourceNode, sourceSlotType, optsIn);
  }

  static override setUp() {
    super.setUp();
    addConnectionLayoutSupport(this, app, [
      ["Left", "Right"],
      ["Right", "Left"],
    ]);
    addMenuItem(this, app, {
      name: (node) =>
        `${node.properties?.["collapse_connections"] ? "Show" : "Collapse"} Connections`,
      property: "collapse_connections",
      prepareValue: (_value, node) => !node.properties?.["collapse_connections"],
      callback: (_node) => {
        app.graph.setDirtyCanvas(true, true);
      },
    });
  }
}

// Ok, hack time! LGraphNode's connectByType is powerful, but for our nodes, that have multiple "*"
// input types, it seems it just takes the first one, and disconnects it. I'd rather we don't do
// that and instead take the next free one. If that doesn't work, then we'll give it to the old
// method.
const oldLGraphNodeConnectByType = LGraphNode.prototype.connectByType;
LGraphNode.prototype.connectByType = function connectByType<T = any>(
  slot: string | number,
  sourceNode: TLGraphNode,
  sourceSlotType: string,
  optsIn: string,
): T | null {
  // If we're droppiong on a node, and the last input is free and an "*" type, then connect there
  // first...
  if (sourceNode.inputs) {
    for (const [index, input] of sourceNode.inputs.entries()) {
      if (!input.link && input.type === "*") {
        this.connect(slot, sourceNode, index);
        return null;
      }
    }
  }
  return ((oldLGraphNodeConnectByType &&
    oldLGraphNodeConnectByType.call(this, slot, sourceNode, sourceSlotType, optsIn)) ||
    null) as T;
};
