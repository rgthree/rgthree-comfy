import { app } from "../../scripts/app.js";
import { addConnectionLayoutSupport, addMenuItem } from "./utils.js";
const MUTE_MODE = 2;
const ALWAYS_MODE = 0;
app.registerExtension({
    name: "rgthree.Muter",
    registerCustomNodes() {
        class CustomNode extends LGraphNode {
            constructor(title = CustomNode.title) {
                super(title);
                this.debouncer = 0;
                this.schedulePromise = null;
                this.isVirtualNode = true;
                this.properties = this.properties || {};
                this.connections = [];
                this.addInput("", "*");
            }
            doChainLookup(startNode = this) {
                let rootNodes = [];
                const type = startNode.constructor.type;
                if (startNode === this || (type === null || type === void 0 ? void 0 : type.includes('Reroute')) || (type === null || type === void 0 ? void 0 : type.includes('Combiner'))) {
                    for (const input of startNode.inputs) {
                        const linkId = input.link;
                        if (!linkId) {
                            continue;
                        }
                        const link = app.graph.links[linkId];
                        const originNode = app.graph.getNodeById(link.origin_id);
                        const foundNodes = this.doChainLookup(originNode);
                        rootNodes = rootNodes.concat(foundNodes);
                    }
                }
                else if (!(type === null || type === void 0 ? void 0 : type.includes('Reroute')) && !(type === null || type === void 0 ? void 0 : type.includes('Combiner'))) {
                    rootNodes.push(startNode);
                }
                return rootNodes;
            }
            scheduleRefreshMutables() {
                if (!this.schedulePromise) {
                    this.schedulePromise = new Promise((resolve) => {
                        setTimeout(() => {
                            resolve(this.refreshMutables());
                            this.schedulePromise = null;
                        }, 100);
                    });
                }
                return this.schedulePromise;
            }
            refreshMutables() {
                this.stabilizeInputsOutputs();
                const mutables = this.doChainLookup();
                for (const [index, node] of mutables.entries()) {
                    let widget = this.widgets && this.widgets[index];
                    if (!widget) {
                        widget = this.addWidget("toggle", 'title', false, '', { "on": 'yes', "off": 'no' });
                    }
                    const muted = node.mode === MUTE_MODE;
                    widget.name = `Enable ${node.title}`;
                    widget.value = !muted;
                    widget.callback = () => {
                        const muted = node.mode === MUTE_MODE;
                        node.mode = muted ? ALWAYS_MODE : MUTE_MODE;
                        widget.value = muted;
                    };
                }
                this.widgets.length = mutables.length;
                app.graph.setDirtyCanvas(true, true);
            }
            onConnectionsChainChange() {
                this.scheduleRefreshMutables();
            }
            onConnectionsChange(_type, _index, _connected, _linkInfo, _ioSlot) {
                this.scheduleRefreshMutables();
            }
            stabilizeInputsOutputs() {
                for (let index = this.inputs.length - 1; index >= 0; index--) {
                    const input = this.inputs[index];
                    if (!input.link) {
                        this.removeInput(index);
                    }
                }
                this.addInput('', '*');
            }
            computeSize(out) {
                var _a, _b;
                let size = super.computeSize(out);
                if (this.properties['collapse_connections']) {
                    const rows = Math.max(((_a = this.inputs) === null || _a === void 0 ? void 0 : _a.length) || 0, ((_b = this.outputs) === null || _b === void 0 ? void 0 : _b.length) || 0, 1) - 1;
                    size[1] = size[1] - (rows * LiteGraph.NODE_SLOT_HEIGHT);
                }
                setTimeout(() => {
                    app.graph.setDirtyCanvas(true, true);
                }, 16);
                return size;
            }
        }
        CustomNode.title = "Fast Muter (rgthree)";
        CustomNode.collapsible = false;
        CustomNode.category = "rgthree/utils";
        addConnectionLayoutSupport(CustomNode, app, [['Left'], ['Right']]);
        addMenuItem(CustomNode, app, {
            name: (node) => { var _a; return (`${((_a = node.properties) === null || _a === void 0 ? void 0 : _a['collapse_connections']) ? 'Show' : 'Collapse'} Connections`); },
            property: 'collapse_connections',
            prepareValue: (_value, node) => { var _a; return !((_a = node.properties) === null || _a === void 0 ? void 0 : _a['collapse_connections']); },
            callback: (_node) => { app.graph.setDirtyCanvas(true, true); }
        });
        addMenuItem(CustomNode, app, {
            name: 'Refresh',
            callback: (node) => { node.scheduleRefreshMutables(); }
        });
        LiteGraph.registerNodeType(CustomNode.title, CustomNode);
    },
});
