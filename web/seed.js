import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { rgthree } from "./rgthree.js";
import { addConnectionLayoutSupport } from "./utils.js";
const LAST_SEED_BUTTON_LABEL = "♻️ (Use Last Queued Seed)";
const SPECIAL_SEED_RANDOM = -1;
const SPECIAL_SEED_INCREMENT = -2;
const SPECIAL_SEED_DECREMENT = -3;
const SPECIAL_SEEDS = [SPECIAL_SEED_RANDOM, SPECIAL_SEED_INCREMENT, SPECIAL_SEED_DECREMENT];
class SeedControl {
    constructor(node) {
        this.lastSeed = undefined;
        this.serializedCtx = {};
        this.lastSeedValue = null;
        this.node = node;
        this.node.constructor.exposedActions = ["Randomize Each Time", "Use Last Queued Seed"];
        const handleAction = this.node.handleAction;
        this.node.handleAction = async (action) => {
            handleAction && handleAction.call(this.node, action);
            if (action === "Randomize Each Time") {
                this.seedWidget.value = SPECIAL_SEED_RANDOM;
            }
            else if (action === "Use Last Queued Seed") {
                this.seedWidget.value = this.lastSeed != null ? this.lastSeed : this.seedWidget.value;
                this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
                this.lastSeedButton.disabled = true;
            }
        };
        this.node.properties = this.node.properties || {};
        for (const [i, w] of this.node.widgets.entries()) {
            if (w.name === "seed") {
                this.seedWidget = w;
                this.seedWidget.value = SPECIAL_SEED_RANDOM;
            }
            else if (w.name === "control_after_generate") {
                this.node.widgets.splice(i, 1);
            }
        }
        if (!this.seedWidget) {
            throw new Error("Something's wrong; expected seed widget");
        }
        const randMax = Math.min(1125899906842624, this.seedWidget.options.max);
        const randMin = Math.max(0, this.seedWidget.options.min);
        const randomRange = (randMax - Math.max(0, randMin)) / (this.seedWidget.options.step / 10);
        this.node.addWidget("button", "🎲 Randomize Each Time", null, () => {
            this.seedWidget.value = SPECIAL_SEED_RANDOM;
        }, { serialize: false });
        this.node.addWidget("button", "🎲 New Fixed Random", null, () => {
            this.seedWidget.value =
                Math.floor(Math.random() * randomRange) * (this.seedWidget.options.step / 10) + randMin;
        }, { serialize: false });
        this.lastSeedButton = this.node.addWidget("button", LAST_SEED_BUTTON_LABEL, null, () => {
            this.seedWidget.value = this.lastSeed != null ? this.lastSeed : this.seedWidget.value;
            this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
            this.lastSeedButton.disabled = true;
        }, { width: 50, serialize: false });
        this.lastSeedButton.disabled = true;
        this.seedWidget.serializeValue = async (node, index) => {
            const inputSeed = this.seedWidget.value;
            if (!rgthree.processingQueue) {
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
                        Math.floor(Math.random() * randomRange) * (this.seedWidget.options.step / 10) + randMin;
                }
            }
            else {
                this.serializedCtx.seedUsed = this.seedWidget.value;
            }
            const n = rgthree.getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(node);
            if (n) {
                n.widgets_values[index] = this.serializedCtx.seedUsed;
            }
            else {
                console.warn('No serialized node found in workflow. May be attributed to '
                    + 'https://github.com/comfyanonymous/ComfyUI/issues/2193');
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
        };
        this.seedWidget.afterQueued = () => {
            if (this.serializedCtx.inputSeed) {
                this.seedWidget.value = this.serializedCtx.inputSeed;
            }
            this.serializedCtx = {};
        };
        const oldGetExtraMenuOptions = this.node.getExtraMenuOptions;
        this.node.getExtraMenuOptions = (_, options) => {
            oldGetExtraMenuOptions === null || oldGetExtraMenuOptions === void 0 ? void 0 : oldGetExtraMenuOptions.apply(this.node, [_, options]);
            options.splice(options.length - 1, 0, {
                content: "Show/Hide Last Seed Value",
                callback: (_value, _options, _event, _parentMenu, _node) => {
                    this.node.properties["showLastSeed"] = !this.node.properties["showLastSeed"];
                    if (this.node.properties["showLastSeed"]) {
                        this.addLastSeedValue();
                    }
                    else {
                        this.removeLastSeedValue();
                    }
                },
            });
        };
    }
    addLastSeedValue() {
        if (this.lastSeedValue)
            return;
        this.lastSeedValue = ComfyWidgets["STRING"](this.node, "last_seed", ["STRING", { multiline: true }], app).widget;
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
        this.node.computeSize();
    }
    removeLastSeedValue() {
        if (!this.lastSeedValue)
            return;
        this.lastSeedValue.inputEl.remove();
        this.node.widgets.splice(this.node.widgets.indexOf(this.lastSeedValue), 1);
        this.lastSeedValue = null;
        this.node.computeSize();
    }
}
app.registerExtension({
    name: "rgthree.Seed",
    async beforeRegisterNodeDef(nodeType, nodeData, _app) {
        if (nodeData.name === "Seed (rgthree)") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined;
                this.seedControl = new SeedControl(this);
            };
            addConnectionLayoutSupport(nodeType, app, [["Left", "Right"], ["Right", "Left"]]);
        }
    },
});
