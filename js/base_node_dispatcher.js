import { app } from "../../scripts/app.js";
import { addConnectionLayoutSupport, addMenuItem } from "./utils.js";
export class BaseNodeDispatcher extends LGraphNode {
    constructor(title = BaseNodeDispatcher.title) {
        if (title == '__NEED_NAME__') {
            throw new Error('BaseNodeDispatcher needs overrides.');
        }
        super(title);
        this.debouncer = 0;
        this.schedulePromise = null;
        this.isVirtualNode = true;
        this.properties = this.properties || {};
        this.connections = [];
        this.addInput("", "*");
    }
    isPassThroughType(type) {
        return (type === null || type === void 0 ? void 0 : type.includes('Reroute')) || (type === null || type === void 0 ? void 0 : type.includes('Node Combiner')) || (type === null || type === void 0 ? void 0 : type.includes('Node Collector'));
    }
    doChainLookup(startNode = this) {
        let rootNodes = [];
        const slotsToRemove = [];
        const type = startNode.constructor.type;
        if (startNode === this || this.isPassThroughType(type)) {
            const removeDups = startNode === this;
            for (const input of startNode.inputs) {
                const linkId = input.link;
                if (!linkId) {
                    continue;
                }
                const link = app.graph.links[linkId];
                const originNode = app.graph.getNodeById(link.origin_id);
                const originNodeType = originNode.constructor.type;
                if (this.isPassThroughType(originNodeType)) {
                    for (const foundNode of this.doChainLookup(originNode)) {
                        if (!rootNodes.includes(foundNode)) {
                            rootNodes.push(foundNode);
                        }
                    }
                }
                else if (rootNodes.includes(originNode)) {
                    removeDups && (slotsToRemove.push(link.target_slot));
                }
                else {
                    rootNodes.push(originNode);
                }
            }
            for (const slot of slotsToRemove) {
                this.disconnectInput(slot);
            }
        }
        return rootNodes;
    }
    scheduleRefreshWidgets() {
        if (!this.schedulePromise) {
            this.schedulePromise = new Promise((resolve) => {
                setTimeout(() => {
                    resolve(this.refreshWidgets());
                    this.schedulePromise = null;
                }, 100);
            });
        }
        return this.schedulePromise;
    }
    refreshWidgets() {
        const linkedNodes = this.doChainLookup();
        this.stabilizeInputsOutputs();
        for (const [index, node] of linkedNodes.entries()) {
            let widget = this.widgets && this.widgets[index];
            if (!widget) {
                this._tempWidth = this.size[0];
                widget = this.addWidget('toggle', '', false, '', { "on": 'yes', "off": 'no' });
            }
            this.setWidget(widget, node);
        }
        if (this.widgets && this.widgets.length > linkedNodes.length) {
            this._tempWidth = this.size[0];
            this.widgets.length = linkedNodes.length;
        }
        app.graph.setDirtyCanvas(true, true);
    }
    setWidget(_widget, _linkedNode) {
        throw new Error('setWidget should be overridden');
    }
    onConnectionsChainChange() {
        this.scheduleRefreshWidgets();
    }
    onConnectionsChange(_type, _index, _connected, _linkInfo, _ioSlot) {
        this.scheduleRefreshWidgets();
    }
    removeInput(slot) {
        this._tempWidth = this.size[0];
        return super.removeInput(slot);
    }
    addInput(name, type, extra_info) {
        this._tempWidth = this.size[0];
        return super.addInput(name, type, extra_info);
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
    computeSize(out) {
        var _a, _b;
        let size = super.computeSize(out);
        if (this._tempWidth) {
            size[0] = this._tempWidth;
            this._tempWidth = null;
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
        addMenuItem(clazz, app, {
            name: 'Refresh',
            callback: (node) => { node.scheduleRefreshWidgets(); }
        });
        addMenuItem(clazz, app, {
            name: (node) => { var _a; return (`${((_a = node.properties) === null || _a === void 0 ? void 0 : _a['collapse_connections']) ? 'Show' : 'Collapse'} Connections`); },
            property: 'collapse_connections',
            prepareValue: (_value, node) => { var _a; return !((_a = node.properties) === null || _a === void 0 ? void 0 : _a['collapse_connections']); },
            callback: (_node) => { app.graph.setDirtyCanvas(true, true); }
        });
        addConnectionLayoutSupport(clazz, app, [['Left'], ['Right']]);
        LiteGraph.registerNodeType(clazz.title, clazz);
        clazz.category = clazz._category;
    }
}
BaseNodeDispatcher.title = "__NEED_NAME__";
BaseNodeDispatcher.category = 'rgthree';
BaseNodeDispatcher._category = 'rgthree';
BaseNodeDispatcher.collapsible = false;
