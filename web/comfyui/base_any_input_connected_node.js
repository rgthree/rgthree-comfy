import { app } from "../../scripts/app.js";
import { RgthreeBaseVirtualNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
import { PassThroughFollowing, addConnectionLayoutSupport, addMenuItem, getConnectedInputNodes, getConnectedInputNodesAndFilterPassThroughs, getConnectedOutputNodes, getConnectedOutputNodesAndFilterPassThroughs } from "./utils.js";
export class BaseAnyInputConnectedNode extends RgthreeBaseVirtualNode {
    constructor(title = BaseAnyInputConnectedNode.title) {
        super(title);
        this.isVirtualNode = true;
        this.inputsPassThroughFollowing = PassThroughFollowing.NONE;
        this.debouncerTempWidth = 0;
        this.schedulePromise = null;
    }
    onConstructed() {
        this.addInput("", "*");
        return super.onConstructed();
    }
    scheduleStabilizeWidgets(ms = 100) {
        if (!this.schedulePromise) {
            this.schedulePromise = new Promise((resolve) => {
                setTimeout(() => {
                    this.schedulePromise = null;
                    this.doStablization();
                    resolve();
                }, ms);
            });
        }
        return this.schedulePromise;
    }
    clone() {
        const cloned = super.clone();
        if (!rgthree.canvasCurrentlyCopyingToClipboardWithMultipleNodes) {
            while (cloned.inputs.length > 1) {
                cloned.removeInput(cloned.inputs.length - 1);
            }
            if (cloned.inputs[0]) {
                cloned.inputs[0].label = '';
            }
        }
        return cloned;
    }
    stabilizeInputsOutputs() {
        var _a;
        const hasEmptyInput = !((_a = this.inputs[this.inputs.length - 1]) === null || _a === void 0 ? void 0 : _a.link);
        if (!hasEmptyInput) {
            this.addInput("", "*");
        }
        for (let index = this.inputs.length - 2; index >= 0; index--) {
            const input = this.inputs[index];
            if (!input.link) {
                this.removeInput(index);
            }
            else {
                const node = getConnectedInputNodesAndFilterPassThroughs(this, this, index, this.inputsPassThroughFollowing)[0];
                input.name = (node === null || node === void 0 ? void 0 : node.title) || '';
            }
        }
    }
    doStablization() {
        if (!this.graph) {
            return;
        }
        this._tempWidth = this.size[0];
        const linkedNodes = getConnectedInputNodesAndFilterPassThroughs(this);
        this.stabilizeInputsOutputs();
        this.handleLinkedNodesStabilization(linkedNodes);
        app.graph.setDirtyCanvas(true, true);
        this.scheduleStabilizeWidgets(500);
    }
    handleLinkedNodesStabilization(linkedNodes) {
        linkedNodes;
        throw new Error('handleLinkedNodesStabilization should be overridden.');
    }
    onConnectionsChainChange() {
        this.scheduleStabilizeWidgets();
    }
    onConnectionsChange(type, index, connected, linkInfo, ioSlot) {
        super.onConnectionsChange && super.onConnectionsChange(type, index, connected, linkInfo, ioSlot);
        if (!linkInfo)
            return;
        const connectedNodes = getConnectedOutputNodesAndFilterPassThroughs(this);
        for (const node of connectedNodes) {
            if (node.onConnectionsChainChange) {
                node.onConnectionsChainChange();
            }
        }
        this.scheduleStabilizeWidgets();
    }
    removeInput(slot) {
        this._tempWidth = this.size[0];
        return super.removeInput(slot);
    }
    addInput(name, type, extra_info) {
        this._tempWidth = this.size[0];
        return super.addInput(name, type, extra_info);
    }
    addWidget(type, name, value, callback, options) {
        this._tempWidth = this.size[0];
        return super.addWidget(type, name, value, callback, options);
    }
    removeWidget(widgetOrSlot) {
        this._tempWidth = this.size[0];
        super.removeWidget(widgetOrSlot);
    }
    computeSize(out) {
        var _a, _b;
        let size = super.computeSize(out);
        if (this._tempWidth) {
            size[0] = this._tempWidth;
            this.debouncerTempWidth && clearTimeout(this.debouncerTempWidth);
            this.debouncerTempWidth = setTimeout(() => {
                this._tempWidth = null;
            }, 32);
        }
        if (this.properties['collapse_connections']) {
            const rows = Math.max(((_a = this.inputs) === null || _a === void 0 ? void 0 : _a.length) || 0, ((_b = this.outputs) === null || _b === void 0 ? void 0 : _b.length) || 0, 1) - 1;
            size[1] = size[1] - (rows * LiteGraph.NODE_SLOT_HEIGHT);
        }
        setTimeout(() => {
            app.graph.setDirtyCanvas(true, true);
        }, 16);
        return size;
    }
    onConnectOutput(outputIndex, inputType, inputSlot, inputNode, inputIndex) {
        let canConnect = true;
        if (super.onConnectOutput) {
            canConnect = super.onConnectOutput(outputIndex, inputType, inputSlot, inputNode, inputIndex);
        }
        if (canConnect) {
            const nodes = getConnectedInputNodes(this);
            if (nodes.includes(inputNode)) {
                alert(`Whoa, whoa, whoa. You've just tried to create a connection that loops back on itself, `
                    + `an situation that could create a time paradox, the results of which could cause a `
                    + `chain reaction that would unravel the very fabric of the space time continuum, `
                    + `and destroy the entire universe!`);
                canConnect = false;
            }
        }
        return canConnect;
    }
    onConnectInput(inputIndex, outputType, outputSlot, outputNode, outputIndex) {
        let canConnect = true;
        if (super.onConnectInput) {
            canConnect = super.onConnectInput(inputIndex, outputType, outputSlot, outputNode, outputIndex);
        }
        if (canConnect) {
            const nodes = getConnectedOutputNodes(this);
            if (nodes.includes(outputNode)) {
                alert(`Whoa, whoa, whoa. You've just tried to create a connection that loops back on itself, `
                    + `an situation that could create a time paradox, the results of which could cause a `
                    + `chain reaction that would unravel the very fabric of the space time continuum, `
                    + `and destroy the entire universe!`);
                canConnect = false;
            }
        }
        return canConnect;
    }
    connectByTypeOutput(slot, sourceNode, sourceSlotType, optsIn) {
        const lastInput = this.inputs[this.inputs.length - 1];
        if (!(lastInput === null || lastInput === void 0 ? void 0 : lastInput.link) && (lastInput === null || lastInput === void 0 ? void 0 : lastInput.type) === '*') {
            var sourceSlot = sourceNode.findOutputSlotByType(sourceSlotType, false, true);
            return sourceNode.connect(sourceSlot, this, slot);
        }
        return super.connectByTypeOutput(slot, sourceNode, sourceSlotType, optsIn);
    }
    static setUp(clazz) {
        addConnectionLayoutSupport(clazz, app, [['Left', 'Right'], ['Right', 'Left']]);
        addMenuItem(clazz, app, {
            name: (node) => { var _a; return (`${((_a = node.properties) === null || _a === void 0 ? void 0 : _a['collapse_connections']) ? 'Show' : 'Collapse'} Connections`); },
            property: 'collapse_connections',
            prepareValue: (_value, node) => { var _a; return !((_a = node.properties) === null || _a === void 0 ? void 0 : _a['collapse_connections']); },
            callback: (_node) => { app.graph.setDirtyCanvas(true, true); }
        });
        LiteGraph.registerNodeType(clazz.type, clazz);
        clazz.category = clazz._category;
    }
}
const oldLGraphNodeConnectByType = LGraphNode.prototype.connectByType;
LGraphNode.prototype.connectByType = function connectByType(slot, sourceNode, sourceSlotType, optsIn) {
    if (sourceNode.inputs) {
        for (const [index, input] of sourceNode.inputs.entries()) {
            if (!input.link && input.type === '*') {
                this.connect(slot, sourceNode, index);
                return null;
            }
        }
    }
    return (oldLGraphNodeConnectByType && oldLGraphNodeConnectByType.call(this, slot, sourceNode, sourceSlotType, optsIn) || null);
};
