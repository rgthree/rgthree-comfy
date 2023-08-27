import { app } from "../../scripts/app.js";
import { addConnectionLayoutSupport, wait } from "./utils.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
class CollectorNode extends LGraphNode {
    constructor(title = CollectorNode.title) {
        super(title);
        this.isVirtualNode = true;
        this.properties = this.properties || {};
        this.connections = [];
        this.addInput("", "*");
        this.addOutput("Output", "*");
    }
    clone() {
        const cloned = super.clone();
        return cloned;
    }
    updateOutputLinks(startNode = this) {
        const type = startNode.constructor.type;
        if (startNode.onConnectionsChainChange) {
            startNode.onConnectionsChainChange();
        }
        if (startNode === this || (type === null || type === void 0 ? void 0 : type.includes('Reroute')) || (type === null || type === void 0 ? void 0 : type.includes('Combiner'))) {
            for (const output of startNode.outputs) {
                if (!output.links || !output.links.length)
                    continue;
                for (const linkId of output.links) {
                    const link = app.graph.links[linkId];
                    if (!link)
                        continue;
                    const targetNode = app.graph.getNodeById(link.target_id);
                    targetNode && this.updateOutputLinks(targetNode);
                }
            }
        }
    }
    onConnectionsChange(_type, _slotIndex, _isConnected, link_info, _ioSlot) {
        if (!link_info)
            return;
        this.stabilizeInputsOutputs();
        this.updateOutputLinks();
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
CollectorNode.legacyType = "Node Combiner (rgthree)";
CollectorNode.title = "Node Collector (rgthree)";
CollectorNode.category = 'rgthree';
CollectorNode._category = 'rgthree';
class CombinerNode extends CollectorNode {
    constructor(title = CombinerNode.title) {
        super(title);
        const note = ComfyWidgets["STRING"](this, "last_seed", ["STRING", { multiline: true }], app).widget;
        note.inputEl.value = 'The Node Combiner has been renamed to Node Collector. You can right-click and select "Update to Node Collector" to attempt to automatically update.';
        note.inputEl.readOnly = true;
        note.inputEl.style.backgroundColor = '#332222';
        note.inputEl.style.fontWeight = 'bold';
        note.inputEl.style.fontStyle = 'italic';
        note.inputEl.style.opacity = '0.8';
        this.getExtraMenuOptions = (_, options) => {
            options.splice(options.length - 1, 0, {
                content: "‼️ Update to Node Collector",
                callback: (_value, _options, _event, _parentMenu, _node) => {
                    updateCombinerToCollector(this);
                }
            });
        };
    }
    configure(info) {
        super.configure(info);
        if (this.title != CombinerNode.title && !this.title.startsWith('‼️')) {
            this.title = '‼️ ' + this.title;
        }
    }
}
CombinerNode.legacyType = "Node Combiner (rgthree)";
CombinerNode.title = "‼️ Node Combiner [DEPRECATED]";
async function updateCombinerToCollector(node) {
    if (node.type === CollectorNode.legacyType) {
        const newNode = new CollectorNode();
        if (node.title != CombinerNode.title) {
            newNode.title = node.title.replace('‼️ ', '');
        }
        newNode.pos = [...node.pos];
        newNode.size = [...node.size];
        newNode.properties = Object.assign({}, node.properties);
        const links = [];
        for (const [index, output] of node.outputs.entries()) {
            for (const linkId of (output.links || [])) {
                const link = app.graph.links[linkId];
                if (!link)
                    continue;
                const targetNode = app.graph.getNodeById(link.target_id);
                links.push({ node: newNode, slot: index, targetNode, targetSlot: link.target_slot });
            }
        }
        for (const [index, input] of node.inputs.entries()) {
            const linkId = input.link;
            if (linkId) {
                const link = app.graph.links[linkId];
                const originNode = app.graph.getNodeById(link.origin_id);
                links.push({ node: originNode, slot: link.origin_slot, targetNode: newNode, targetSlot: index });
            }
        }
        app.graph.add(newNode);
        await wait();
        for (const link of links) {
            link.node.connect(link.slot, link.targetNode, link.targetSlot);
        }
        await wait();
        app.graph.remove(node);
    }
}
app.registerExtension({
    name: "rgthree.NodeCollector",
    registerCustomNodes() {
        addConnectionLayoutSupport(CollectorNode, app, [['Left', 'Right'], ['Right', 'Left']]);
        LiteGraph.registerNodeType(CollectorNode.title, CollectorNode);
        CollectorNode.category = CollectorNode._category;
    },
});
app.registerExtension({
    name: "rgthree.NodeCombiner",
    registerCustomNodes() {
        addConnectionLayoutSupport(CombinerNode, app, [['Left', 'Right'], ['Right', 'Left']]);
        LiteGraph.registerNodeType(CombinerNode.legacyType, CombinerNode);
        CombinerNode.category = CombinerNode._category;
    },
});
