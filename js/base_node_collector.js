import { app } from "../../scripts/app.js";
import { RgthreeBaseNode } from "./base_node.js";
import { getConnectedOutputNodes } from "./utils.js";
export class BaseCollectorNode extends RgthreeBaseNode {
    constructor(title) {
        super(title);
        this.isVirtualNode = true;
        this.addInput("", "*");
        this.addOutput("Output", "*");
    }
    clone() {
        const cloned = super.clone();
        return cloned;
    }
    onConnectionsChange(_type, _slotIndex, _isConnected, link_info, _ioSlot) {
        if (!link_info)
            return;
        this.stabilizeInputsOutputs();
        const connectedNodes = getConnectedOutputNodes(app, this);
        for (const node of connectedNodes) {
            if (node.onConnectionsChainChange) {
                node.onConnectionsChainChange();
            }
        }
    }
    stabilizeInputsOutputs() {
        var _a, _b;
        for (let index = this.inputs.length - 1; index >= 0; index--) {
            const input = this.inputs[index];
            if (!input.link) {
                this.removeInput(index);
            }
        }
        this.addInput('', '*');
        const outputLength = ((_b = (_a = this.outputs[0]) === null || _a === void 0 ? void 0 : _a.links) === null || _b === void 0 ? void 0 : _b.length) || 0;
        if (outputLength > 1) {
            this.outputs[0].links.length = 1;
        }
    }
}
