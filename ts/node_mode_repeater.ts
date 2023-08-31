// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
import type {LiteGraph as TLiteGraph,} from './typings/litegraph.js';
import { addConnectionLayoutSupport, addHelp, doChainLookup} from "./utils.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";
// @ts-ignore
import { BaseCollectorNode } from './base_node_collector.js';
import { NodeMode } from "./typings/comfy.js";

declare const LiteGraph: typeof TLiteGraph;

/** Legacy "Combiner" */
class NodeModeRepeater extends BaseCollectorNode {

  static override type = "Node Mode Repeater (rgthree)";
  static override title = "Node Mode Repeater (rgthree)";

  static help = [
    `Connect other nodes\' outputs to this Node Mode Repeater and all connected nodes`,
    `will update their mode (mute/bypass/active) when this node's mode changes.`,
    `\n\nOptionally, connect this mode's output to a Fast Muter or Fast Bypasser for a single toggle`,
    `to then quickly mute or bypass this node and all its connected nodes.`
  ].join(' ');

  mode_: NodeMode;

  /** When a mode change, we want all connected nodes to match. */
  onModeChange() {
    const linkedNodes = doChainLookup(app, this, this);
    for (const node of linkedNodes) {
      node.mode = this.mode;
    }
  }

  // @ts-ignore - Changing the property to an accessor here seems to work, but ts compiler complains.
  override set mode(mode: NodeMode) {
    if (this.mode_ != mode) {
      this.mode_ = mode;
      this.onModeChange();
    }

  }
  override get mode() {
    return this.mode_;
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