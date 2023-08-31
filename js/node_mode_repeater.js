import { app } from "../../scripts/app.js";
import { addConnectionLayoutSupport, addHelp, doChainLookup } from "./utils.js";
import { BaseCollectorNode } from './base_node_collector.js';
class NodeModeRepeater extends BaseCollectorNode {
    onModeChange() {
        const linkedNodes = doChainLookup(app, this, this);
        for (const node of linkedNodes) {
            node.mode = this.mode;
        }
    }
    set mode(mode) {
        if (this.mode_ != mode) {
            this.mode_ = mode;
            this.onModeChange();
        }
    }
    get mode() {
        return this.mode_;
    }
}
NodeModeRepeater.type = "Node Mode Repeater (rgthree)";
NodeModeRepeater.title = "Node Mode Repeater (rgthree)";
NodeModeRepeater.help = [
    `Connect other nodes\' outputs to this Node Mode Repeater and all connected nodes`,
    `will update their mode (mute/bypass/active) when this node's mode changes.`,
    `\n\nOptionally, connect this mode's output to a Fast Muter or Fast Bypasser for a single toggle`,
    `to then quickly mute or bypass this node and all its connected nodes.`
].join(' ');
app.registerExtension({
    name: "rgthree.NodeModeRepeater",
    registerCustomNodes() {
        addHelp(NodeModeRepeater, app);
        addConnectionLayoutSupport(NodeModeRepeater, app, [['Left', 'Right'], ['Right', 'Left']]);
        LiteGraph.registerNodeType(NodeModeRepeater.type, NodeModeRepeater);
        NodeModeRepeater.category = NodeModeRepeater._category;
    },
});
