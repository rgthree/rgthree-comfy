import { app } from "../../scripts/app.js";
import { PassThroughFollowing, addConnectionLayoutSupport, getConnectedInputNodesAndFilterPassThroughs, getConnectedOutputNodesAndFilterPassThroughs, } from "./utils.js";
import { wait } from "../../rgthree/common/shared_utils.js";
import { BaseCollectorNode } from "./base_node_collector.js";
import { NodeTypesString, stripRgthree } from "./constants.js";
import { fitString } from "./utils_canvas.js";
const MODE_ALWAYS = 0;
const MODE_MUTE = 2;
const MODE_BYPASS = 4;
const MODE_REPEATS = [MODE_MUTE, MODE_BYPASS];
const MODE_IGNORE = -99;
const MODE_TO_OPTION = new Map([
    [MODE_ALWAYS, 'ACTIVE'],
    [MODE_MUTE, 'MUTE'],
    [MODE_BYPASS, 'BYPASS'],
    [MODE_IGNORE, 'IGNORE'],
]);
const OPTION_TO_MODE = new Map([
    ['ACTIVE', MODE_ALWAYS],
    ['MUTE', MODE_MUTE],
    ['BYPASS', MODE_BYPASS],
    ['IGNORE', MODE_IGNORE],
]);
const MODE_TO_PROPERTY = new Map([
    [MODE_MUTE, 'on_muted_inputs'],
    [MODE_BYPASS, 'on_bypassed_inputs'],
    [MODE_ALWAYS, 'on_any_active_inputs'],
]);
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
        this.properties['on_muted_inputs'] = 'MUTE';
        this.properties['on_bypassed_inputs'] = 'BYPASS';
        this.properties['on_any_active_inputs'] = 'ACTIVE';
    }
    onDrawForeground(ctx, canvas) {
        var _a;
        if ((_a = this.flags) === null || _a === void 0 ? void 0 : _a.collapsed) {
            return;
        }
        if (this.properties['on_muted_inputs'] !== 'MUTE' ||
            this.properties['on_bypassed_inputs'] !== 'BYPASS' ||
            this.properties['on_any_active_inputs'] != 'ACTIVE') {
            let margin = 15;
            ctx.textAlign = "left";
            let label = `*(MUTE > ${this.properties['on_muted_inputs']},  `;
            label += `BYPASS > ${this.properties['on_bypassed_inputs']},  `;
            label += `ACTIVE > ${this.properties['on_any_active_inputs']})`;
            ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
            const oldFont = ctx.font;
            ctx.font = "italic " + (LiteGraph.NODE_SUBTEXT_SIZE - 2) + "px Arial";
            ctx.fillText(fitString(ctx, label, this.size[0] - 20), 15, this.size[1] - 6);
            ctx.font = oldFont;
        }
    }
    computeSize(out) {
        let size = super.computeSize(out);
        if (this.properties['on_muted_inputs'] !== 'MUTE' ||
            this.properties['on_bypassed_inputs'] !== 'BYPASS' ||
            this.properties['on_any_active_inputs'] != 'ACTIVE') {
            size[1] += 17;
        }
        return size;
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
        var _a, _b;
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
            const propertyVal = (_a = this.properties) === null || _a === void 0 ? void 0 : _a[MODE_TO_PROPERTY.get(mode) || ''];
            const newMode = OPTION_TO_MODE.get(propertyVal);
            mode = (newMode !== null ? newMode : mode);
            if (mode !== null && mode !== MODE_IGNORE) {
                if ((_b = this.outputs) === null || _b === void 0 ? void 0 : _b.length) {
                    const outputNodes = getConnectedOutputNodesAndFilterPassThroughs(this);
                    for (const outputNode of outputNodes) {
                        outputNode.mode = mode;
                        wait(16).then(() => {
                            outputNode.setDirtyCanvas(true, true);
                        });
                    }
                }
            }
        }
        setTimeout(() => {
            this.stabilize();
        }, 500);
    }
    getHelp() {
        return `
      <p>
        This node will relay its input nodes' modes (Mute, Bypass, or Active) to a connected
        ${stripRgthree(NodeTypesString.NODE_MODE_REPEATER)} (which would then repeat that mode
        change to all of its inputs).
      </p>
      <ul>
          <li><p>
            When all connected input nodes are muted, the relay will set a connected repeater to
            mute (by default).
          </p></li>
          <li><p>
            When all connected input nodes are bypassed, the relay will set a connected repeater to
            bypass (by default).
          </p></li>
          <li><p>
            When any connected input nodes are active, the relay will set a connected repeater to
            active (by default).
          </p></li>
      </ul>
      <p>
        Note, you can change which signals get sent on the above in the <code>Properties</code>.
        For instance, you could configure an inverse relay which will send a MUTE when any of its
        inputs are active (instead of sending an ACTIVE signal), and send an ACTIVE signal when all
        of its inputs are muted (instead of sending a MUTE signal), etc.
      </p>
    `;
    }
}
NodeModeRelay.type = NodeTypesString.NODE_MODE_RELAY;
NodeModeRelay.title = NodeTypesString.NODE_MODE_RELAY;
NodeModeRelay["@on_muted_inputs"] = {
    type: "combo",
    values: ["MUTE", "ACTIVE", "BYPASS", "NOTHING"],
};
NodeModeRelay["@on_bypassed_inputs"] = {
    type: "combo",
    values: ["BYPASS", "ACTIVE", "MUTE", "NOTHING"],
};
NodeModeRelay["@on_any_active_inputs"] = {
    type: "combo",
    values: ["BYPASS", "ACTIVE", "MUTE", "NOTHING"],
};
app.registerExtension({
    name: "rgthree.NodeModeRepeaterHelper",
    registerCustomNodes() {
        addConnectionLayoutSupport(NodeModeRelay, app, [
            ["Left", "Right"],
            ["Right", "Left"],
        ]);
        LiteGraph.registerNodeType(NodeModeRelay.type, NodeModeRelay);
        NodeModeRelay.category = NodeModeRelay._category;
    },
});
