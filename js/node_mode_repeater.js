import { app } from "../../scripts/app.js";
import { BaseCollectorNode } from './base_node_collector.js';
import { NodeTypesString, stripRgthree } from "./constants.js";
import { addConnectionLayoutSupport, addHelp, getConnectedInputNodes, getConnectedOutputNodes } from "./utils.js";
class NodeModeRepeater extends BaseCollectorNode {
    constructor(title) {
        super(title);
        this.removeOutput(0);
        this.addOutput('FAST_TOGGLER', '_FAST_TOGGLER_', {
            color_on: '#Fc0',
            color_off: '#a80',
            shape: LiteGraph.ARROW_SHAPE,
        });
    }
    onConnectOutput(outputIndex, inputType, inputSlot, inputNode, inputIndex) {
        var _a, _b;
        let canConnect = true;
        if (super.onConnectOutput) {
            canConnect = (_a = super.onConnectOutput) === null || _a === void 0 ? void 0 : _a.call(this, outputIndex, inputType, inputSlot, inputNode, inputIndex);
        }
        let nextNode = (_b = getConnectedOutputNodes(app, this, inputNode)[0]) !== null && _b !== void 0 ? _b : inputNode;
        return canConnect && (nextNode.type === NodeTypesString.FAST_MUTER || nextNode.type === NodeTypesString.FAST_BYPASSER);
    }
    onConnectionsChange(type, slotIndex, isConnected, linkInfo, ioSlot) {
        super.onConnectionsChange(type, slotIndex, isConnected, linkInfo, ioSlot);
        if (type === LiteGraph.INPUT && isConnected) {
            const connectedNode = this.getInputNode(slotIndex);
            if ((connectedNode === null || connectedNode === void 0 ? void 0 : connectedNode.type) === NodeTypesString.NODE_MODE_RELAY) {
                const input = this.inputs[slotIndex];
                if (input) {
                    input.color_on = '#FC0';
                    input.color_off = '#a80';
                }
            }
        }
    }
    onModeChange() {
        super.onModeChange();
        const linkedNodes = getConnectedInputNodes(app, this);
        for (const node of linkedNodes) {
            if (node.type !== NodeTypesString.NODE_MODE_RELAY) {
                node.mode = this.mode;
            }
        }
    }
}
NodeModeRepeater.type = NodeTypesString.NODE_MODE_REPEATER;
NodeModeRepeater.title = NodeTypesString.NODE_MODE_REPEATER;
NodeModeRepeater.help = [
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
app.registerExtension({
    name: "rgthree.NodeModeRepeater",
    registerCustomNodes() {
        addHelp(NodeModeRepeater, app);
        addConnectionLayoutSupport(NodeModeRepeater, app, [['Left', 'Right'], ['Right', 'Left']]);
        LiteGraph.registerNodeType(NodeModeRepeater.type, NodeModeRepeater);
        NodeModeRepeater.category = NodeModeRepeater._category;
    },
});
