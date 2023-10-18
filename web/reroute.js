var _a;
import { app } from "../../scripts/app.js";
import { rgthreeConfig } from "./rgthree_config.js";
import { rgthree } from "./rgthree.js";
import { LAYOUT_CLOCKWISE, LAYOUT_LABEL_OPPOSITES, LAYOUT_LABEL_TO_DATA, addConnectionLayoutSupport, addMenuItem, getSlotLinks, isValidConnection, } from "./utils.js";
import { wait } from "./shared_utils.js";
const rerouteConfig = ((_a = rgthreeConfig === null || rgthreeConfig === void 0 ? void 0 : rgthreeConfig['nodes']) === null || _a === void 0 ? void 0 : _a['reroute']) || {};
let configWidth = Math.max(Math.round((Number(rerouteConfig['default_width']) || 40) / 10) * 10, 10);
let configHeight = Math.max(Math.round((Number(rerouteConfig['default_height']) || 30) / 10) * 10, 10);
while (configWidth * configHeight < 400) {
    configWidth += 10;
    configHeight += 10;
}
const configDefaultSize = [configWidth, configHeight];
const configResizable = !!rerouteConfig['default_resizable'];
let configLayout = rerouteConfig['default_layout'];
if (!Array.isArray(configLayout)) {
    configLayout = ['Left', 'Right'];
}
if (!LAYOUT_LABEL_TO_DATA[configLayout[0]]) {
    configLayout[0] = 'Left';
}
if (!LAYOUT_LABEL_TO_DATA[configLayout[1]] || configLayout[0] == configLayout[1]) {
    configLayout[1] = LAYOUT_LABEL_OPPOSITES[configLayout[0]];
}
app.registerExtension({
    name: "rgthree.Reroute",
    registerCustomNodes() {
        class RerouteNode extends LGraphNode {
            constructor(title = RerouteNode.title) {
                var _a;
                super(title);
                this.configuring = true;
                this.schedulePromise = null;
                this.defaultConnectionsLayout = configLayout;
                this.isVirtualNode = true;
                this.hideSlotLabels = true;
                this.setResizable((_a = this.properties['resizable']) !== null && _a !== void 0 ? _a : configResizable);
                this.size = RerouteNode.size;
                this.addInput("", "*");
                this.addOutput("", "*");
                setTimeout(() => this.applyNodeSize(), 20);
            }
            configure(info) {
                var _a;
                this.configuring = true;
                super.configure(info);
                this.setResizable((_a = this.properties['resizable']) !== null && _a !== void 0 ? _a : configResizable);
                this.applyNodeSize();
                this.configuring = false;
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
                this.scheduleStabilize();
            }
            onDrawForeground(ctx, canvas) {
                var _a, _b, _c;
                if ((_a = this.properties) === null || _a === void 0 ? void 0 : _a['showLabel']) {
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
                    ctx.fillText(String(this.title && this.title !== RerouteNode.title ? this.title : ((_c = (_b = this.outputs) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.type) || ''), this.size[0] / 2, (this.size[1] / 2), this.size[0] - 30);
                    ctx.restore();
                }
            }
            disconnectOutput(slot, targetNode) {
                return super.disconnectOutput(slot, targetNode);
            }
            scheduleStabilize(ms = 64) {
                if (!this.schedulePromise) {
                    this.schedulePromise = new Promise((resolve) => {
                        setTimeout(() => {
                            this.schedulePromise = null;
                            this.stabilize();
                            resolve();
                        }, ms);
                    });
                }
                return this.schedulePromise;
            }
            stabilize() {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                if (this.configuring) {
                    return;
                }
                let currentNode = this;
                let updateNodes = [];
                let input = null;
                let inputType = null;
                let inputNode = null;
                let inputNodeOutputSlot = null;
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
                            inputNode = node;
                            inputNodeOutputSlot = link.origin_slot;
                            input = (_a = node.outputs[inputNodeOutputSlot]) !== null && _a !== void 0 ? _a : null;
                            inputType = (_b = input === null || input === void 0 ? void 0 : input.type) !== null && _b !== void 0 ? _b : null;
                            break;
                        }
                    }
                    else {
                        currentNode = null;
                        break;
                    }
                }
                const nodes = [this];
                let outputNode = null;
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
                                const output = (_d = (_c = node.inputs) === null || _c === void 0 ? void 0 : _c[link.target_slot]) !== null && _d !== void 0 ? _d : null;
                                const nodeOutType = output === null || output === void 0 ? void 0 : output.type;
                                if (nodeOutType == null) {
                                    console.warn(`[rgthree] Reroute - Connected node ${node.id} does not have type information for slot ${link.target_slot}. Skipping connection enforcement, but something is odd with that node.`);
                                }
                                else if (inputType &&
                                    inputType !== "*" &&
                                    nodeOutType !== "*" &&
                                    !isValidConnection(input, output)) {
                                    console.warn(`[rgthree] Reroute - Disconnecting connected node's input (${node.id}.${link.target_slot}) (${node.type}) because its type (${String(nodeOutType)}) does not match the reroute type (${String(inputType)})`);
                                    node.disconnectInput(link.target_slot);
                                }
                                else {
                                    outputType = nodeOutType;
                                    outputNode = node;
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
                    node.outputs[0].name = (input === null || input === void 0 ? void 0 : input.name) || "";
                    node.size = node.computeSize();
                    (_f = (_e = node).applyNodeSize) === null || _f === void 0 ? void 0 : _f.call(_e);
                    for (const l of node.outputs[0].links || []) {
                        const link = app.graph.links[l];
                        if (link) {
                            link.color = color;
                        }
                    }
                }
                if (inputNode && inputNodeOutputSlot != null) {
                    const links = inputNode.outputs[inputNodeOutputSlot].links;
                    for (const l of links || []) {
                        const link = app.graph.links[l];
                        if (link) {
                            link.color = color;
                        }
                    }
                }
                (_g = inputNode === null || inputNode === void 0 ? void 0 : inputNode.onConnectionsChainChange) === null || _g === void 0 ? void 0 : _g.call(inputNode);
                (_h = outputNode === null || outputNode === void 0 ? void 0 : outputNode.onConnectionsChainChange) === null || _h === void 0 ? void 0 : _h.call(outputNode);
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
        RerouteNode.size = configDefaultSize;
        addMenuItem(RerouteNode, app, {
            name: (node) => { var _a; return `${((_a = node.properties) === null || _a === void 0 ? void 0 : _a['showLabel']) ? "Hide" : "Show"} Label/Title`; },
            property: 'showLabel',
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
                node.properties["connections_layout"] = node.properties["connections_layout"] || node.defaultConnectionsLayout;
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
