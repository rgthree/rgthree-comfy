import { app } from "../../scripts/app.js";
import { IoDirection, addConnectionLayoutSupport, addMenuItem, matchLocalSlotsToServer, replaceNode, } from "./utils.js";
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
    let ctxSlotIndex = -1;
    if (["CONDITIONING", "INT", "STRING", "FLOAT", "COMBO"].includes(otherSlotType)) {
        ctxSlotIndex = ctxSlots.findIndex((ctxSlot) => {
            const ctxSlotName = ctxSlot.name.toUpperCase().replace('OPT_', '').replace('_NAME', '');
            let ctxSlotType = ctxSlot.type;
            if (Array.isArray(ctxSlotType) || ctxSlotType.includes(',')) {
                ctxSlotType = 'COMBO';
            }
            if (ctxSlotType !== otherSlotType) {
                return false;
            }
            if (ctxSlotName === otherSlotName
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
const contextNodes = [ContextNode, ContextBigNode, ContextSwitchNode, ContextSwitchBigNode];
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
            matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
            if (!type.includes("Switch")) {
                matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
            }
        }
    },
    async loadedGraphNode(node) {
        const type = node.type || node.constructor.type;
        const serverDef = type && contextTypeToServerDef[type];
        if (serverDef) {
            fixBadConfigs(node);
            matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
            if (!type.includes("Switch")) {
                matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
            }
        }
    },
});
