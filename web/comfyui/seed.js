import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
import { addConnectionLayoutSupport } from "./utils.js";
import { NodeTypesString } from "./constants.js";
const LAST_SEED_BUTTON_LABEL = "♻️ (Use Last Queued Seed)";
const SPECIAL_SEED_RANDOM = -1;
const SPECIAL_SEED_INCREMENT = -2;
const SPECIAL_SEED_DECREMENT = -3;
const SPECIAL_SEEDS = [SPECIAL_SEED_RANDOM, SPECIAL_SEED_INCREMENT, SPECIAL_SEED_DECREMENT];
class RgthreeSeed extends RgthreeBaseServerNode {
    constructor(title = RgthreeSeed.title) {
        super(title);
        this.serialize_widgets = true;
        this.lastSeed = undefined;
        this.serializedCtx = {};
        this.lastSeedValue = null;
        this.randMax = 1125899906842624;
        this.randMin = 0;
        this.randomRange = 1125899906842624;
        this.handleSeedWidgetSerializationBound = this.handleSeedWidgetSerialization.bind(this);
        this.handleResetSeedWidgetBound = this.handleResetSeedWidget.bind(this);
        this.logger = rgthree.newLogSession(`[Seed]`);
        rgthree.addEventListener('graph-to-prompt', this.handleSeedWidgetSerializationBound);
        rgthree.addEventListener('comfy-api-queue-prompt-end', this.handleResetSeedWidgetBound);
    }
    onRemoved() {
        rgthree.removeEventListener('graph-to-prompt', this.handleSeedWidgetSerializationBound);
        rgthree.removeEventListener('comfy-api-queue-prompt-end', this.handleResetSeedWidgetBound);
    }
    async handleAction(action) {
        if (action === "Randomize Each Time") {
            this.seedWidget.value = SPECIAL_SEED_RANDOM;
        }
        else if (action === "Use Last Queued Seed") {
            this.seedWidget.value = this.lastSeed != null ? this.lastSeed : this.seedWidget.value;
            this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
            this.lastSeedButton.disabled = true;
        }
    }
    onNodeCreated() {
        var _a;
        (_a = super.onNodeCreated) === null || _a === void 0 ? void 0 : _a.call(this);
        for (const [i, w] of this.widgets.entries()) {
            if (w.name === "seed") {
                this.seedWidget = w;
                this.seedWidget.value = SPECIAL_SEED_RANDOM;
            }
            else if (w.name === "control_after_generate") {
                this.widgets.splice(i, 1);
            }
        }
        let step = this.seedWidget.options.step || 1;
        this.randMax = Math.min(1125899906842624, this.seedWidget.options.max);
        this.randMin = Math.max(0, this.seedWidget.options.min);
        this.randomRange = (this.randMax - Math.max(0, this.randMin)) / (step / 10);
        this.addWidget("button", "🎲 Randomize Each Time", null, () => {
            this.seedWidget.value = SPECIAL_SEED_RANDOM;
        }, { serialize: false });
        this.addWidget("button", "🎲 New Fixed Random", null, () => {
            this.seedWidget.value =
                Math.floor(Math.random() * this.randomRange) * (step / 10) + this.randMin;
        }, { serialize: false });
        this.lastSeedButton = this.addWidget("button", LAST_SEED_BUTTON_LABEL, null, () => {
            this.seedWidget.value = this.lastSeed != null ? this.lastSeed : this.seedWidget.value;
            this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
            this.lastSeedButton.disabled = true;
        }, { width: 50, serialize: false });
        this.lastSeedButton.disabled = true;
    }
    getExtraMenuOptions(canvas, options) {
        var _a;
        (_a = super.getExtraMenuOptions) === null || _a === void 0 ? void 0 : _a.apply(this, [...arguments]);
        options.splice(options.length - 1, 0, {
            content: "Show/Hide Last Seed Value",
            callback: (_value, _options, _event, _parentMenu, _node) => {
                this.properties["showLastSeed"] = !this.properties["showLastSeed"];
                if (this.properties["showLastSeed"]) {
                    this.addLastSeedValue();
                }
                else {
                    this.removeLastSeedValue();
                }
            },
        });
    }
    addLastSeedValue() {
        if (this.lastSeedValue)
            return;
        this.lastSeedValue = ComfyWidgets["STRING"](this, "last_seed", ["STRING", { multiline: true }], app).widget;
        this.lastSeedValue.inputEl.readOnly = true;
        this.lastSeedValue.inputEl.style.fontSize = "0.75rem";
        this.lastSeedValue.inputEl.style.textAlign = "center";
        this.lastSeedValue.serializeValue = async (node, index) => {
            const n = rgthree.getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(node);
            if (n) {
                n.widgets_values[index] = "";
            }
            else {
                console.warn('No serialized node found in workflow. May be attributed to '
                    + 'https://github.com/comfyanonymous/ComfyUI/issues/2193');
            }
            return "";
        };
        this.computeSize();
    }
    removeLastSeedValue() {
        if (!this.lastSeedValue)
            return;
        this.lastSeedValue.inputEl.remove();
        this.widgets.splice(this.widgets.indexOf(this.lastSeedValue), 1);
        this.lastSeedValue = null;
        this.computeSize();
    }
    handleSeedWidgetSerialization() {
        var _a, _b, _c;
        const inputSeed = this.seedWidget.value;
        if (!rgthree.processingQueue) {
            return inputSeed;
        }
        if ((_a = this.serializedCtx) === null || _a === void 0 ? void 0 : _a.inputSeed) {
            const [n, v] = this.logger.debugParts("Not handling seed widget serialization b/c we have not cleared the existing context; "
                + "Assuming this run was called outside of a prompt (like from cg-use-everywhere "
                + "analyzation)");
            (_b = console[n]) === null || _b === void 0 ? void 0 : _b.call(console, ...v);
            return inputSeed;
        }
        if (this.mode === LiteGraph.NEVER || this.mode === 4) {
            return inputSeed;
        }
        this.serializedCtx = {
            inputSeed: this.seedWidget.value,
        };
        if (SPECIAL_SEEDS.includes(this.serializedCtx.inputSeed)) {
            if (typeof this.lastSeed === "number" && !SPECIAL_SEEDS.includes(this.lastSeed)) {
                if (inputSeed === SPECIAL_SEED_INCREMENT) {
                    this.serializedCtx.seedUsed = this.lastSeed + 1;
                }
                else if (inputSeed === SPECIAL_SEED_DECREMENT) {
                    this.serializedCtx.seedUsed = this.lastSeed - 1;
                }
            }
            if (!this.serializedCtx.seedUsed || SPECIAL_SEEDS.includes(this.serializedCtx.seedUsed)) {
                this.serializedCtx.seedUsed =
                    Math.floor(Math.random() * this.randomRange) * ((this.seedWidget.options.step || 1) / 10) + this.randMin;
            }
        }
        else {
            this.serializedCtx.seedUsed = this.seedWidget.value;
        }
        const n = rgthree.getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(this);
        const index = this.widgets.indexOf(this.seedWidget);
        if (n) {
            n.widgets_values[index] = this.serializedCtx.seedUsed;
        }
        else {
            const [n, v] = this.logger.warnParts("No serialized node found in workflow. May be attributed to "
                + "https://github.com/comfyanonymous/ComfyUI/issues/2193");
            (_c = console[n]) === null || _c === void 0 ? void 0 : _c.call(console, ...v);
        }
        this.seedWidget.value = this.serializedCtx.seedUsed;
        this.lastSeed = this.serializedCtx.seedUsed;
        if (SPECIAL_SEEDS.includes(this.serializedCtx.inputSeed)) {
            this.lastSeedButton.name = `♻️ ${this.serializedCtx.seedUsed}`;
            this.lastSeedButton.disabled = false;
            if (this.lastSeedValue) {
                this.lastSeedValue.value = `Last Seed: ${this.serializedCtx.seedUsed}`;
            }
        }
        else {
            this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
            this.lastSeedButton.disabled = true;
        }
        return this.serializedCtx.seedUsed;
    }
    handleResetSeedWidget() {
        if (this.serializedCtx.inputSeed) {
            this.seedWidget.value = this.serializedCtx.inputSeed;
        }
        this.serializedCtx = {};
    }
    static setUp(comfyClass) {
        RgthreeBaseServerNode.registerForOverride(comfyClass, RgthreeSeed);
    }
    static onRegisteredForOverride(comfyClass, ctxClass) {
        addConnectionLayoutSupport(RgthreeSeed, app, [
            ["Left", "Right"],
            ["Right", "Left"],
        ]);
        setTimeout(() => {
            RgthreeSeed.category = comfyClass.category;
        });
    }
}
RgthreeSeed.title = NodeTypesString.SEED;
RgthreeSeed.type = NodeTypesString.SEED;
RgthreeSeed.comfyClass = NodeTypesString.SEED;
RgthreeSeed.exposedActions = ["Randomize Each Time", "Use Last Queued Seed"];
app.registerExtension({
    name: "rgthree.Seed",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === RgthreeSeed.type) {
            RgthreeSeed.nodeType = nodeType;
            RgthreeSeed.nodeData = nodeData;
            RgthreeSeed.setUp(nodeType);
        }
    },
});
