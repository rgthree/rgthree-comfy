import { app } from "../../scripts/app.js";
import { PassThroughFollowing, addConnectionLayoutSupport, addHelp, getConnectedInputNodesAndFilterPassThroughs, getConnectedOutputNodesAndFilterPassThroughs, } from "./utils.js";
import { wait } from "./shared_utils.js";
import { BaseCollectorNode } from "./base_node_collector.js";
import { NodeTypesString, stripRgthree } from "./constants.js";
const MODE_ALWAYS = 0;
const MODE_MUTE = 2;
const MODE_BYPASS = 4;
const MODE_REPEATS = [MODE_MUTE, MODE_BYPASS];
class NodeModeRelay extends BaseCollectorNode {
    constructor(title) {
        super(title);
        this.inputsPassThroughFollowing = PassThroughFollowing.ALL;
        setTimeout(() => {
            this.stabilize();
        }, 500);
        this.removeOutput(0);
        this.addOutput("REPEATER", "_NODE_REPEATER_", {
            color_on: "#Fc0",
            color_off: "#a80",
            shape: LiteGraph.ARROW_SHAPE,
        });
    }
    onConnectOutput(outputIndex, inputType, inputSlot, inputNode, inputIndex) {
        var _a, _b;
        let canConnect = (_a = super.onConnectOutput) === null || _a === void 0 ? void 0 : _a.call(this, outputIndex, inputType, inputSlot, inputNode, inputIndex);
        let nextNode = (_b = getConnectedOutputNodesAndFilterPassThroughs(this, inputNode)[0]) !== null && _b !== void 0 ? _b : inputNode;
        return canConnect && nextNode.type === NodeTypesString.NODE_MODE_REPEATER;
    }
    onConnectionsChange(type, slotIndex, isConnected, link_info, ioSlot) {
        super.onConnectionsChange(type, slotIndex, isConnected, link_info, ioSlot);
        setTimeout(() => {
            this.stabilize();
        }, 500);
    }
    stabilize() {
        var _a;
        if (!this.graph || !this.isAnyOutputConnected() || !this.isInputConnected(0)) {
            return;
        }
        const inputNodes = getConnectedInputNodesAndFilterPassThroughs(this, this, -1, this.inputsPassThroughFollowing);
        let mode = undefined;
        for (const inputNode of inputNodes) {
            if (mode === undefined) {
                mode = inputNode.mode;
            }
            else if (mode === inputNode.mode && MODE_REPEATS.includes(mode)) {
                continue;
            }
            else if (inputNode.mode === MODE_ALWAYS || mode === MODE_ALWAYS) {
                mode = MODE_ALWAYS;
            }
            else {
                mode = null;
            }
        }
        if (mode != null) {
            if ((_a = this.outputs) === null || _a === void 0 ? void 0 : _a.length) {
                const outputNodes = getConnectedOutputNodesAndFilterPassThroughs(this);
                for (const outputNode of outputNodes) {
                    outputNode.mode = mode;
                    wait(16).then(() => {
                        outputNode.setDirtyCanvas(true, true);
                    });
                }
            }
        }
        setTimeout(() => {
            this.stabilize();
        }, 500);
    }
}
NodeModeRelay.type = NodeTypesString.NODE_MODE_RELAY;
NodeModeRelay.title = NodeTypesString.NODE_MODE_RELAY;
NodeModeRelay.help = [
    `This node will relay its input nodes' modes (Mute, Bypass, or Active) to a connected`,
    `${stripRgthree(NodeTypesString.NODE_MODE_REPEATER)} (which would then repeat that mode change to all of its inputs).`,
    `\n`,
    `\n- When all connected input nodes are muted, the relay will set a connected repeater to mute.`,
    `\n- When all connected input nodes are bypassed, the relay will set a connected repeater to bypass.`,
    `\n- When any connected input nodes are active, the relay will set a connected repeater to active.`,
].join(" ");
app.registerExtension({
    name: "rgthree.NodeModeRepeaterHelper",
    registerCustomNodes() {
        addConnectionLayoutSupport(NodeModeRelay, app, [
            ["Left", "Right"],
            ["Right", "Left"],
        ]);
        addHelp(NodeModeRelay, app);
        LiteGraph.registerNodeType(NodeModeRelay.type, NodeModeRelay);
        NodeModeRelay.category = NodeModeRelay._category;
    },
});
