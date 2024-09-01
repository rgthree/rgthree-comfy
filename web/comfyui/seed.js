import { app } from "../../scripts/app.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
import { addConnectionLayoutSupport } from "./utils.js";
import { NodeTypesString } from "./constants.js";
const LAST_SEED_BUTTON_LABEL = "♻️ (Use Last Queued Seed)";
const SPECIAL_SEED_RANDOM = -1;
const SPECIAL_SEED_INCREMENT = -2;
const SPECIAL_SEED_DECREMENT = -3;
const SPECIAL_SEEDS = [SPECIAL_SEED_RANDOM, SPECIAL_SEED_INCREMENT, SPECIAL_SEED_DECREMENT];
const MAX_SEED_HISTORY_SIZE = 50;
class RgthreeSeed extends RgthreeBaseServerNode {
    constructor(title = RgthreeSeed.title) {
        super(title);
        this.serialize_widgets = true;
        this.logger = rgthree.newLogSession(`[Seed]`);
        this.lastSeed = undefined;
        this.serializedCtx = {};
        this.seedHistory = null;
        this.randMax = 1125899906842624;
        this.randMin = 0;
        this.randomRange = 1125899906842624;
        this.handleApiHijackingBound = this.handleApiHijacking.bind(this);
        rgthree.addEventListener("comfy-api-queue-prompt-before", this.handleApiHijackingBound);
    }
    onRemoved() {
        rgthree.addEventListener("comfy-api-queue-prompt-before", this.handleApiHijackingBound);
    }
    configure(info) {
        var _a;
        super.configure(info);
        if ((_a = this.properties) === null || _a === void 0 ? void 0 : _a["ShowSeedHistory"]) {
            this.addSeedHistory();
        }
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
            content: "Enable/Disable Seed History",
            callback: (_value, _options, _event, _parentMenu, _node) => {
                this.properties["ShowSeedHistory"] = !this.properties["ShowSeedHistory"];
                if (this.properties["ShowSeedHistory"]) {
                    this.addSeedHistory();
                }
                else {
                    this.removeSeedHistory();
                }
            },
        });
    }
    addSeedHistory() {
        if (this.seedHistory)
            return;
        this.seedHistory = this.addWidget("combo", "Seed history", this.lastSeed != null ? this.lastSeed : "empty", () => {
            this.seedWidget.value = this.seedHistory.value.split(' ').pop();
        }, { values: this.lastSeed != null ? [this.lastSeed] : [], serialize: false });
        this.seedHistory.disabled = true;
        this.computeSize();
        this.setDirtyCanvas(true, true);
    }
    removeSeedHistory() {
        if (!this.seedHistory)
            return;
        this.widgets.splice(this.widgets.indexOf(this.seedHistory), 1);
        this.seedHistory = null;
        this.computeSize();
        this.setDirtyCanvas(true, true);
    }
    handleApiHijacking(e) {
        var _a, _b, _c, _d;
        if (this.mode === LiteGraph.NEVER || this.mode === 4) {
            return;
        }
        const workflow = e.detail.workflow;
        const output = e.detail.output;
        let workflowNode = (_b = (_a = workflow === null || workflow === void 0 ? void 0 : workflow.nodes) === null || _a === void 0 ? void 0 : _a.find((n) => n.id === this.id)) !== null && _b !== void 0 ? _b : null;
        let outputInputs = (_c = output === null || output === void 0 ? void 0 : output[this.id]) === null || _c === void 0 ? void 0 : _c.inputs;
        if (!workflowNode ||
            !outputInputs ||
            outputInputs[this.seedWidget.name || "seed"] === undefined) {
            const [n, v] = this.logger.warnParts(`Node ${this.id} not found in prompt data sent to server. This may be fine if only ` +
                `queuing part of the workflow. If not, then this could be a bug.`);
            (_d = console[n]) === null || _d === void 0 ? void 0 : _d.call(console, ...v);
            return;
        }
        const seedToUse = this.getSeedToUse();
        const seedWidgetndex = this.widgets.indexOf(this.seedWidget);
        workflowNode.widgets_values[seedWidgetndex] = seedToUse;
        outputInputs[this.seedWidget.name || "seed"] = seedToUse;
        this.lastSeed = seedToUse;
        if (seedToUse != this.seedWidget.value) {
            this.lastSeedButton.name = `♻️ ${this.lastSeed}`;
            this.lastSeedButton.disabled = false;
        }
        else {
            this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
            this.lastSeedButton.disabled = true;
        }
        if (this.seedHistory) {
            if (this.seedHistory.options.values.length == 0 || this.lastSeed != this.seedHistory.options.values[0].split(' ').pop()) {
                const now = new Date();
                const date = `${now.getMonth() + 1}/${now.getDate()} ${('0' +
                    now.getHours()).slice(-2)}:${('0' + now.getMinutes()).slice(-2)}`;
                this.seedHistory.options.values.unshift(`${date} - ${this.lastSeed}`);
                if (this.seedHistory.options.values.length > MAX_SEED_HISTORY_SIZE) {
                    this.seedHistory.options.values.pop();
                }
            }
            this.seedHistory.value = this.seedHistory.options.values[0];
            this.seedHistory.disabled = false;
        }
    }
    getSeedToUse() {
        const inputSeed = this.seedWidget.value;
        let seedToUse = null;
        if (SPECIAL_SEEDS.includes(inputSeed)) {
            if (typeof this.lastSeed === "number" && !SPECIAL_SEEDS.includes(this.lastSeed)) {
                if (inputSeed === SPECIAL_SEED_INCREMENT) {
                    seedToUse = this.lastSeed + 1;
                }
                else if (inputSeed === SPECIAL_SEED_DECREMENT) {
                    seedToUse = this.lastSeed - 1;
                }
            }
            if (seedToUse == null || SPECIAL_SEEDS.includes(seedToUse)) {
                seedToUse =
                    Math.floor(Math.random() * this.randomRange) *
                        ((this.seedWidget.options.step || 1) / 10) +
                        this.randMin;
            }
        }
        return seedToUse !== null && seedToUse !== void 0 ? seedToUse : inputSeed;
    }
    static setUp(comfyClass, nodeData) {
        RgthreeBaseServerNode.registerForOverride(comfyClass, nodeData, RgthreeSeed);
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
            RgthreeSeed.setUp(nodeType, nodeData);
        }
    },
});
