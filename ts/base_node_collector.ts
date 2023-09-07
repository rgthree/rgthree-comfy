// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
import type {LLink, LGraph, INodeInputSlot, INodeOutputSlot, LGraphNode} from './typings/litegraph.js';
import { RgthreeBaseNode } from "./base_node.js";
import { getConnectedOutputNodes } from "./utils.js";
import { BaseAnyInputConnectedNode } from "./base_any_input_connected_node.js";

/**
 * Base collector node that monitors changing inputs and outputs.
 */
export class BaseCollectorNode extends RgthreeBaseNode {

  override isVirtualNode = true;

  constructor(title?: string) {
    super(title);
    this.addInput("", "*");
    this.addOutput("Output", "*");
  }

  override clone() {
    const cloned = super.clone();
    return cloned;
  }

  override onConnectionsChange(_type: number, _slotIndex: number, _isConnected: boolean, link_info: LLink, _ioSlot: (INodeOutputSlot | INodeInputSlot)) {
    if (!link_info) return;
    this.stabilizeInputsOutputs();

    // Follow outputs to see if we need to trigger an onConnectionChange.
    const connectedNodes = getConnectedOutputNodes(app, this);
    for (const node of connectedNodes) {
      if ((node as BaseAnyInputConnectedNode).onConnectionsChainChange) {
        (node as BaseAnyInputConnectedNode).onConnectionsChainChange();
      }
    }
  }

  private stabilizeInputsOutputs() {
    for (let index = this.inputs.length - 1; index >= 0; index--) {
      const input = this.inputs[index]!;
      if (!input.link) {
        this.removeInput(index);
      }
    }
    this.addInput('', '*');

    const outputLength = this.outputs[0]?.links?.length || 0;
    if (outputLength > 1) {
      this.outputs[0]!.links!.length = 1;
    }
  }
}