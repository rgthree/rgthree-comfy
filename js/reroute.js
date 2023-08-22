import { app } from "../../scripts/app.js";
import { addConnectionLayoutSupport, addMenuSubMenu } from "./utils.js";
app.registerExtension({
    name: "rgthree.Reroute",
    registerCustomNodes() {
        class RerouteNode extends LGraphNode {
            constructor(title = RerouteNode.title) {
                super(title);
                this.isVirtualNode = true;
                this.resizable = false;
                this.size = RerouteNode.size;
                this.addInput("", "*");
                this.addOutput("", "*");
                setTimeout(() => this.applyNodeSize(), 20);
            }
            configure(info) {
                super.configure(info);
                this.applyNodeSize();
            }
            clone() {
                const cloned = super.clone();
                cloned.inputs[0].type = '*';
                cloned.outputs[0].type = '*';
                return cloned;
            }
            onConnectionsChange(type, _slotIndex, connected, _link_info, _ioSlot) {
                var _a, _b;
                if (connected && type === LiteGraph.OUTPUT) {
                    const types = new Set(this.outputs[0].links.map((l) => app.graph.links[l].type).filter((t) => t !== "*"));
                    if (types.size > 1) {
                        const linksToDisconnect = [];
                        for (let i = 0; i < this.outputs[0].links.length - 1; i++) {
                            const linkId = this.outputs[0].links[i];
                            const link = app.graph.links[linkId];
                            linksToDisconnect.push(link);
                        }
                        for (const link of linksToDisconnect) {
                            const node = app.graph.getNodeById(link.target_id);
                            node.disconnectInput(link.target_slot);
                        }
                    }
                }
                let currentNode = this;
                let updateNodes = [];
                let inputType = null;
                let inputNode = null;
                while (currentNode) {
                    updateNodes.unshift(currentNode);
                    const linkId = currentNode.inputs[0].link;
                    if (linkId !== null) {
                        const link = app.graph.links[linkId];
                        const node = app.graph.getNodeById(link.origin_id);
                        const type = node.constructor.type;
                        if (type === null || type === void 0 ? void 0 : type.includes("Reroute")) {
                            if (node === this) {
                                currentNode.disconnectInput(link.target_slot);
                                currentNode = null;
                            }
                            else {
                                currentNode = node;
                            }
                        }
                        else {
                            inputNode = currentNode;
                            inputType = (_b = (_a = node.outputs[link.origin_slot]) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : null;
                            break;
                        }
                    }
                    else {
                        currentNode = null;
                        break;
                    }
                }
                const nodes = [this];
                let outputType = null;
                while (nodes.length) {
                    currentNode = nodes.pop();
                    const outputs = (currentNode.outputs ? currentNode.outputs[0].links : []) || [];
                    if (outputs.length) {
                        for (const linkId of outputs) {
                            const link = app.graph.links[linkId];
                            if (!link)
                                continue;
                            const node = app.graph.getNodeById(link.target_id);
                            const type = node.constructor.type;
                            if (type === null || type === void 0 ? void 0 : type.includes("Reroute")) {
                                nodes.push(node);
                                updateNodes.push(node);
                            }
                            else {
                                const nodeOutType = node.inputs && node.inputs[link === null || link === void 0 ? void 0 : link.target_slot] && node.inputs[link.target_slot].type ? node.inputs[link.target_slot].type : null;
                                if (inputType && nodeOutType !== inputType && nodeOutType !== '*') {
                                    node.disconnectInput(link.target_slot);
                                }
                                else {
                                    outputType = nodeOutType;
                                }
                            }
                        }
                    }
                    else {
                    }
                }
                const displayType = inputType || outputType || "*";
                const color = LGraphCanvas.link_type_colors[displayType];
                for (const node of updateNodes) {
                    node.outputs[0].type = inputType || "*";
                    node.__outputType = displayType;
                    node.outputs[0].name = node.properties.showOutputText ? displayType : "";
                    node.size = node.computeSize();
                    node.applyNodeSize();
                    for (const l of node.outputs[0].links || []) {
                        const link = app.graph.links[l];
                        if (link) {
                            link.color = color;
                        }
                    }
                }
                if (inputNode) {
                    const link = app.graph.links[inputNode.inputs[0].link];
                    if (link) {
                        link.color = color;
                    }
                }
                app.graph.setDirtyCanvas(true, true);
            }
            applyNodeSize() {
                this.properties['size'] = this.properties['size'] || RerouteNode.size;
                this.properties['size'] = [Number(this.properties['size'][0]), Number(this.properties['size'][1])];
                this.size = this.properties['size'];
                app.graph.setDirtyCanvas(true, true);
            }
        }
        RerouteNode.title = "Reroute (rgthree)";
        RerouteNode.category = 'rgthree';
        RerouteNode._category = 'rgthree';
        RerouteNode.title_mode = LiteGraph.NO_TITLE;
        RerouteNode.collapsable = false;
        RerouteNode.layout_slot_offset = 0;
        RerouteNode.size = [40, 30];
        addConnectionLayoutSupport(RerouteNode, app, [
            ["Left", "Right"],
            ["Left", "Top"],
            ["Left", "Bottom"],
            ["Right", "Left"],
            ["Right", "Top"],
            ["Right", "Bottom"],
            ["Top", "Left"],
            ["Top", "Right"],
            ["Top", "Bottom"],
            ["Bottom", "Left"],
            ["Bottom", "Right"],
            ["Bottom", "Top"],
        ], (node) => { node.applyNodeSize(); });
        addMenuSubMenu(RerouteNode, app, {
            name: 'Height',
            property: 'size',
            options: (() => {
                const options = [];
                for (let w = 8; w > 0; w--) {
                    options.push(`${w * 10}`);
                }
                return options;
            })(),
            prepareValue: (value, node) => [node.size[0], Number(value)],
            callback: (node) => node.applyNodeSize()
        });
        addMenuSubMenu(RerouteNode, app, {
            name: 'Width',
            property: 'size',
            options: (() => {
                const options = [];
                for (let w = 8; w > 0; w--) {
                    options.push(`${w * 10}`);
                }
                return options;
            })(),
            prepareValue: (value, node) => [Number(value), node.size[1]],
            callback: (node) => node.applyNodeSize()
        });
        LiteGraph.registerNodeType(RerouteNode.title, RerouteNode);
        RerouteNode.category = RerouteNode._category;
    },
});
