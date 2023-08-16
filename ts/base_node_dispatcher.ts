// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
import type {Vector2, LLink, LGraph, INodeInputSlot, INodeOutputSlot, LGraphNode as TLGraphNode, LiteGraph as TLiteGraph, IWidget} from './typings/litegraph.js';
import { addConnectionLayoutSupport, addMenuItem } from "./utils.js";

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;

export class BaseNodeDispatcher extends LGraphNode {

  static override title = "__NEED_NAME__";
  // `category` seems to get reset at register, so we'll
  // re-reset it after the register call. ¯\_(ツ)_/¯
  static category = 'rgthree';
  static _category = 'rgthree';
  static collapsible = false;
  debouncer: number = 0;
  schedulePromise: Promise<void> | null = null;
  isVirtualNode = true;

  constructor(title = BaseNodeDispatcher.title) {
    if (title == '__NEED_NAME__') {
      throw new Error('BaseNodeDispatcher needs overrides.');
    }
    super(title);
    this.properties = this.properties || {};
    this.connections = [];
    this.addInput("", "*");
  }

  private doChainLookup(startNode: TLGraphNode = this) {
    let rootNodes: TLGraphNode[] = [];
    const slotsToRemove = [];
    const type = (startNode.constructor as typeof TLGraphNode).type;
    if (startNode === this || type?.includes('Reroute') || type?.includes('Combiner')) {
      const removeDups = startNode === this;
      for (const input of startNode.inputs) {
        const linkId: number | null = input!.link;
        if (!linkId) {
          continue;
        }
        const link: LLink = (app.graph as LGraph).links[linkId]!;
        const originNode: TLGraphNode = (app.graph as LGraph).getNodeById(link.origin_id)!;
        const originNodeType = (originNode.constructor as typeof TLGraphNode).type;
        if (originNodeType?.includes('Reroute') || originNodeType?.includes('Combiner')) {
          for (const foundNode of this.doChainLookup(originNode)) {
            if (!rootNodes.includes(foundNode)) {
              rootNodes.push(foundNode);
            }
          }
        } else if (rootNodes.includes(originNode)) {
          removeDups && (slotsToRemove.push(link.target_slot))
        } else {
          rootNodes.push(originNode);
        }
      }
      for (const slot of slotsToRemove) {
        this.disconnectInput(slot);
      }
    }
    return rootNodes;
  }

  scheduleRefreshWidgets() {
    if (!this.schedulePromise) {
      this.schedulePromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve(this.refreshWidgets());
          this.schedulePromise = null;
        }, 100);
      });
    }
    return this.schedulePromise;
  }

  refreshWidgets() {
    const linkedNodes = this.doChainLookup();
    this.stabilizeInputsOutputs();
    for (const [index, node] of linkedNodes.entries()) {
      let widget = this.widgets && this.widgets[index];
      if (!widget) {
        // When we add a widget, litegraph is going to mess up the size, so we
        // store it so we can retrieve it in computeSize. Hacky..
        (this as any)._tempWidth = this.size[0];
        widget = this.addWidget('toggle', '', false, '', {"on": 'yes', "off": 'no'});
      }
      this.setWidget(widget, node);
    }
    if (this.widgets && this.widgets.length > linkedNodes.length) {
      // When we remove widgets, litegraph is going to mess up the size, so we
      // store it so we can retrieve it in computeSize. Hacky..
      (this as any)._tempWidth = this.size[0];
      this.widgets.length = linkedNodes.length
    }
    app.graph.setDirtyCanvas(true, true);
  }

  setWidget(_widget: IWidget, _linkedNode: TLGraphNode) {
    throw new Error('setWidget should be overridden');
  }

  onConnectionsChainChange() {
    this.scheduleRefreshWidgets();
  }

  override onConnectionsChange(_type: number, _index: number, _connected: boolean, _linkInfo: LLink, _ioSlot: (INodeOutputSlot | INodeInputSlot)) {
    this.scheduleRefreshWidgets();
  }

  override removeInput(slot: number) {
    (this as any)._tempWidth = this.size[0];
    return super.removeInput(slot);
  }
  override addInput(name: string, type: string|-1, extra_info?: Partial<INodeInputSlot>) {
    (this as any)._tempWidth = this.size[0];
    return super.addInput(name, type, extra_info);
  }

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

  override computeSize(out: Vector2) {
    let size = super.computeSize(out);
    if ((this as any)._tempWidth) {
        size[0] = (this as any)._tempWidth;
        (this as any)._tempWidth = null;
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

  static setUp<T extends BaseNodeDispatcher>(clazz: new(...args: any[]) => T) {
    // @ts-ignore: Fix incorrect litegraph typings.
    addMenuItem(clazz, app, {
      name: 'Refresh',
      callback: (node) => {(node as T).scheduleRefreshWidgets()}
    });

    // @ts-ignore: Fix incorrect litegraph typings.
    addMenuItem(clazz, app, {
      name: (node) => (`${node.properties?.['collapse_connections'] ? 'Show' : 'Collapse'} Connections`),
      property: 'collapse_connections',
      prepareValue: (_value, node) => !node.properties?.['collapse_connections'],
      callback: (_node) => {app.graph.setDirtyCanvas(true, true)}
    });

    // @ts-ignore: Fix incorrect litegraph typings.
    addConnectionLayoutSupport(clazz, app, [['Left'],['Right']]);

    LiteGraph.registerNodeType((clazz as any).title, clazz);
    (clazz as any).category = (clazz as any)._category;
  }
}


