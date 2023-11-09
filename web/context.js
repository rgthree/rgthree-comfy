import { app } from "../../scripts/app.js";
import { IoDirection, addConnectionLayoutSupport, addMenuItem, followConnectionUntilType, getConnectedInputNodesAndFilterPassThroughs, getConnectedOutputNodesAndFilterPassThroughs, matchLocalSlotsToServer, replaceNode, } from "./utils.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
function findMatchingIndexByTypeOrName(otherNode, otherSlot, ctxSlots) {
    const otherNodeType = (otherNode.type || '').toUpperCase();
    const otherNodeName = (otherNode.title || '').toUpperCase();
    let otherSlotType = otherSlot.type;
    if (Array.isArray(otherSlotType) || otherSlotType.includes(',')) {
        otherSlotType = 'COMBO';
    }
    const otherSlotName = otherSlot.name.toUpperCase().replace('OPT_', '').replace('_NAME', '');
    const otherSlotLabel = (otherSlot.label || otherSlotName).toUpperCase().replace('OPT_', '').replace('_NAME', '');
    let ctxSlotIndex = -1;
    if (["CONDITIONING", "INT", "STRING", "FLOAT", "COMBO"].includes(otherSlotType)) {
        ctxSlotIndex = ctxSlots.findIndex((ctxSlot) => {
            const ctxSlotName = ctxSlot.name.toUpperCase().replace('OPT_', '').replace('_NAME', '');
            const ctxSlotLabel = (ctxSlot.label || ctxSlotName).toUpperCase().replace('OPT_', '').replace('_NAME', '');
            let ctxSlotType = ctxSlot.type;
            if (Array.isArray(ctxSlotType) || ctxSlotType.includes(',')) {
                ctxSlotType = 'COMBO';
            }
            if (ctxSlotType !== otherSlotType) {
                return false;
            }
            if (ctxSlotName === otherSlotName
                || (ctxSlotLabel && otherSlotLabel && ctxSlotLabel == otherSlotLabel)
                || (ctxSlotName === "SEED" && otherSlotName.includes("SEED"))
                || (ctxSlotName === "STEP_REFINER" && otherSlotName.includes("AT_STEP"))
                || (ctxSlotName === "STEP_REFINER" && otherSlotName.includes("REFINER_STEP"))) {
                return true;
            }
            if ((otherNodeType.includes('POSITIVE') || otherNodeName.includes('POSITIVE')) &&
                ((ctxSlotName === 'POSITIVE' && otherSlotType === 'CONDITIONING')
                    || (ctxSlotName === 'TEXT_POS_G' && otherSlotName.includes("TEXT_G"))
                    || (ctxSlotName === 'TEXT_POS_L' && otherSlotName.includes("TEXT_L")))) {
                return true;
            }
            if ((otherNodeType.includes('NEGATIVE') || otherNodeName.includes('NEGATIVE')) &&
                ((ctxSlotName === 'NEGATIVE' && otherSlotType === 'CONDITIONING')
                    || (ctxSlotName === 'TEXT_NEG_G' && otherSlotName.includes("TEXT_G"))
                    || (ctxSlotName === 'TEXT_NEG_L' && otherSlotName.includes("TEXT_L")))) {
                return true;
            }
            return false;
        });
    }
    else {
        ctxSlotIndex = ctxSlots.map((s) => s.type).indexOf(otherSlotType);
    }
    return ctxSlotIndex;
}
class BaseContextNode extends RgthreeBaseServerNode {
    constructor(title) {
        super(title);
    }
    connectByType(slot, sourceNode, sourceSlotType, optsIn) {
        let canConnect = super.connectByType &&
            super.connectByType.call(this, slot, sourceNode, sourceSlotType, optsIn);
        if (!super.connectByType) {
            canConnect = LGraphNode.prototype.connectByType.call(this, slot, sourceNode, sourceSlotType, optsIn);
        }
        if (!canConnect && slot === 0) {
            const ctrlKey = rgthree.ctrlKey;
            for (const [index, input] of (sourceNode.inputs || []).entries()) {
                if (input.link && !ctrlKey) {
                    continue;
                }
                const thisOutputSlot = findMatchingIndexByTypeOrName(sourceNode, input, this.outputs);
                if (thisOutputSlot > -1) {
                    this.connect(thisOutputSlot, sourceNode, index);
                }
            }
        }
        return null;
    }
    connectByTypeOutput(slot, sourceNode, sourceSlotType, optsIn) {
        var _a;
        let canConnect = super.connectByTypeOutput &&
            super.connectByTypeOutput.call(this, slot, sourceNode, sourceSlotType, optsIn);
        if (!super.connectByType) {
            canConnect = LGraphNode.prototype.connectByTypeOutput.call(this, slot, sourceNode, sourceSlotType, optsIn);
        }
        if (!canConnect && slot === 0) {
            const ctrlKey = rgthree.ctrlKey;
            for (const [index, output] of (sourceNode.outputs || []).entries()) {
                if (((_a = output.links) === null || _a === void 0 ? void 0 : _a.length) && !ctrlKey) {
                    continue;
                }
                const thisInputSlot = findMatchingIndexByTypeOrName(sourceNode, output, this.inputs);
                if (thisInputSlot > -1) {
                    sourceNode.connect(index, this, thisInputSlot);
                }
            }
        }
        return null;
    }
    static setUp(comfyClass, ctxClass) {
        RgthreeBaseServerNode.registerForOverride(comfyClass, ctxClass);
        addConnectionLayoutSupport(ctxClass, app, [
            ["Left", "Right"],
            ["Right", "Left"],
        ]);
        setTimeout(() => {
            ctxClass.category = comfyClass.category;
        });
    }
}
class ContextNode extends BaseContextNode {
    constructor(title = ContextNode.title) {
        super(title);
    }
    static setUp(comfyClass) {
        BaseContextNode.setUp(comfyClass, ContextNode);
        addMenuItem(ContextNode, app, {
            name: "Convert To Context Big",
            callback: (node) => {
                replaceNode(node, ContextBigNode.type);
            },
        });
    }
}
ContextNode.title = "Context (rgthree)";
ContextNode.type = "Context (rgthree)";
ContextNode.comfyClass = "Context (rgthree)";
class ContextBigNode extends BaseContextNode {
    constructor(title = ContextBigNode.title) {
        super(title);
    }
    static setUp(comfyClass) {
        BaseContextNode.setUp(comfyClass, ContextBigNode);
        addMenuItem(ContextBigNode, app, {
            name: "Convert To Context (Original)",
            callback: (node) => {
                replaceNode(node, ContextNode.type);
            },
        });
    }
}
ContextBigNode.title = "Context Big (rgthree)";
ContextBigNode.type = "Context Big (rgthree)";
ContextBigNode.comfyClass = "Context Big (rgthree)";
class ContextSwitchNode extends BaseContextNode {
    constructor(title = ContextSwitchNode.title) {
        super(title);
    }
    static setUp(comfyClass) {
        BaseContextNode.setUp(comfyClass, ContextSwitchNode);
        addMenuItem(ContextSwitchNode, app, {
            name: "Convert To Context Switch Big",
            callback: (node) => {
                replaceNode(node, ContextSwitchBigNode.type);
            },
        });
    }
}
ContextSwitchNode.title = "Context Switch (rgthree)";
ContextSwitchNode.type = "Context Switch (rgthree)";
ContextSwitchNode.comfyClass = "Context Switch (rgthree)";
class ContextSwitchBigNode extends BaseContextNode {
    constructor(title = ContextSwitchBigNode.title) {
        super(title);
    }
    static setUp(comfyClass) {
        BaseContextNode.setUp(comfyClass, ContextSwitchBigNode);
        addMenuItem(ContextSwitchBigNode, app, {
            name: "Convert To Context Switch",
            callback: (node) => {
                replaceNode(node, ContextSwitchNode.type);
            },
        });
    }
}
ContextSwitchBigNode.title = "Context Switch Big (rgthree)";
ContextSwitchBigNode.type = "Context Switch Big (rgthree)";
ContextSwitchBigNode.comfyClass = "Context Switch Big (rgthree)";
function addWidgetForDynamicContextOutputs(node, inputName) {
    node.addCustomWidget({
        name: inputName,
        value: '',
        draw(ctx, node, width, posY, height) {
            return;
        },
        computeSize(width) {
            return [0, 0];
        },
        serializeValue() {
            const value = (node.outputs || []).map((o, i) => i > 0 && o.name).filter(n => n !== false).join(',');
            return value;
        }
    });
}
class ContextDynamicNode extends BaseContextNode {
    constructor(title = ContextNode.title) {
        super(title);
    }
    getWidgets() {
        return Object.assign({}, super.getWidgets(), {
            'DYNAMIC_CONTEXT_OUTPUTS': (node, inputName, inputData, app) => {
                addWidgetForDynamicContextOutputs(node, inputName);
            }
        });
    }
    onNodeCreated() {
        if (this.inputs[this.inputs.length - 1].type === '*') {
            this.removeOutput(this.inputs.length - 1);
        }
        else {
            this.addInput('+', '*');
        }
    }
    static setUp(comfyClass) {
        BaseContextNode.setUp(comfyClass, ContextDynamicNode);
    }
    clone() {
        const cloned = super.clone();
        while (cloned.inputs.length > 1) {
            cloned.removeInput(cloned.inputs.length - 1);
        }
        cloned.addInput('+', '*');
        return cloned;
    }
    stripOwnedPrefix(name) {
        return name.replace(/^\+\s*/, '');
    }
    addOwnedPrefix(name) {
        return `+ ${this.stripOwnedPrefix(name)}`;
    }
    isOwnedInput(inputOrName) {
        const name = typeof inputOrName == 'string' ? inputOrName : (inputOrName === null || inputOrName === void 0 ? void 0 : inputOrName.name) || '';
        return name.startsWith('+ ');
    }
    onConnectionsChange(type, slotIndex, isConnected, linkInfo, ioSlot) {
        var _a;
        (_a = super.onConnectionsChange) === null || _a === void 0 ? void 0 : _a.call(this, type, slotIndex, isConnected, linkInfo, ioSlot);
        if (this.configuring) {
            return;
        }
        if (type === LiteGraph.INPUT) {
            if (isConnected) {
                this.handleInputConnected(slotIndex);
            }
            else {
                this.handleInputDisconnected(slotIndex);
            }
        }
    }
    stabilizeNames() {
        const names = [];
        const indexesChanged = [];
        for (const [index, input] of this.inputs.entries()) {
            if (index === 0 || index === this.inputs.length - 1) {
                continue;
            }
            input.label = undefined;
            this.outputs[index].label = undefined;
            let origName = this.stripOwnedPrefix(input.name).replace(/\.\d+$/, '');
            let name = input.name;
            if (!this.isOwnedInput(name)) {
                names.push(name.toLocaleUpperCase());
            }
            else {
                let n = 0;
                name = this.addOwnedPrefix(origName);
                while (names.includes(this.stripOwnedPrefix(name).toLocaleUpperCase())) {
                    name = `${this.addOwnedPrefix(origName)}.${++n}`;
                }
                names.push(this.stripOwnedPrefix(name).toLocaleUpperCase());
                if (input.name !== name) {
                    input.name = name;
                    this.outputs[index].name = this.stripOwnedPrefix(name).toLocaleUpperCase();
                    indexesChanged.push(index);
                }
            }
        }
        if (indexesChanged.length) {
            this.updateDownstream('update', indexesChanged);
        }
    }
    getSlotMenuOptions(info) {
        const opts = [];
        if (info.input) {
            if (this.isOwnedInput(info.input.name)) {
                opts.push({ content: 'Rename Label', callback: () => {
                        var dialog = app.canvas.createDialog("<span class='name'>Name</span><input autofocus type='text'/><button>OK</button>", {});
                        var dialogInput = dialog.querySelector("input");
                        if (dialogInput) {
                            dialogInput.value = info.input.label || "";
                        }
                        var inner = () => {
                            app.graph.beforeChange();
                            let newName = dialogInput.value.trim() || this.getSlotDefaultInputLabel(info.slot);
                            const oldName = info.input.name;
                            info.input.name = newName;
                            if (this.isOwnedInput(oldName)) {
                                info.input.name = this.addOwnedPrefix(info.input.name);
                            }
                            else if (this.isOwnedInput(info.input.name)) {
                                info.input.name = this.stripOwnedPrefix(info.input.name);
                            }
                            this.outputs[info.slot].name = this.stripOwnedPrefix(info.input.name).toLocaleUpperCase();
                            this.updateDownstream('update', [info.slot]);
                            this.stabilizeNames();
                            this.setDirtyCanvas(true, true);
                            dialog.close();
                            app.graph.afterChange();
                        };
                        dialog.querySelector("button").addEventListener("click", inner);
                        dialogInput.addEventListener("keydown", (e) => {
                            var _a;
                            dialog.is_modified = true;
                            if (e.keyCode == 27) {
                                dialog.close();
                            }
                            else if (e.keyCode == 13) {
                                inner();
                            }
                            else if (e.keyCode != 13 && ((_a = e.target) === null || _a === void 0 ? void 0 : _a.localName) != "textarea") {
                                return;
                            }
                            e.preventDefault();
                            e.stopPropagation();
                        });
                        dialogInput.focus();
                    } });
                opts.push({ content: 'Delete Input', callback: () => {
                        this.removeInput(info.slot);
                    } });
            }
        }
        return opts;
    }
    removeInput(slot) {
        super.removeInput(slot);
        if (this.outputs[slot]) {
            this.removeOutput(slot);
        }
        this.updateDownstream('disconnect', [slot]);
        this.stabilizeNames();
    }
    getSlotDefaultInputLabel(slot) {
        const input = this.inputs[slot];
        let defaultLabel = this.stripOwnedPrefix(input.name).toLowerCase();
        return defaultLabel.toLocaleLowerCase();
    }
    updateFromUpstream(update, node, slotIndexes) {
        if (update == 'connect') {
            for (const baseIndex of slotIndexes) {
                const baseInput = node.inputs[baseIndex];
                const baseInputName = this.stripOwnedPrefix(baseInput.name);
                this.addInput(baseInputName, baseInput.type);
                this.inputs.splice(baseIndex, 0, this.inputs.splice(this.inputs.length - 1, 1)[0]);
                this.addOutput(baseInputName.toUpperCase(), baseInput.type);
                this.outputs.splice(baseIndex, 0, this.outputs.splice(this.outputs.length - 1, 1)[0]);
            }
            this.updateDownstream(update, slotIndexes);
            this.stabilizeNames();
        }
        else if (update == 'disconnect') {
            for (let index = this.inputs.length - 1; index > 0; index--) {
                if (index == 0) {
                    continue;
                }
                if (slotIndexes.includes(index)) {
                    this.removeInput(index);
                }
            }
        }
        else if (update == 'update') {
            for (const baseIndex of slotIndexes) {
                const baseInput = node.inputs[baseIndex];
                this.inputs[baseIndex].name = this.stripOwnedPrefix(baseInput.name);
                this.outputs[baseIndex].name = this.inputs[baseIndex].name.toUpperCase();
            }
            this.updateDownstream(update, slotIndexes);
            this.stabilizeNames();
        }
        for (let index = this.inputs.length - 1; index > 0; index--) {
            const input = this.inputs[index];
            if ((input === null || input === void 0 ? void 0 : input.link) != null) {
                app.graph.links[input.link].target_slot = index;
            }
            const output = this.outputs[index];
            for (const link of (output === null || output === void 0 ? void 0 : output.links) || []) {
                app.graph.links[link].origin_slot = index;
            }
        }
        this.setSize(this.computeSize());
        this.setDirtyCanvas(true, true);
    }
    updateDownstream(update, slotIndexes) {
        var _a;
        const nodes = getConnectedOutputNodesAndFilterPassThroughs(this, this, 0);
        for (const node of nodes) {
            (_a = node === null || node === void 0 ? void 0 : node.updateFromUpstream) === null || _a === void 0 ? void 0 : _a.call(node, update, this, slotIndexes);
        }
    }
    handleInputConnected(slotIndex) {
        var _a;
        const ioSlot = this.inputs[slotIndex];
        const connectedIndexes = [];
        if (slotIndex === 0) {
            const baseNodes = getConnectedInputNodesAndFilterPassThroughs(this, this, 0);
            if ((_a = baseNodes[0]) === null || _a === void 0 ? void 0 : _a.updateFromUpstream) {
                this.updateFromUpstream('connect', baseNodes[0], baseNodes[0].inputs.map((input, index) => index > 0 && input.name !== '+' ? index : null).filter(i => i != null));
            }
        }
        else if (ioSlot.type === '*') {
            let cxn = null;
            if (ioSlot.link) {
                cxn = followConnectionUntilType(this, IoDirection.INPUT, slotIndex, true);
            }
            if (cxn === null || cxn === void 0 ? void 0 : cxn.type) {
                let name = this.addOwnedPrefix(cxn.name);
                if (name.match(/^\+\s*[A-Z_]+$/)) {
                    name = name.toLowerCase();
                }
                this.inputs[slotIndex].type = cxn.type;
                this.inputs[slotIndex].name = name;
                this.inputs[slotIndex].removable = true;
                if (!this.outputs[slotIndex]) {
                    this.addOutput('*', '*');
                }
                this.outputs[slotIndex].type = cxn.type;
                this.outputs[slotIndex].name = this.stripOwnedPrefix(name).toLocaleUpperCase();
                connectedIndexes.push(slotIndex);
                this.addInput('+', '*');
                this.updateDownstream('connect', connectedIndexes);
                this.stabilizeNames();
            }
        }
    }
    handleInputDisconnected(slotIndex) {
        var _a;
        const ioSlot = this.inputs[slotIndex];
        if (slotIndex === 0) {
            for (let index = this.inputs.length - 1; index > 0; index--) {
                if (index == 0) {
                    continue;
                }
                if (!this.isOwnedInput((_a = this.inputs[index]) === null || _a === void 0 ? void 0 : _a.name)) {
                    this.removeInput(index);
                }
            }
        }
    }
    getInputNames() {
        return this.inputs.map(input => input.name);
    }
}
ContextDynamicNode.title = "Dynamic Context (rgthree)";
ContextDynamicNode.type = "Dynamic Context (rgthree)";
ContextDynamicNode.comfyClass = "Dynamic Context (rgthree)";
const contextNodes = [ContextNode, ContextBigNode, ContextSwitchNode, ContextSwitchBigNode, ContextDynamicNode];
const contextTypeToServerDef = {};
function fixBadConfigs(node) {
    const wrongName = node.outputs.find((o, i) => o.name === 'CLIP_HEIGTH');
    if (wrongName) {
        wrongName.name = 'CLIP_HEIGHT';
    }
}
app.registerExtension({
    name: "rgthree.Context",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === ContextNode.type) {
        }
        for (const ctxClass of contextNodes) {
            if (nodeData.name === ctxClass.type) {
                ctxClass.nodeData = nodeData;
                ctxClass.nodeType = nodeType;
                contextTypeToServerDef[ctxClass.type] = nodeData;
                ctxClass.setUp(nodeType);
                break;
            }
        }
    },
    async nodeCreated(node) {
        const type = node.type || node.constructor.type;
        const serverDef = type && contextTypeToServerDef[type];
        if (serverDef) {
            fixBadConfigs(node);
            if (!type.includes('Dynamic')) {
                matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
                if (!type.includes("Switch")) {
                    matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
                }
            }
        }
    },
    async loadedGraphNode(node) {
        const type = node.type || node.constructor.type;
        const serverDef = type && contextTypeToServerDef[type];
        if (serverDef) {
            fixBadConfigs(node);
            if (!type.includes('Dynamic')) {
                matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
                if (!type.includes("Switch")) {
                    matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
                }
            }
        }
    },
});
