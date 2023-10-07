import { app } from "../../scripts/app.js";
import { IoDirection, addConnectionLayoutSupport, addMenuItem, matchLocalSlotsToServer, replaceNode, } from "./utils.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
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
app.registerExtension({
    name: "rgthree.Context",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === ContextNode.type) {
        }
        for (const ctxClass of contextNodes) {
            if (nodeData.name === ctxClass.type) {
                ctxClass.nodeData = nodeData;
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
            matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
            if (!type.includes("Switch")) {
                matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
            }
        }
    },
});
