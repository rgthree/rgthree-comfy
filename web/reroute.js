import { app } from "../../scripts/app.js";
import { rgthree } from "./rgthree.js";
import { LAYOUT_CLOCKWISE, addConnectionLayoutSupport, addMenuItem, getSlotLinks, wait, } from "./utils.js";
app.registerExtension({
    name: "rgthree.Reroute",
    registerCustomNodes() {
        class RerouteNode extends LGraphNode {
            constructor(title = RerouteNode.title) {
                super(title);
                this.isVirtualNode = true;
                this.setResizable(this.properties['resizable']);
                this.size = RerouteNode.size;
                this.addInput("", "*");
                this.addOutput("", "*");
                setTimeout(() => this.applyNodeSize(), 20);
            }
            configure(info) {
                super.configure(info);
                this.setResizable(this.properties['resizable']);
                this.applyNodeSize();
            }
            setResizable(resizable) {
                this.properties['resizable'] = !!resizable;
                this.resizable = this.properties['resizable'];
            }
            clone() {
                const cloned = super.clone();
                cloned.inputs[0].type = "*";
                cloned.outputs[0].type = "*";
                return cloned;
            }
            onConnectionsChange(type, _slotIndex, connected, _link_info, _ioSlot) {
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
                this.stabilize();
            }
            onDrawForeground(ctx, canvas) {
                var _a, _b, _c;
                if ((_a = this.properties) === null || _a === void 0 ? void 0 : _a['showOutputText']) {
                    const low_quality = canvas.ds.scale < 0.6;
                    if (low_quality || this.size[0] <= 10) {
                        return;
                    }
                    const fontSize = Math.min(14, ((this.size[1] * 0.65) | 0));
                    ctx.save();
                    ctx.fillStyle = "#888";
                    ctx.font = `${fontSize}px Arial`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(String(this.title !== RerouteNode.title ? this.title : ((_c = (_b = this.outputs) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.type) || ''), this.size[0] / 2, (this.size[1] / 2), this.size[0] - 30);
                    ctx.restore();
                }
            }
            disconnectOutput(slot, targetNode) {
                return super.disconnectOutput(slot, targetNode);
            }
            stabilize() {
                var _a, _b, _c;
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
                        if (!node) {
                            app.graph.removeLink(linkId);
                            currentNode = null;
                            break;
                        }
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
                            if (!node)
                                continue;
                            const type = node.constructor.type;
                            if (type === null || type === void 0 ? void 0 : type.includes("Reroute")) {
                                nodes.push(node);
                                updateNodes.push(node);
                            }
                            else {
                                const nodeOutType = node.inputs &&
                                    node.inputs[link === null || link === void 0 ? void 0 : link.target_slot] &&
                                    node.inputs[link.target_slot].type
                                    ? node.inputs[link.target_slot].type
                                    : null;
                                if (inputType &&
                                    String(nodeOutType) !== String(inputType) &&
                                    nodeOutType !== "*") {
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
                    node.outputs[0].name = node.properties.showOutputText
                        ? displayType
                        : "";
                    node.size = node.computeSize();
                    (_c = node.applyNodeSize) === null || _c === void 0 ? void 0 : _c.call(node);
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
            computeSize(out) {
                var _a;
                if (((_a = app.canvas.resizing_node) === null || _a === void 0 ? void 0 : _a.id) === this.id && rgthree.ctrlKey) {
                    return [10, 10];
                }
                return super.computeSize(out);
            }
            onResize(size) {
                var _a;
                if (((_a = app.canvas.resizing_node) === null || _a === void 0 ? void 0 : _a.id) === this.id) {
                    this.properties["size"] = [
                        size[0],
                        size[1],
                    ];
                    if (size[0] < 40 || size[0] < 30) {
                        this.setResizable(false);
                    }
                }
                if (super.onResize) {
                    super.onResize(size);
                }
            }
            applyNodeSize() {
                this.properties["size"] = this.properties["size"] || RerouteNode.size;
                this.properties["size"] = [
                    Number(this.properties["size"][0]),
                    Number(this.properties["size"][1]),
                ];
                this.size = this.properties["size"];
                app.graph.setDirtyCanvas(true, true);
            }
        }
        RerouteNode.title = "Reroute (rgthree)";
        RerouteNode.category = "rgthree";
        RerouteNode._category = "rgthree";
        RerouteNode.title_mode = LiteGraph.NO_TITLE;
        RerouteNode.collapsable = false;
        RerouteNode.layout_slot_offset = 5;
        RerouteNode.size = [40, 30];
        addMenuItem(RerouteNode, app, {
            name: (node) => { var _a; return `${((_a = node.properties) === null || _a === void 0 ? void 0 : _a['showOutputText']) ? "Hide" : "Show"} Label/Title`; },
            property: 'showOutputText',
            callback: async (node, value) => {
                app.graph.setDirtyCanvas(true, true);
            },
        });
        addMenuItem(RerouteNode, app, {
            name: (node) => `${node.resizable ? 'No' : 'Allow'} Resizing`,
            callback: (node) => {
                node.setResizable(!node.resizable);
                node.size[0] = Math.max(40, node.size[0]);
                node.size[1] = Math.max(30, node.size[1]);
                node.applyNodeSize();
            },
        });
        addMenuItem(RerouteNode, app, {
            name: "Static Width",
            property: "size",
            subMenuOptions: (() => {
                const options = [];
                for (let w = 8; w > 0; w--) {
                    options.push(`${w * 10}`);
                }
                return options;
            })(),
            prepareValue: (value, node) => [Number(value), node.size[1]],
            callback: (node) => {
                node.setResizable(false);
                node.applyNodeSize();
            },
        });
        addMenuItem(RerouteNode, app, {
            name: "Static Height",
            property: "size",
            subMenuOptions: (() => {
                const options = [];
                for (let w = 8; w > 0; w--) {
                    options.push(`${w * 10}`);
                }
                return options;
            })(),
            prepareValue: (value, node) => [node.size[0], Number(value)],
            callback: (node) => {
                node.setResizable(false);
                node.applyNodeSize();
            },
        });
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
        ], (node) => {
            node.applyNodeSize();
        });
        addMenuItem(RerouteNode, app, {
            name: "Rotate",
            subMenuOptions: [
                "Rotate 90° Clockwise",
                "Rotate 90° Counter-Clockwise",
                "Rotate 180°",
                null,
                "Flip Horizontally",
                "Flip Vertically",
            ],
            callback: (node, value) => {
                const w = node.size[0];
                const h = node.size[1];
                node.properties["connections_layout"] = node.properties["connections_layout"] || ["Left", "Right"];
                const inputDirIndex = LAYOUT_CLOCKWISE.indexOf(node.properties["connections_layout"][0]);
                const outputDirIndex = LAYOUT_CLOCKWISE.indexOf(node.properties["connections_layout"][1]);
                if (value === null || value === void 0 ? void 0 : value.startsWith("Rotate 90°")) {
                    node.size[0] = h;
                    node.size[1] = w;
                    if (value.includes("Counter")) {
                        node.properties["connections_layout"][0] =
                            LAYOUT_CLOCKWISE[(((inputDirIndex - 1) % 4) + 4) % 4];
                        node.properties["connections_layout"][1] =
                            LAYOUT_CLOCKWISE[(((outputDirIndex - 1) % 4) + 4) % 4];
                    }
                    else {
                        node.properties["connections_layout"][0] =
                            LAYOUT_CLOCKWISE[(((inputDirIndex + 1) % 4) + 4) % 4];
                        node.properties["connections_layout"][1] =
                            LAYOUT_CLOCKWISE[(((outputDirIndex + 1) % 4) + 4) % 4];
                    }
                }
                else if (value === null || value === void 0 ? void 0 : value.startsWith("Rotate 180°")) {
                    node.properties["connections_layout"][0] =
                        LAYOUT_CLOCKWISE[(((inputDirIndex + 2) % 4) + 4) % 4];
                    node.properties["connections_layout"][1] =
                        LAYOUT_CLOCKWISE[(((outputDirIndex + 2) % 4) + 4) % 4];
                }
                else if (value === null || value === void 0 ? void 0 : value.startsWith("Flip Horizontally")) {
                    if (["Left", "Right"].includes(node.properties["connections_layout"][0])) {
                        node.properties["connections_layout"][0] =
                            LAYOUT_CLOCKWISE[(((inputDirIndex + 2) % 4) + 4) % 4];
                    }
                    if (["Left", "Right"].includes(node.properties["connections_layout"][1])) {
                        node.properties["connections_layout"][1] =
                            LAYOUT_CLOCKWISE[(((outputDirIndex + 2) % 4) + 4) % 4];
                    }
                }
                else if (value === null || value === void 0 ? void 0 : value.startsWith("Flip Vertically")) {
                    if (["Top", "Bottom"].includes(node.properties["connections_layout"][0])) {
                        node.properties["connections_layout"][0] =
                            LAYOUT_CLOCKWISE[(((inputDirIndex + 2) % 4) + 4) % 4];
                    }
                    if (["Top", "Bottom"].includes(node.properties["connections_layout"][1])) {
                        node.properties["connections_layout"][1] =
                            LAYOUT_CLOCKWISE[(((outputDirIndex + 2) % 4) + 4) % 4];
                    }
                }
            },
        });
        addMenuItem(RerouteNode, app, {
            name: "Clone New Reroute...",
            subMenuOptions: [
                "Before",
                "After",
            ],
            callback: async (node, value) => {
                const clone = node.clone();
                const pos = [...node.pos];
                if (value === 'Before') {
                    clone.pos = [pos[0] - 20, pos[1] - 20];
                    app.graph.add(clone);
                    await wait();
                    const inputLinks = getSlotLinks(node.inputs[0]);
                    for (const inputLink of inputLinks) {
                        const link = inputLink.link;
                        const linkedNode = app.graph.getNodeById(link.origin_id);
                        if (linkedNode) {
                            linkedNode.connect(0, clone, 0);
                        }
                    }
                    clone.connect(0, node, 0);
                }
                else {
                    clone.pos = [pos[0] + 20, pos[1] + 20];
                    app.graph.add(clone);
                    await wait();
                    const outputLinks = getSlotLinks(node.outputs[0]);
                    node.connect(0, clone, 0);
                    for (const outputLink of outputLinks) {
                        const link = outputLink.link;
                        const linkedNode = app.graph.getNodeById(link.target_id);
                        if (linkedNode) {
                            clone.connect(0, linkedNode, link.target_slot);
                        }
                    }
                }
            },
        });
        LiteGraph.registerNodeType(RerouteNode.title, RerouteNode);
        RerouteNode.category = RerouteNode._category;
    },
});
