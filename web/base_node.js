import { ComfyWidgets } from "../../scripts/widgets.js";
import { app } from "../../scripts/app.js";
import { rgthree } from "./rgthree.js";
export class RgthreeBaseNode extends LGraphNode {
    constructor(title = RgthreeBaseNode.title) {
        super(title);
        this._tempWidth = 0;
        this.isVirtualNode = false;
        if (title == '__NEED_NAME__') {
            throw new Error('RgthreeBaseNode needs overrides.');
        }
        this.properties = this.properties || {};
    }
    configure(info) {
        super.configure(info);
        for (const w of (this.widgets || [])) {
            w.last_y = w.last_y || 0;
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
    onModeChange() {
    }
    async handleAction(action) {
        action;
    }
    removeWidget(widgetOrSlot) {
        if (typeof widgetOrSlot === 'number') {
            this.widgets.splice(widgetOrSlot, 1);
        }
        else if (widgetOrSlot) {
            const index = this.widgets.indexOf(widgetOrSlot);
            if (index > -1) {
                this.widgets.splice(index, 1);
            }
        }
    }
    static setUp(...args) {
    }
}
RgthreeBaseNode.exposedActions = [];
RgthreeBaseNode.title = "__NEED_NAME__";
RgthreeBaseNode.category = 'rgthree';
RgthreeBaseNode._category = 'rgthree';
const overriddenServerNodes = new Map();
export class RgthreeBaseServerNode extends RgthreeBaseNode {
    constructor(title) {
        super(title);
        this.serialize_widgets = true;
        this.setupFromServerNodeData();
    }
    getWidgets() {
        return ComfyWidgets;
    }
    onDrawForeground(ctx, canvas) {
        var _a, _b;
        const nodeType = this.constructor.nodeType;
        (_b = (_a = nodeType === null || nodeType === void 0 ? void 0 : nodeType.prototype) === null || _a === void 0 ? void 0 : _a.onDrawForeground) === null || _b === void 0 ? void 0 : _b.apply(this, [ctx, canvas]);
        super.onDrawForeground && super.onDrawForeground(ctx, canvas);
    }
    getExtraMenuOptions(canvas, options) {
        var _a, _b, _c, _d, _e;
        if (super.getExtraMenuOptions) {
            super.getExtraMenuOptions.apply(this, [canvas, options]);
        }
        else if ((_b = (_a = this.constructor.nodeType) === null || _a === void 0 ? void 0 : _a.prototype) === null || _b === void 0 ? void 0 : _b.getExtraMenuOptions) {
            (_e = (_d = (_c = this.constructor.nodeType) === null || _c === void 0 ? void 0 : _c.prototype) === null || _d === void 0 ? void 0 : _d.getExtraMenuOptions) === null || _e === void 0 ? void 0 : _e.apply(this, [canvas, options]);
        }
    }
    async setupFromServerNodeData() {
        var _a, _b, _c;
        const nodeData = this.constructor.nodeData;
        if (!nodeData) {
            throw Error('No node data');
        }
        this.comfyClass = nodeData.name;
        let inputs = nodeData["input"]["required"];
        if (nodeData["input"]["optional"] != undefined) {
            inputs = Object.assign({}, inputs, nodeData["input"]["optional"]);
        }
        const WIDGETS = this.getWidgets();
        const config = { minWidth: 1, minHeight: 1, widget: null };
        for (const inputName in inputs) {
            const inputData = inputs[inputName];
            const type = inputData[0];
            if ((_a = inputData[1]) === null || _a === void 0 ? void 0 : _a.forceInput) {
                this.addInput(inputName, type);
            }
            else {
                let widgetCreated = true;
                if (Array.isArray(type)) {
                    Object.assign(config, WIDGETS.COMBO(this, inputName, inputData, app) || {});
                }
                else if (`${type}:${inputName}` in WIDGETS) {
                    Object.assign(config, WIDGETS[`${type}:${inputName}`](this, inputName, inputData, app) || {});
                }
                else if (type in WIDGETS) {
                    Object.assign(config, WIDGETS[type](this, inputName, inputData, app) || {});
                }
                else {
                    this.addInput(inputName, type);
                    widgetCreated = false;
                }
                if (widgetCreated && ((_b = inputData[1]) === null || _b === void 0 ? void 0 : _b.forceInput) && (config === null || config === void 0 ? void 0 : config.widget)) {
                    if (!config.widget.options)
                        config.widget.options = {};
                    config.widget.options.forceInput = inputData[1].forceInput;
                }
                if (widgetCreated && ((_c = inputData[1]) === null || _c === void 0 ? void 0 : _c.defaultInput) && (config === null || config === void 0 ? void 0 : config.widget)) {
                    if (!config.widget.options)
                        config.widget.options = {};
                    config.widget.options.defaultInput = inputData[1].defaultInput;
                }
            }
        }
        for (const o in nodeData["output"]) {
            let output = nodeData["output"][o];
            if (output instanceof Array)
                output = "COMBO";
            const outputName = nodeData["output_name"][o] || output;
            const outputShape = nodeData["output_is_list"][o] ? LiteGraph.GRID_SHAPE : LiteGraph.CIRCLE_SHAPE;
            this.addOutput(outputName, output, { shape: outputShape });
        }
        const s = this.computeSize();
        s[0] = Math.max(config.minWidth, s[0] * 1.5);
        s[1] = Math.max(config.minHeight, s[1]);
        this.size = s;
        this.serialize_widgets = true;
    }
    static registerForOverride(comfyClass, rgthreeClass) {
        if (overriddenServerNodes.has(comfyClass)) {
            throw Error(`Already have a class to overridde ${comfyClass.type || comfyClass.name || comfyClass.title}`);
        }
        overriddenServerNodes.set(comfyClass, rgthreeClass);
    }
}
RgthreeBaseServerNode.nodeData = null;
RgthreeBaseServerNode.nodeType = null;
const oldregisterNodeType = LiteGraph.registerNodeType;
LiteGraph.registerNodeType = function (nodeId, baseClass) {
    const clazz = overriddenServerNodes.get(baseClass) || baseClass;
    if (clazz !== baseClass) {
        rgthree.logger.debug(`For "${nodeId}", replacing default ComfyNode implementation with custom ${clazz.type || clazz.name || clazz.title} class.`);
    }
    return oldregisterNodeType.call(LiteGraph, nodeId, clazz);
};
