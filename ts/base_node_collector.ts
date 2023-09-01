// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";

import type {LLink, LGraph, INodeInputSlot, INodeOutputSlot, LGraphNode as TLGraphNode} from './typings/litegraph.js';
import { RgthreeBaseNode } from "./base_node.js";

declare const LGraphNode: typeof TLGraphNode;

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

  private updateOutputLinks(startNode: TLGraphNode = this) {
    const type = (startNode.constructor as typeof TLGraphNode).type;
    // @ts-ignore
    if (startNode.onConnectionsChainChange) {
      // @ts-ignore
      startNode.onConnectionsChainChange();
    }
    if (startNode === this || type?.includes('Reroute') || type?.includes('Combiner')) {
      for (const output of startNode.outputs) {
        if (!output.links || !output.links.length) continue;
        for (const linkId of output.links) {
          const link: LLink = (app.graph as LGraph).links[linkId]!;
          if (!link) continue;
          const targetNode: TLGraphNode = (app.graph as LGraph).getNodeById(link.target_id)!;
          targetNode && this.updateOutputLinks(targetNode)
        }
      }
    }
  }

  override onConnectionsChange(_type: number, _slotIndex: number, _isConnected: boolean, link_info: LLink, _ioSlot: (INodeOutputSlot | INodeInputSlot)) {
    if (!link_info) return;
    this.stabilizeInputsOutputs();
    // Follow outputs to see if we need to trigger an onConnectionChange.
    this.updateOutputLinks();
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