// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
import { RgthreeBaseNode } from "./base_node.js";
import type {Vector2, LLink, INodeInputSlot, INodeOutputSlot, LGraphNode as TLGraphNode, LiteGraph as TLiteGraph, IWidget} from './typings/litegraph.js';
import { addConnectionLayoutSupport, addMenuItem, getConnectedInputNodes} from "./utils.js";

declare const LiteGraph: typeof TLiteGraph;

/**
 * A Virtual Node that allows any node's output to connect to it.
 */
export class BaseAnyInputConnectedNode extends RgthreeBaseNode {

  override isVirtualNode = true;

  debouncerTempWidth: number = 0;
  schedulePromise: Promise<void> | null = null;

  constructor(title = BaseAnyInputConnectedNode.title) {
    super(title);

    this.addInput("", "*");
  }

  /** Schedules a promise to run a stabilization. */
  scheduleStabilizeWidgets(ms = 100) {
    if (!this.schedulePromise) {
      this.schedulePromise = new Promise((resolve) => {
        setTimeout(() => {
          this.schedulePromise = null
          this.doStablization();
          resolve();
        }, ms);
      });
    }
    return this.schedulePromise;
  }

  /**
   * Ensures we have at least one empty input at the end.
   */
  private stabilizeInputsOutputs() {
    let hasEmptyInput = false;
    for (let index = this.inputs.length - 1; index >= 0; index--) {
      const input = this.inputs[index]!;
      if (!input.link) {
        if (index < this.inputs.length - 1) {
          this.removeInput(index);
        } else {
          hasEmptyInput = true;
        }
      }
    }
    !hasEmptyInput && this.addInput('', '*');
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

    const linkedNodes = getConnectedInputNodes(app, this);
    this.stabilizeInputsOutputs();

    this.handleLinkedNodesStabilization(linkedNodes);

    app.graph.setDirtyCanvas(true, true);

    // Schedule another stabilization in the future.
    this.scheduleStabilizeWidgets(500);
  }

  handleLinkedNodesStabilization(linkedNodes: TLGraphNode[]) {
    linkedNodes; // No-op, but makes overridding in VSCode cleaner.
    throw new Error('handleLinkedNodesStabilization should be overridden.');
  }

  onConnectionsChainChange() {
    this.scheduleStabilizeWidgets();
  }

  override onConnectionsChange(type: number, index: number, connected: boolean, linkInfo: LLink, ioSlot: (INodeOutputSlot | INodeInputSlot)) {
    super.onConnectionsChange && super.onConnectionsChange(type, index, connected, linkInfo, ioSlot);
    this.scheduleStabilizeWidgets();
  }

  override removeInput(slot: number) {
    (this as any)._tempWidth = this.size[0];
    return super.removeInput(slot);
  }

  override addInput(name: string, type: string|-1, extra_info?: Partial<INodeInputSlot>) {
    (this as any)._tempWidth = this.size[0];
    return super.addInput(name, type, extra_info);
  }

  override addWidget<T extends IWidget>(type: T["type"], name: string, value: T["value"], callback?: T["callback"] | string, options?: T["options"]) {
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
    if (this.properties['collapse_connections']) {
      const rows = Math.max(this.inputs?.length || 0, this.outputs?.length || 0, 1) - 1;
      size[1] = size[1] - (rows * LiteGraph.NODE_SLOT_HEIGHT);
    }
    setTimeout(() => {
      app.graph.setDirtyCanvas(true, true);
    }, 16);
    return size;
  }

  static setUp<T extends BaseAnyInputConnectedNode>(clazz: new(...args: any[]) => T) {
    // @ts-ignore: Fix incorrect litegraph typings.
    addConnectionLayoutSupport(clazz, app, [['Left', 'Right'],['Right', 'Left']]);

    // @ts-ignore: Fix incorrect litegraph typings.
    addMenuItem(clazz, app, {
      name: (node) => (`${node.properties?.['collapse_connections'] ? 'Show' : 'Collapse'} Connections`),
      property: 'collapse_connections',
      prepareValue: (_value, node) => !node.properties?.['collapse_connections'],
      callback: (_node) => {app.graph.setDirtyCanvas(true, true)}
    });


    LiteGraph.registerNodeType((clazz as any).type, clazz);
    (clazz as any).category = (clazz as any)._category;
  }
}


