import { app } from "../../scripts/app.js";
import { IoDirection, addConnectionLayoutSupport, addMenuItem, applyMixins, matchLocalSlotsToServer, replaceNode, } from "./utils.js";
import { RgthreeBaseNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
class BaseContextNode extends RgthreeBaseNode {
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
                const inputType = input.type;
                const inputName = input.name.toUpperCase();
                let thisOutputSlot = -1;
                if (["CONDITIONING", "INT"].includes(inputType)) {
                    thisOutputSlot = this.outputs.findIndex((o) => o.type === inputType &&
                        (o.name.toUpperCase() === inputName ||
                            (o.name.toUpperCase() === "SEED" && inputName.includes("SEED")) ||
                            (o.name.toUpperCase() === "STEP_REFINER" && inputName.includes("AT_STEP"))));
                }
                else {
                    thisOutputSlot = this.outputs.map((s) => s.type).indexOf(input.type);
                }
                if (thisOutputSlot > -1) {
                    thisOutputSlot;
                    this.connect(thisOutputSlot, sourceNode, index);
                }
            }
        }
        return null;
    }
    static setUp(clazz, selfClazz) {
        selfClazz.title = clazz.title;
        selfClazz.comfyClass = clazz.comfyClass;
        setTimeout(() => {
            selfClazz.category = clazz.category;
        });
        applyMixins(clazz, [RgthreeBaseNode, BaseContextNode, selfClazz]);
        addConnectionLayoutSupport(clazz, app, [
            ["Left", "Right"],
            ["Right", "Left"],
        ]);
    }
}
class ContextNode extends BaseContextNode {
    constructor(title = ContextNode.title) {
        super(title);
    }
    static setUp(clazz) {
        BaseContextNode.setUp(clazz, ContextNode);
        addMenuItem(clazz, app, {
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
    static setUp(clazz) {
        BaseContextNode.setUp(clazz, ContextBigNode);
        addMenuItem(clazz, app, {
            name: "Convert To Context (Original)",
            callback: (node) => {
                replaceNode(node, ContextNode.type);
            },
        });
    }
}
ContextBigNode.type = "Context Big (rgthree)";
ContextBigNode.comfyClass = "Context Big (rgthree)";
class ContextSwitchNode extends BaseContextNode {
    static setUp(clazz) {
        BaseContextNode.setUp(clazz, ContextSwitchNode);
        addMenuItem(clazz, app, {
            name: "Convert To Context Switch Big",
            callback: (node) => {
                replaceNode(node, ContextSwitchBigNode.type);
            },
        });
    }
}
ContextSwitchNode.type = "Context Switch (rgthree)";
ContextSwitchNode.comfyClass = "Context Switch (rgthree)";
class ContextSwitchBigNode extends BaseContextNode {
    static setUp(clazz) {
        BaseContextNode.setUp(clazz, ContextSwitchBigNode);
        addMenuItem(clazz, app, {
            name: "Convert To Context Switch",
            callback: (node) => {
                replaceNode(node, ContextSwitchNode.type);
            },
        });
    }
}
ContextSwitchBigNode.type = "Context Switch Big (rgthree)";
ContextSwitchBigNode.comfyClass = "Context Switch Big (rgthree)";
const contextNodes = [ContextNode, ContextBigNode, ContextSwitchNode, ContextSwitchBigNode];
const contextTypeToServerDef = {};
app.registerExtension({
    name: "rgthree.Context",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        let override = false;
        for (const clazz of contextNodes) {
            if (nodeData.name === clazz.type) {
                contextTypeToServerDef[clazz.type] = nodeData;
                clazz.setUp(nodeType);
                override = true;
                break;
            }
        }
    },
    async nodeCreated(node) {
        const type = node.type || node.constructor.type;
        const serverDef = type && contextTypeToServerDef[type];
        if (serverDef) {
            setTimeout(() => {
                matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
                if (!type.includes("Switch")) {
                    matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
                }
            }, 100);
        }
    },
    async loadedGraphNode(node) {
        const type = node.type || node.constructor.type;
        const serverDef = type && contextTypeToServerDef[type];
        if (serverDef) {
            matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
            if (!type.includes("Switch")) {
                matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
            }
        }
    },
});
