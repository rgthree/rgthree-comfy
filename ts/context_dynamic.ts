/**
 * @fileoverview this file containst the classes, logic, and initilization of the Dynamic Context nodes, including the
 * Dynamic Context Node, and the Dynamic context Switch.
 *
 * These nodes are in active development.
 *
 * TODOS:
 *   [x] Fast-fix to disallow a context to be added as a regular input to another context.
 *   [ ] (Stretch) Actually handle passing a context down through as a child input.
 *   [x] When a Context is connected to another as a base, the latter context node should append the
 *       ".1" counters.
 *   [x] Renaming a node needs to propagate downstream through a switch
 *   [x] Clear Switch data when cloning.
 *   [x] When an upstream context node is added, move any owned inputs with the same into the
 *       unowned section, preserving their links.
 *   [x] When an upstream context node is removed, if any unowned inputs are currenty linked, do not
 *       remove them, but keep them linked, and make them owned by the current context node.
 *   [x] Also, keep them if they have an output connected at the downstream node that has the
 *       connection.
 *   [ ] If a Switches output is connected, keep it even if no inputs have it (b/c they were removed).
 *   [ ] If keeping nodes with outputs connected that may not have an owned input, alert the user.
 *   [ ] Better handle combo support in weird ComfyUI way, rather than hacking it right now.
 *   [ ] Allow reording of inputs (and, thus, outputs)?
 *   [x] Fix outputs issue in py.
 *   [ ] Make current Context and Context Big nodes compatible with Dynamic Context
 *   [ ] Add option to convert old Context nodes to Dynamic Context nodes.
 *   [ ] Add a Dynamic Context Merger, like a switch, but merges in all data, not passes first None.
 *   [ ] Fix Reroute regression not having a correct type when connecting one-way
 *   [x] Don't allow user to rename delete the "+" input
 */

import type {
  INodeInputSlot,
  INodeOutputSlot,
  LLink,
  LiteGraph as TLiteGraph,
  LGraphNode as TLGraphNode,
  ContextMenuItem,
  Vector2,
  SerializedLGraphNode,
} from "./typings/litegraph.js";
import type {ComfyApp, ComfyNodeConstructor, ComfyObjectInfo} from "./typings/comfy.js";
// @ts-ignore
import {app} from "../../scripts/app.js";
import {
  ConnectionType,
  IoDirection,
  PassThroughFollowing,
  followConnectionUntilType,
  getConnectedInputNodes,
  getConnectedInputNodesAndFilterPassThroughs,
  getConnectedNodesInfo,
  getConnectedOutputNodesAndFilterPassThroughs,
  shouldPassThrough,
} from "./utils.js";
import {rgthree} from "./rgthree.js";

import {BaseContextNode} from "./context.js";

declare const LGraphNode: typeof TLGraphNode;
declare const LiteGraph: typeof TLiteGraph;

/**
 * A base node for the Dynamic Context nodes.
 */
class ContextDynamicNodeBase extends BaseContextNode {
  static readonly logger = rgthree.newLogSession("[Dynamic Context]");

  hasShadowInputs = false;

  getContextInputsList(): {name: string; type: string | -1}[] {
    return this.inputs;
  }

  onConnectionsChainChange(arg: TLGraphNode) {
    console.log("ContextDynamicNodeBase: onConnectionsChainChange", this.id, arg);
  }

  override onNodeCreated() {
    const inputs = this.getContextInputsList();
    if (inputs[inputs.length - 1]!.type === "*") {
      this.removeOutput(inputs.length - 1);
    } else {
      this.addInput("+", "*");
    }
  }

  override getWidgets() {
    return Object.assign({}, super.getWidgets(), {
      DYNAMIC_CONTEXT_OUTPUTS: (
        node: TLGraphNode,
        inputName: string,
        inputData: any,
        app: ComfyApp,
      ) => {
        node.addCustomWidget({
          name: inputName,
          value: "",
          draw(ctx, node, width, posY, height) {
            return;
          },
          computeSize(width) {
            return [0, 0];
          },
          serializeValue() {
            const value = (node.outputs || [])
              .map((o, i) => i > 0 && o.name)
              .filter((n) => n !== false)
              .join(",");
            return value;
          },
        });
      },
    });
  }

  stripOwnedPrefix(name: string) {
    return name.replace(/^\+\s*/, "");
  }

  addOwnedPrefix(name: string) {
    return `+ ${this.stripOwnedPrefix(name)}`;
  }

  isOwnedInput(inputOrName: INodeInputSlot | string | undefined) {
    const name = typeof inputOrName == "string" ? inputOrName : inputOrName?.name || "";
    return name.startsWith("+ ") || name === "+";
  }

  getNextUniqueNameForThisNode(desiredName: string) {
    const inputs = this.getContextInputsList();
    const allExistingKeys = inputs.map((i) => this.stripOwnedPrefix(i.name).toLocaleUpperCase());

    desiredName = this.stripOwnedPrefix(desiredName);
    let newName = desiredName;
    let n = 0;
    while (allExistingKeys.includes(newName.toLocaleUpperCase())) {
      newName = `${desiredName}.${++n}`;
    }
    return newName;
  }

  override onConnectionsChange(
    type: number,
    slotIndex: number,
    isConnected: boolean,
    linkInfo: LLink,
    ioSlot: INodeOutputSlot | INodeInputSlot,
  ) {
    super.onConnectionsChange?.(type, slotIndex, isConnected, linkInfo, ioSlot);
    if (this.configuring) {
      return;
    }
    if (type === LiteGraph.INPUT) {
      if (isConnected) {
        this.handleInputConnected(slotIndex);
      } else {
        this.handleInputDisconnected(slotIndex);
      }
    }
  }

  handleInputConnected(slotIndex: number) {
    // To be implemented.
  }

  handleInputDisconnected(slotIndex: number) {
    // To be implemented.
  }

  updateFromUpstream(
    update: "connect" | "disconnect" | "move" | "update",
    node: ContextDynamicNodeBase,
    updatedSlotData: {index: number; name: string; from?: number},
  ) {
    // To be implemented.
  }

  provideInputsData(): {name: string; type: string; index: number}[] {
    const inputs = this.getContextInputsList() as INodeInputSlot[];
    return inputs
      .map((input, index) => ({
        name: this.stripOwnedPrefix(input.name),
        type: String(input.type),
        index,
      }))
      .filter((i) => i.type !== "*");
  }

  protected updateDownstream(
    update: "connect" | "disconnect" | "move" | "update",
    updatedSlotData: {index: number; name: string; from?: number},
  ) {
    const nodes = getConnectedOutputNodesAndFilterPassThroughs(this, this, 0);
    for (const node of nodes) {
      (node as ContextDynamicNodeBase)?.updateFromUpstream?.(update, this, updatedSlotData);
    }
  }

  addContextInput(name: string, type: string | -1, slot = -1) {
    const inputs = this.getContextInputsList();
    if (this.hasShadowInputs) {
      inputs.push({name, type});
    } else {
      this.addInput(name, type);
    }
    if (slot > -1) {
      inputs.splice(slot, 0, inputs.splice(inputs.length - 1, 1)[0]!);
    } else {
      slot = inputs.length - 1;
    }

    if (type !== "*") {
      // Outputs
      const output = this.addOutput(name.toUpperCase(), type);
      // TODO: This is a hack to get around the absurd restrictions in widgetInput and COMBOS
      if (type === "COMBO" || String(type).includes(",") || Array.isArray(type)) {
        (output as any).widget = true;
      }
      if (slot > -1) {
        this.outputs.splice(slot, 0, this.outputs.splice(this.outputs.length - 1, 1)[0]!);
      }
      this.fixInputsOutputsLinkSlots();
      this.updateDownstream("connect", {index: slot, name});
    }
  }

  removeContextInput(slot: number) {
    if (this.hasShadowInputs) {
      const inputs = this.getContextInputsList();
      const input = inputs.splice(slot, 1)[0]!;
      if (this.outputs[slot]) {
        this.removeOutput(slot);
      }
      this.updateDownstream("disconnect", {index: slot, name: input.name});
      this.fixInputsOutputsLinkSlots();
    } else {
      // Remove Input triggers the disconnect updateDownstream, and fix links, etc.
      this.removeInput(slot);
    }
  }

  moveContextInput(slotFrom: number, slotTo: number|'bottom') {
    const inputs = this.getContextInputsList();
    if (slotTo === 'bottom') {
      slotTo = inputs.length - 1;
    }
    if (slotFrom === slotTo) {
      return;
    }
    let newIndex = slotTo + (slotFrom < slotTo ? -1 : 0);
    const input = inputs.splice(slotFrom, 1)[0]!;
    inputs.splice(newIndex, 0, input);

    this.outputs.splice(newIndex, 0, ...this.outputs.splice(slotFrom, 1));

    this.fixInputsOutputsLinkSlots();
    this.updateDownstream("move", {index: slotTo, from: slotFrom, name: input.name});
  }

  renameContextInput(index: number, newName: string, forceOwnBool: boolean|null = null) {
    // We may rename inputs as part of a upstream update, so allow any input to be renamed.
    // Check if it's "owned" simply if it has the "+" prefix.
    const inputs = this.getContextInputsList();
    const input = inputs[index]!;
    const oldName = input.name;
    newName = this.stripOwnedPrefix(newName.trim() || this.getSlotDefaultInputLabel(index));
    if (forceOwnBool === true || (this.isOwnedInput(oldName) && forceOwnBool !== false)) {
      newName = this.addOwnedPrefix(newName);
    }
    input.name = newName;

    this.outputs[index]!.name = this.stripOwnedPrefix(inputs[index]!.name).toUpperCase();

    this.updateDownstream("update", {index, name: newName});
  }

  /**
   * Goes through the inputs and fixes the links associated with them after moving/removing inputs.
   */
  fixInputsOutputsLinkSlots() {
    if (!this.hasShadowInputs) {
      const inputs = this.inputs;
      for (let index = inputs.length - 1; index > 0; index--) {
        const input = inputs[index];
        if (input?.link != null) {
          app.graph.links[input.link].target_slot = index;
        }
      }
    }
    const outputs = this.outputs;
    for (let index = outputs.length - 1; index > 0; index--) {
      const output = outputs[index];
      for (const link of output?.links || []) {
        app.graph.links[link].origin_slot = index;
      }
    }
  }

  private getSlotDefaultInputLabel(slot: number) {
    const inputs = this.getContextInputsList();
    const input = inputs[slot]!;
    let defaultLabel = this.stripOwnedPrefix(input.name).toLowerCase();
    return defaultLabel.toLocaleLowerCase();
  }

}

/**
 * The Dynamic Context node.
 */
class ContextDynamicNode extends ContextDynamicNodeBase {
  static override title = "Dynamic Context (rgthree)";
  static override type = "Dynamic Context (rgthree)";
  static comfyClass = "Dynamic Context (rgthree)";

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextDynamicNode);
  }

  constructor(title = ContextDynamicNode.title) {
    super(title);
  }

  override clone() {
    const cloned = super.clone();
    while (cloned.inputs.length > 1) {
      cloned.removeInput(cloned.inputs.length - 1);
    }
    cloned.addInput("+", "*");
    return cloned;
  }

  /**
   * Override the "native" removeInput to also remove the corresponing output and update the removal
   * for downstream nodes and fix the links when doing so (because LiteGraph doesn't fix it itself
   * for some reason).
   */
  override removeInput(slot: number): void {
    const input = this.inputs[slot]!;
    super.removeInput(slot);
    if (this.outputs[slot]) {
      this.removeOutput(slot);
    }
    this.fixInputsOutputsLinkSlots();
    this.updateDownstream("disconnect", {index: slot, name: input.name});
    this.stabilizeNames();
  }

  /** Handles an input being connected. */
  override handleInputConnected(slotIndex: number) {
    const inputs = this.getContextInputsList() as INodeInputSlot[];
    const ioSlot = inputs[slotIndex]!;

    if (slotIndex === 0) {
      const baseNodes = getConnectedInputNodesAndFilterPassThroughs(this, this, 0);
      const baseNodesDynamicCtx = baseNodes[0] as ContextDynamicNode | null;
      if (baseNodesDynamicCtx?.provideInputsData) {
        for (const input of baseNodesDynamicCtx.provideInputsData()) {
          const inputs = this.getContextInputsList() as INodeInputSlot[];
          if (input.name === "base_ctx" || input.name === "+") {
            continue;
          }
          // Look ahead and if the same name already exists, then move it up. Otherwise, we'll add.
          const foundIndex = inputs.findIndex(i => this.stripOwnedPrefix(i.name)  === input.name);
          if (foundIndex > -1) {
            this.moveContextInput(foundIndex, input.index);
            this.renameContextInput(input.index, input.name, false);
          } else {
            this.addContextInput(input.name, input.type, input.index);
            this.stabilizeNames();
          }
        }
      }
    } else if (ioSlot.type === "*") {
      // If our type is a "*" and we have a link, then try to find the correct type.
      let cxn: ConnectionType | null = null;
      if (ioSlot.link) {
        cxn = followConnectionUntilType(this, IoDirection.INPUT, slotIndex, true);
      }
      if (cxn?.type) {
        let name = cxn.name!;
        // If we're all uppercase, then make the input lowercase (semi-standard).
        if (name.match(/^(\+\s*)?[A-Z_]+$/)) {
          name = name.toLowerCase();
        }
        name = this.getNextUniqueNameForThisNode(name);
        if (!this.outputs[slotIndex]) {
          this.addOutput("*", "*");
        }
        inputs[slotIndex]!.type = cxn.type as string;
        inputs[slotIndex]!.removable = true;
        this.outputs[slotIndex]!.type = cxn.type as string;
        this.updateDownstream("connect", {index: slotIndex, name: this.stripOwnedPrefix(name)});
        this.renameContextInput(slotIndex, name, true);
        if (cxn.type === "COMBO" || cxn.type.includes(",") || Array.isArray(cxn.type)) {
          // TODO: This is a hack to get around the absurd restrictions in widgetInput and COMBOS
          (this.outputs[slotIndex] as any)!.widget = true;
        }
        this.addInput("+", "*");
      }
    }
  }

  /** Handles an input being disconnected. */
  override handleInputDisconnected(slotIndex: number) {
    const inputs = this.getContextInputsList() as INodeInputSlot[];
    if (slotIndex === 0) {
      // Go through all inputs to find ones unowned (no "+" prefix).
      for (let index = inputs.length - 1; index > 0; index--) {
        if (index === 0 || index === inputs.length - 1) {
          continue;
        }
        const input = inputs[index]!;
        if (!this.isOwnedInput(input.name)) {
          // If it's linked, then keep it and add a "+" otherwise remove it.
          if (input.link || this.outputs[index]?.links?.length) {
            this.renameContextInput(index, input.name, true);
            // TODO: Alert the user there is likely no data here? Maybe prefix with "! " ?
          } else {
            this.removeContextInput(index);
          }
        }
      }
      this.setSize(this.computeSize());
      this.setDirtyCanvas(true, true);
    }
  }


  /** Handles an upstream change. */
  override updateFromUpstream(
    update: "connect" | "disconnect" | "move" | "update",
    node: ContextDynamicNodeBase,
    updatedSlotData: {index: number; name: string; from?: number},
  ) {
    console.log("----- ContextDynamicNode :: updateFromUpstream", arguments);
    const inputs = this.getContextInputsList() as INodeInputSlot[];

    if (update == "connect") {
      const baseInputsData = node.provideInputsData();
      const baseIndex = updatedSlotData.index;
      const baseInputData = baseInputsData[baseIndex]!;
      const name = this.getNextUniqueNameForThisNode(baseInputData.name);
      // this.addContextInput(name, baseInputData.type, baseIndex);

      // Look ahead and if the same name already exists, then move it up. Otherwise, we'll add.
      const foundIndex = inputs.findIndex(i => this.stripOwnedPrefix(i.name)  === baseInputData.name);
      if (foundIndex > -1) {
        this.moveContextInput(foundIndex, baseIndex);
        this.renameContextInput(baseIndex, baseInputData.name, false);
      } else {
        this.addContextInput(baseInputData.name, baseInputData.type, baseInputData.index);
        this.stabilizeNames();
      }

    } else if (update == "disconnect") {
      // Remove the item, unless it's connected, then keep it so to not auto-disconnect.
      if (this.outputs[updatedSlotData.index]?.links?.length) {
        this.renameContextInput(updatedSlotData.index, updatedSlotData.name, true);
        this.moveContextInput(updatedSlotData.index, 'bottom');
        // TODO: Alert the user there is likely no data here? Maybe prefix with "! " ?
      } else {
        this.removeContextInput(updatedSlotData.index);
      }

    } else if (update === "move") {
      this.moveContextInput(updatedSlotData.from!, updatedSlotData.index);
    } else if (update == "update") {
      const baseInputsData = node.provideInputsData();
      const baseIndex = updatedSlotData.index;
      const baseInput = baseInputsData[baseIndex]!;
      this.renameContextInput(baseIndex, baseInput.name);
      this.stabilizeNames();
    }

    this.setSize(this.computeSize());
    this.setDirtyCanvas(true, true);
  }

  private stabilizeNames() {
    const inputs = this.getContextInputsList() as INodeInputSlot[];
    const names: string[] = [];
    for (const [index, input] of inputs.entries()) {
      if (index === 0 || index === inputs.length - 1) {
        continue;
      }
      // Clear labels, for debug at least.
      input.label = undefined;
      this.outputs[index]!.label = undefined;

      let origName = this.stripOwnedPrefix(input.name).replace(/\.\d+$/, "");
      let name = input.name;
      // We can't modify an upstream name, so just add it.
      if (!this.isOwnedInput(name)) {
        names.push(name.toLocaleUpperCase());
      } else {
        let n = 0;
        name = this.addOwnedPrefix(origName);
        while (names.includes(this.stripOwnedPrefix(name).toLocaleUpperCase())) {
          name = `${this.addOwnedPrefix(origName)}.${++n}`;
        }
        names.push(this.stripOwnedPrefix(name).toLocaleUpperCase());
        if (input.name !== name) {
          this.renameContextInput(index, name);
        }
      }
    }
  }

  /**
   * Disallows a dynamic context node being added to a non-zero slot.
   */
  override onConnectInput(
    inputIdx: number,
    outputType: string | -1,
    outputSlot: INodeOutputSlot,
    outputNode: TLGraphNode,
    outputIndex: number,
  ): boolean {
    let canConnect = true;
    if (super.onConnectInput) {
      canConnect = super.onConnectInput(inputIdx, outputType, outputSlot, outputNode, outputIndex);
    }
    if (canConnect && outputNode instanceof ContextDynamicNode && outputIndex === 0 && inputIdx !== 0) {
      ContextDynamicNodeBase.logger.error(
        "Currently, you can only connect a context node in the first slot.",
      );
      canConnect = false;
    }
    return canConnect;
  }

  override getSlotMenuOptions(info: {
    slot: number;
    input?: INodeInputSlot | undefined;
    output?: INodeOutputSlot | undefined;
    link_pos: Vector2;
  }): ContextMenuItem[] {
    const opts: ContextMenuItem[] = [];

    if (info.input) {
      if (this.isOwnedInput(info.input.name) && info.input.type !== '*') {
        opts.push({
          content: "✏️ Rename Input",
          callback: () => {
            var dialog = app.canvas.createDialog(
              "<span class='name'>Name</span><input autofocus type='text'/><button>OK</button>",
              {},
            );
            var dialogInput = dialog.querySelector("input");
            if (dialogInput) {
              dialogInput.value = this.stripOwnedPrefix(info.input!.name || "");
            }
            var inner = () => {
              app.graph.beforeChange();
              this.renameContextInput(info.slot, dialogInput.value);
              this.stabilizeNames();
              this.setDirtyCanvas(true, true);
              dialog.close();
              app.graph.afterChange();
            };
            dialog.querySelector("button").addEventListener("click", inner);
            dialogInput.addEventListener("keydown", (e: KeyboardEvent) => {
              dialog.is_modified = true;
              if (e.keyCode == 27) {
                //ESC
                dialog.close();
              } else if (e.keyCode == 13) {
                inner(); // save
              } else if (e.keyCode != 13 && (e.target as HTMLElement)?.localName != "textarea") {
                return;
              }
              e.preventDefault();
              e.stopPropagation();
            });
            dialogInput.focus();
          },
        });

        opts.push({
          content: "🗑️ Delete Input",
          callback: () => {
            this.removeInput(info.slot);
          },
        });
      }
    }

    return opts;
  }
}

type ShadowInputData = {
  node: TLGraphNode;
  slot: number;
  shadowIndex: number;
  shadowIndexIfShownSingularly: number;
  shadowIndexFull: number;
  nodeIndex: number;
  type: string | -1;
  name: string;
  key: string;
  // isDuplicatedBefore: boolean,
  duplicatesBefore: number[];
  duplicatesAfter: number[];
};

/**
 * The Context Switch Big node.
 */
class ContextDynamicSwitchNode extends ContextDynamicNodeBase {
  static override title = "Dynamic Context Switch (rgthree)";
  static override type = "Dynamic Context Switch (rgthree)";
  static comfyClass = "Dynamic Context Switch (rgthree)";

  override hasShadowInputs = true;

  /**
   * We should be able to assume that `lastInputsList` is the input list after the last, major
   * synchronous change. Which should mean, if we're handling a change that is currently live, but
   * not represented in our node (like, an upstream node has already removed an input), then we
   * should be able to compar the current InputList to this `lastInputsList`.
   */
  lastInputsList: ShadowInputData[] = [];

  private shadowInputs: {name: string; type: string | -1}[] = [
    {name: "base_ctx", type: "DYNAMIC_CONTEXT"},
    {name: "+", type: "*"},
  ];

  constructor(title = ContextDynamicSwitchNode.title) {
    super(title);

    let alerted = false;
    setInterval(() => {
      const plusIndex = this.shadowInputs.findIndex((i) => i.name === "+");
      if (plusIndex === -1) {
        !alerted && console.error("ERROR, no plus in shadow inputs", [...this.shadowInputs]);
        alerted = true;
      } else if (plusIndex !== this.shadowInputs.length - 1) {
        !alerted &&
          console.error("ERROR, plus is not last in shadow inputs", [...this.shadowInputs]);
        alerted = true;
      } else {
        alerted && console.error("BACK TO NOREMAL", [...this.shadowInputs]);
        alerted = false;
      }
    });
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextDynamicSwitchNode);
    // addMenuItem(ContextSwitchBigNode, app, {
    //   name: "Convert To Context Switch",
    //   callback: (node) => {
    //     replaceNode(node, ContextSwitchNode.type);
    //   },
    // });
  }

  override clone() {
    const cloned = super.clone();
    while (cloned.outputs.length > 1) {
      cloned.removeOutput(cloned.outputs.length - 1);
    }
    return cloned;
  }

  override getContextInputsList() {
    return this.shadowInputs;
  }

  override onNodeCreated() {
    // no-op
  }

  /**
   * Disallows the same node to be connected directly to the switch (following passthroughs).
   */
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
    const allConnectedNodes = getConnectedInputNodes(this); // We want passthrough nodes, since they will loop.
    if (canConnect && allConnectedNodes.includes(outputNode)) {
      rgthree.showMessage({
        id: "dynamic-context-looped",
        type: "warn",
        message: "You may not connect the same context node to a switch.",
        timeout: 5000,
      });
      canConnect = false;
    }
    if (canConnect && shouldPassThrough(outputNode, PassThroughFollowing.REROUTE_ONLY)) {
      const connectedNodes = getConnectedInputNodesAndFilterPassThroughs(
        outputNode,
        undefined,
        undefined,
        PassThroughFollowing.REROUTE_ONLY,
      );
      if (connectedNodes.length && allConnectedNodes.find((n) => connectedNodes.includes(n))) {
        rgthree.showMessage({
          id: "dynamic-context-looped",
          type: "warn",
          message: "You may not connect the same context node to a switch, even through a reroute.",
          timeout: 5000,
        });
        canConnect = false;
      }
    }
    return canConnect;
  }

  /** When we're given data to configure, like from a PNG or JSON. */
  override configure(info: SerializedLGraphNode<TLGraphNode>): void {
    super.configure(info);
    // Since we add the widgets dynamically, we need to wait to set their values
    // with a short timeout.
    setTimeout(() => {
      this.shadowInputs = this.getAllShadowInputs();
      this.shadowInputs.push({name: "+", type: "*"});
      this.updateLastInputsList();
      console.log(this.shadowInputs);
    }, 100);
  }

  override moveContextInput(slotFrom: number, slotTo: number) {
    super.moveContextInput(slotFrom, slotTo);
    this.updateLastInputsList();
  }

  override removeContextInput(slot: number) {
    super.removeContextInput(slot);
    this.updateLastInputsList();
  }

  override addContextInput(name: string, type: string | -1, slot = -1) {
    super.addContextInput(name, type, slot);
    this.updateLastInputsList();
  }

  /**
   * Updates the `lastInputsList` to the current.
   */
  private updateLastInputsList() {
    this.lastInputsList = this.getAllInputsList();
  }

  private connectSlotFromUpdateOrInput(data: ShadowInputData) {
    console.log(`connectSlotFromUpdateOrInput: ${data.name}`, data);
    if (data.duplicatesBefore.length) {
      console.log(`[Do Nothing] It has duplicatesBefore (${data.duplicatesBefore.join(",")}).`);
      this.updateLastInputsList();
    } else if (data.duplicatesAfter.length) {
      // If it exists after (and not before too, checked above), then we want to "move" the one
      // from after to the new connected spot.
      const from = this.shadowInputs.findIndex((i) => i.name.toLocaleUpperCase() === data.key);
      console.log(`[Move] Has duplicates after. ${from} -> ${data.shadowIndex}`);
      this.moveContextInput(from, data.shadowIndex);
    } else {
      // We can add.
      console.log(`[Add] No dupes, so we can add it at ${data.shadowIndex}.`);
      this.addContextInput(data.name, data.type, data.shadowIndex);
    }
  }

  override handleInputConnected(slotIndex: number) {
    console.log("--- handleInputConnected", slotIndex);
    // const node = getConnectedInputNodesAndFilterPassThroughs(this, this, slotIndex)?.[0];
    const postInputsList = [...this.getAllInputsList()];
    const node = postInputsList.find((i) => i.slot === slotIndex)?.node;
    if (!node) {
      console.error("hmmm... no node foun to handle connect.");
      return;
    }

    const inputsDataLists = postInputsList.filter((d) => d.slot == slotIndex && d.nodeIndex > 0 && d.type !== '*');
    for (const data of inputsDataLists) {
      this.connectSlotFromUpdateOrInput(data);
    }
  }

  /**
   * Handles when a node has _already been_ disconnected from the passed slotIndex.
   *
   * Since this action occurs after it's been disconnected, then the old `lastInputsList` should be
   * the previous state (where the passed `slotIndex` matches), and a call to `getAllInputsList()`
   * would return the _current_ state.
   */
  override handleInputDisconnected(slotIndex: number) {
    console.log("--- handleInputDisconnected", slotIndex);
    const preInputsList = [...this.lastInputsList];
    const node = preInputsList.find((i) => i.slot === slotIndex)?.node;
    if (!node) {
      console.error("hmmmm... no node found to handle disconnect.");
      return;
    }
    const postInputsList = [...this.getAllInputsList()];
    const inputs = [...this.shadowInputs];
    // Loop over the postInputsList, which is the order we want, and
    console.log("postInputsList", postInputsList);
    let lastIndex = 0;
    for (let [index, data] of postInputsList.entries()) {
      data = this.getAllInputsList()[index]!;
      if (data.shadowIndex === -1 || data.nodeIndex === 0) {
        continue;
      }
      lastIndex++;
      const foundIndex = this.shadowInputs.findIndex(
        (i) => i.name.toLocaleUpperCase() === data.key,
      );
      console.log(data.name, foundIndex, data.shadowIndex);
      if (foundIndex !== data.shadowIndex) {
        this.moveContextInput(foundIndex, data.shadowIndex);
      }
    }
    for (let index = inputs.length - 1; index > lastIndex; index--) {
      const input = this.shadowInputs[index]!;
      if (input.type !== '*') {
        this.removeContextInput(index);
      }
    }
    // this.addContextInput("+", "*");

    console.log([...this.shadowInputs]);
  }

  /** Handles an upstream change. */
  override updateFromUpstream(
    update: "connect" | "disconnect" | "move" | "update",
    node: ContextDynamicNodeBase,
    updatedSlotData: {index: number; name: string; from?: number},
  ) {
    console.log("----- ContextDynamicSwitchNode :: updateFromUpstream", update, updatedSlotData);
    const preInputsList = [...this.lastInputsList];
    const postInputsList = [...this.getAllInputsList()];

    // If the upstream change came from a reroute, then we need to treat it as a direct
    // connect/disconnect.
    if (shouldPassThrough(node)) {
      const connectedNodes = getConnectedNodesInfo(this, IoDirection.INPUT);
      const foundRerouteInfo = connectedNodes.find((n) => n.node === node);
      if (update == "connect") {
        this.handleInputConnected(foundRerouteInfo!.originTravelFromSlot);
      } else if (update == "disconnect") {
        this.handleInputDisconnected(foundRerouteInfo!.originTravelFromSlot);
      } else {
        throw new Error("Unexpected update type from pass through node: " + update);
      }
      return;
    }

    switch (update) {
      case "connect": {
        const data = postInputsList.find((d) => {
          return d.node == node && d.nodeIndex === updatedSlotData.index;
        });
        if (!data) {
          throw new Error("Hmmm.. unfound input slot when connecting upstream.");
        }
        this.connectSlotFromUpdateOrInput(data);
        break;
      }

      case "disconnect":
        const preInputData = preInputsList.find((i) => {
          return i.node === node && i.nodeIndex == updatedSlotData.index;
        });
        if (!preInputData) {
          throw new Error("Hmmm... no matching input found in existing input list for disconnect.");
        }

        if (preInputData.duplicatesBefore.length) {
          console.log(`[Do Nothing] It was already duplicated before.`);
          this.updateLastInputsList();
        } else if (preInputData?.duplicatesAfter?.[0] != null) {
          console.log(`[Move after] Not duplicated before, but is after.`);
          this.moveContextInput(preInputData!.shadowIndex, preInputData.duplicatesAfter[0]!);
        } else {
          console.log(`[Remove] ${preInputData!.shadowIndex}.`, preInputData);
          this.removeContextInput(preInputData!.shadowIndex);
        }
        break;

      case "move":
        // I don't think we need to handle this...
        break;

      case "update":
        const index = postInputsList.findIndex((d) => {
          return d.node == node && d.nodeIndex === updatedSlotData.index;
        });
        // Since we're renaming, nothing is moving, so we can compare the same index from pre and
        // post.
        const pre = preInputsList[index]!;
        const post = postInputsList[index]!;
        console.log("preData", {...pre});
        console.log("postData", {...post});
        if (pre.shadowIndex == -1 && post.shadowIndex !== -1) {
          console.log(`[Add] Old name wasn't shown, but new is.`, post.name, post.shadowIndex);
          // Adding it.
          this.addContextInput(post.name, post.type, post.shadowIndex);
        } else if (pre.shadowIndex !== -1 && post.shadowIndex === -1) {
          console.log(`[Remove] Old name was shown, but new isn;t.`, post.name, post.shadowIndex);
          this.removeContextInput(pre.shadowIndex);
        } else if (post.shadowIndex > -1) {
          console.log(`[Rename] It's shown and has a new name.`, post.name, post.shadowIndex);
          this.renameContextInput(post.shadowIndex, post.name);
        } else {
          console.log(`[Do Nothing] It's shown and has a new name.`, post.name, post.shadowIndex);
          this.updateLastInputsList();
        }
        break;
    }
    console.log(this.shadowInputs);
  }

  /**
   * Gets a list of ALL connected nodes input data, in order, and marking which are duplicates.
   *
   * The indexToNodeOverride is a map that can override a specific slot; say to see what the list
   * would look like if a slot had a different (or no) node. Useful when a node has been removed
   * from the input list, but we may want to get the list as if it were still connected.
   */
  private getAllInputsList(indexToNodeOverride: {[index: number]: TLGraphNode | false} = {}) {
    const allConnectedInputsDataByName: {[key: string]: ShadowInputData[]} = {};
    const allConnectedInputsData: ShadowInputData[] = [];
    let currentShadowIndex = 0;
    for (const [slot, input] of (this.inputs || []).entries()) {
      const connectedNode =
        indexToNodeOverride[slot] ??
        getConnectedInputNodesAndFilterPassThroughs(this, this, slot)?.[0];
      if (connectedNode) {
        for (const inputData of (connectedNode as ContextDynamicNode).provideInputsData()) {
          const key = inputData.name.toLocaleUpperCase();
          allConnectedInputsDataByName[key] = allConnectedInputsDataByName[key] || [];
          const existings = allConnectedInputsDataByName[key]!;
          let data = {
            node: connectedNode,
            slot,
            shadowIndexFull: allConnectedInputsData.length,
            shadowIndex: !existings.length ? currentShadowIndex : -1,
            // If we were to add this, despite being a dup, what would it's shadow index be. This is
            // useful when we're trying to move to this spot.
            shadowIndexIfShownSingularly: currentShadowIndex,
            nodeIndex: inputData.index,
            type: inputData.type,
            name: inputData.name,
            key,
            duplicatesBefore: allConnectedInputsDataByName[key]!.map((d) => d.shadowIndexFull),
            duplicatesAfter: [],
          };
          // If we're adding to the shadowIndex, then increment it.
          if (data.shadowIndex > -1) {
            currentShadowIndex++;
          }
          for (const existing of existings) {
            existing.duplicatesAfter.push(data.shadowIndexFull);
          }
          allConnectedInputsData.push(data);
          allConnectedInputsDataByName[key]?.push(data);
        }
      }
    }
    // No, go through the currentS
    return allConnectedInputsData;
  }

  private getAllShadowInputs() {
    const inputsDataMap: {[key: string]: {name: string; type: string; index: number}} = {
      BASE_CTX: {name: "base_ctx", type: "DYNAMIC_CONTEXT", index: 0},
    };
    const baseNodes = getConnectedInputNodesAndFilterPassThroughs(this, this);
    for (const inputNode of baseNodes) {
      for (const inputData of (inputNode as ContextDynamicNode).provideInputsData()) {
        const dataKey = inputData.name.toLocaleUpperCase();
        const existingData = inputsDataMap[dataKey];
        if (!existingData) {
          inputsDataMap[dataKey] = inputData;
        } else if (existingData.name !== inputData.name) {
          throw new Error(
            `Conflicting data for ${dataKey}. ${existingData.name} !== ${inputData.name}`,
          );
        } else if (existingData.type !== inputData.type) {
          throw new Error(
            `Conflicting data for ${dataKey}. ${existingData.type} !== ${inputData.type}`,
          );
        }
      }
    }
    return Object.values(inputsDataMap).map((v, index) => Object.assign({...v}, {index}));
  }
}

const contextDynamicNodes = [ContextDynamicNode, ContextDynamicSwitchNode];

app.registerExtension({
  name: "rgthree.ContextDynamic",
  async beforeRegisterNodeDef(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    for (const ctxClass of contextDynamicNodes) {
      if (nodeData.name === ctxClass.type) {
        console.log(nodeData.name);
        ctxClass.nodeData = nodeData;
        ctxClass.nodeType = nodeType;
        ctxClass.setUp(nodeType as any);
        break;
      }
    }
  },
});
