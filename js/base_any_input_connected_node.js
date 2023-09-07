import { app } from "../../scripts/app.js";
import { RgthreeBaseNode } from "./base_node.js";
import { addConnectionLayoutSupport, addMenuItem, getConnectedInputNodes } from "./utils.js";
export class BaseAnyInputConnectedNode extends RgthreeBaseNode {
    constructor(title = BaseAnyInputConnectedNode.title) {
        super(title);
        this.isVirtualNode = true;
        this.debouncerTempWidth = 0;
        this.schedulePromise = null;
        this.addInput("", "*");
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
    stabilizeInputsOutputs() {
        let hasEmptyInput = false;
        for (let index = this.inputs.length - 1; index >= 0; index--) {
            const input = this.inputs[index];
            if (!input.link) {
                if (index < this.inputs.length - 1) {
                    this.removeInput(index);
                }
                else {
                    hasEmptyInput = true;
                }
            }
        }
        !hasEmptyInput && this.addInput('', '*');
    }
    doStablization() {
        if (!this.graph) {
            return;
        }
        this._tempWidth = this.size[0];
        const linkedNodes = getConnectedInputNodes(app, this);
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
