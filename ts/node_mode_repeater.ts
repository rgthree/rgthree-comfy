// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";
// @ts-ignore
import { BaseCollectorNode } from './base_node_collector.js';
import { NodeTypesString, stripRgthree } from "./constants.js";

import type {INodeInputSlot, INodeOutputSlot, LGraphNode, LLink, LiteGraph as TLiteGraph,} from './typings/litegraph.js';
import { addConnectionLayoutSupport, addHelp, getConnectedInputNodes, getConnectedOutputNodes} from "./utils.js";

declare const LiteGraph: typeof TLiteGraph;


class NodeModeRepeater extends BaseCollectorNode {

  static override type = NodeTypesString.NODE_MODE_REPEATER;
  static override title = NodeTypesString.NODE_MODE_REPEATER;

  static help = [
    `When this node's mode (Mute, Bypass, Active) changes, it will "repeat" that mode to all`,
    `connected input nodes.`,
    `\n`,
    `\n- Optionally, connect this mode's output to a ${stripRgthree(NodeTypesString.FAST_MUTER)}`,
    `or ${stripRgthree(NodeTypesString.FAST_BYPASSER)} for a single toggle to quickly`,
    `mute/bypass all its connected nodes.`,
    `\n- Optionally, connect a ${stripRgthree(NodeTypesString.NODE_MODE_RELAY)} to this nodes'`,
    `inputs to have it automatically toggle its mode. If connected, this will always take`,
    `precedence`,
  ].join(' ');

  constructor(title?: string) {
    super(title);
    this.removeOutput(0);
    this.addOutput('FAST_TOGGLER', '_FAST_TOGGLER_', {
      color_on: '#Fc0',
      color_off: '#a80',
      shape: LiteGraph.ARROW_SHAPE,
    });
  }

  override onConnectOutput(outputIndex: number, inputType: string | -1, inputSlot: INodeInputSlot, inputNode: LGraphNode, inputIndex: number): boolean {
    let canConnect = true;
    if (super.onConnectOutput) {
      canConnect = super.onConnectOutput?.(outputIndex, inputType, inputSlot, inputNode, inputIndex);
    }
    // Output can only connect to a FAST MUTER or FAST BYPASSER
    let nextNode = getConnectedOutputNodes(app, this, inputNode)[0] ?? inputNode;
    return canConnect && (nextNode.type === NodeTypesString.FAST_MUTER || nextNode.type === NodeTypesString.FAST_BYPASSER);
  }

  override onConnectionsChange(type: number, slotIndex: number, isConnected: boolean, linkInfo: LLink, ioSlot: INodeOutputSlot | INodeInputSlot): void {
    super.onConnectionsChange(type, slotIndex, isConnected, linkInfo, ioSlot);
    // If we've added an input, let's see if it's a relay and change our shape and color.
    if (type === LiteGraph.INPUT && isConnected) {
      const connectedNode = this.getInputNode(slotIndex);
      if (connectedNode?.type === NodeTypesString.NODE_MODE_RELAY) {
        const input = this.inputs[slotIndex]
        if (input) {
          input.color_on = '#FC0';
          input.color_off = '#a80';
        }
      }
    }
  }

  /** When a mode change, we want all connected nodes to match except for connected relays. */
  override onModeChange() {
    super.onModeChange();
    const linkedNodes = getConnectedInputNodes(app, this);
    for (const node of linkedNodes) {
      if (node.type !== NodeTypesString.NODE_MODE_RELAY) {
        node.mode = this.mode;
      }
    }
  }
}


app.registerExtension({
	name: "rgthree.NodeModeRepeater",
	registerCustomNodes() {

    addHelp(NodeModeRepeater, app);
    addConnectionLayoutSupport(NodeModeRepeater, app, [['Left','Right'],['Right','Left']]);

		LiteGraph.registerNodeType(NodeModeRepeater.type, NodeModeRepeater);
    NodeModeRepeater.category = NodeModeRepeater._category;
	},
});