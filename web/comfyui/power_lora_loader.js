import { app } from "../../scripts/app.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
import { addConnectionLayoutSupport } from "./utils.js";
import { NodeTypesString } from "./constants.js";
import { drawRoundedRectangle, fitString, isLowQuality } from "./utils_canvas.js";
import { RgthreeBaseWidget, RgthreeBetterButtonWidget, RgthreeDividerWidget, } from "./utils_widgets.js";
import { rgthreeApi } from "../../rgthree/common/rgthree_api.js";
import { showLoraChooser } from "./utils_menu.js";
import { moveArrayItem, removeArrayItem } from "../../rgthree/common/shared_utils.js";
class RgthreePowerLoraLoader extends RgthreeBaseServerNode {
    constructor(title = NODE_CLASS.title) {
        super(title);
        this.logger = rgthree.newLogSession(`[Power Lora Stack]`);
        this.widgetButtonSpacer = null;
        this.loraWidgetsCounter = 0;
        this.serialize_widgets = true;
        rgthreeApi.getLoras();
    }
    configure(info) {
        var _a;
        while ((_a = this.widgets) === null || _a === void 0 ? void 0 : _a.length)
            this.removeWidget(0);
        this.widgetButtonSpacer = null;
        super.configure(info);
        setTimeout(() => {
            this._tempWidth = this.size[0];
            this._tempHeight = this.size[1];
            for (const widgetValue of info.widgets_values || []) {
                if ((widgetValue === null || widgetValue === void 0 ? void 0 : widgetValue.lora) !== undefined) {
                    const widget = this.addNewLoraWidget();
                    widget.value = { ...widgetValue };
                }
            }
            this.addNonLoraWidgets();
            this.size[0] = this._tempWidth;
            this.size[1] = Math.max(this._tempHeight, this.computeSize()[1]);
        }, 100);
    }
    onNodeCreated() {
        var _a;
        (_a = super.onNodeCreated) === null || _a === void 0 ? void 0 : _a.call(this);
        this.addNonLoraWidgets();
    }
    addNewLoraWidget(lora) {
        this.loraWidgetsCounter++;
        const widget = this.addCustomWidget(new PowerLoraLoaderWidget("lora_" + this.loraWidgetsCounter));
        if (lora)
            widget.setLora(lora);
        if (this.widgetButtonSpacer) {
            moveArrayItem(this.widgets, widget, this.widgets.indexOf(this.widgetButtonSpacer));
        }
        return widget;
    }
    addNonLoraWidgets() {
        const initialSpacer = this.addCustomWidget(new RgthreeDividerWidget({ marginTop: 4, marginBottom: 0, thickness: 0 }));
        moveArrayItem(this.widgets, initialSpacer, 0);
        this.widgetButtonSpacer = this.addCustomWidget(new RgthreeDividerWidget({ marginTop: 4, marginBottom: 0, thickness: 0 }));
        this.addCustomWidget(new RgthreeBetterButtonWidget("➕ Add Lora", (event, pos, node) => {
            showLoraChooser(event, (value) => {
                if (typeof value === "string") {
                    if (value !== "NONE") {
                        this.addNewLoraWidget(value);
                        this.size[1] = Math.max(this._tempHeight, this.computeSize()[1]);
                    }
                }
            });
            return true;
        }));
    }
    getSlotInPosition(canvasX, canvasY) {
        var _a;
        const slot = super.getSlotInPosition(canvasX, canvasY);
        if (!slot) {
            let lastWidget = null;
            for (const widget of this.widgets) {
                if (!widget.last_y)
                    return;
                if (canvasY > this.pos[1] + widget.last_y) {
                    lastWidget = widget;
                    continue;
                }
                break;
            }
            if ((_a = lastWidget === null || lastWidget === void 0 ? void 0 : lastWidget.name) === null || _a === void 0 ? void 0 : _a.startsWith("lora_")) {
                return { widget: lastWidget, output: { type: "LORA WIDGET" } };
            }
        }
        return slot;
    }
    getSlotMenuOptions(slot) {
        var _a, _b, _c, _d, _e, _f;
        if ((_b = (_a = slot === null || slot === void 0 ? void 0 : slot.widget) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.startsWith("lora_")) {
            const widget = slot.widget;
            const index = this.widgets.indexOf(widget);
            const canMoveUp = !!((_d = (_c = this.widgets[index - 1]) === null || _c === void 0 ? void 0 : _c.name) === null || _d === void 0 ? void 0 : _d.startsWith("lora_"));
            const canMoveDown = !!((_f = (_e = this.widgets[index + 1]) === null || _e === void 0 ? void 0 : _e.name) === null || _f === void 0 ? void 0 : _f.startsWith("lora_"));
            const menuItems = [
                {
                    content: `${widget.value.on ? "⚫" : "🟢"} Toggle ${widget.value.on ? "Off" : "On"}`,
                    callback: () => {
                        widget.value.on = !widget.value.on;
                    },
                },
                {
                    content: `⬆️ Move Up`,
                    disabled: !canMoveUp,
                    callback: () => {
                        moveArrayItem(this.widgets, widget, index - 1);
                    },
                },
                {
                    content: `⬇️ Move Down`,
                    disabled: !canMoveDown,
                    callback: () => {
                        moveArrayItem(this.widgets, widget, index + 1);
                    },
                },
                null,
                {
                    content: `🗑️ Remove`,
                    callback: () => {
                        removeArrayItem(this.widgets, widget);
                    },
                },
            ];
            let canvas = app.canvas;
            new LiteGraph.ContextMenu(menuItems, { title: "LORA WIDGET", event: rgthree.lastAdjustedMouseEvent }, canvas.getCanvasWindow());
            return null;
        }
        return this.defaultGetSlotMenuOptions(slot);
    }
    refreshComboInNode(defs) {
        rgthreeApi.getLoras(true);
    }
    static setUp(comfyClass) {
        NODE_CLASS.registerForOverride(comfyClass, NODE_CLASS);
    }
    static onRegisteredForOverride(comfyClass, ctxClass) {
        addConnectionLayoutSupport(NODE_CLASS, app, [
            ["Left", "Right"],
            ["Right", "Left"],
        ]);
        setTimeout(() => {
            NODE_CLASS.category = comfyClass.category;
        });
    }
}
RgthreePowerLoraLoader.title = NodeTypesString.POWER_LORA_LOADER;
RgthreePowerLoraLoader.type = NodeTypesString.POWER_LORA_LOADER;
RgthreePowerLoraLoader.comfyClass = NodeTypesString.POWER_LORA_LOADER;
const DEFAULT_LORA_WIDGET_DATA = {
    on: true,
    lora: null,
    strength: 1,
};
class PowerLoraLoaderWidget extends RgthreeBaseWidget {
    constructor(name) {
        super(name);
        this.isDownOnStrength = false;
        this.haveMouseMovedStrength = false;
        this._value = {
            on: true,
            lora: null,
            strength: 1,
        };
        this.renderData = {
            toggleX: [0, 0],
            loraX: [0, 0],
            strengthArrowLessX: [0, 0],
            strengthX: [0, 0],
            strengthArrowMoreX: [0, 0],
        };
    }
    set value(v) {
        this._value = v;
        if (typeof this._value !== "object") {
            this._value = { ...DEFAULT_LORA_WIDGET_DATA };
        }
    }
    get value() {
        return this._value;
    }
    setLora(lora) {
        this._value.lora = lora;
    }
    draw(ctx, node, w, posY, height) {
        var _a;
        ctx.save();
        const margin = 10;
        const innerMargin = margin * 0.33;
        const lowQuality = isLowQuality();
        const midY = posY + height * 0.5;
        let posX = margin;
        drawRoundedRectangle(ctx, { posX, posY, height, width: node.size[0] - margin * 2 });
        const toggleRadius = height * 0.36;
        const toggleBgWidth = height * 1.5;
        if (!lowQuality) {
            ctx.beginPath();
            ctx.roundRect(posX + 4, posY + 4, toggleBgWidth - 8, height - 8, [height * 0.5]);
            ctx.globalAlpha = app.canvas.editor_alpha * 0.25;
            ctx.fillStyle = "#888";
            ctx.fill();
            ctx.globalAlpha = app.canvas.editor_alpha;
        }
        ctx.fillStyle = this.value.on ? "#89B" : !lowQuality ? "#777" : "#333";
        const toggleX = !lowQuality && this.value.on ? posX + height : posX + height * 0.5;
        ctx.beginPath();
        ctx.arc(toggleX, posY + height * 0.5, toggleRadius, 0, Math.PI * 2);
        ctx.fill();
        this.renderData.toggleX[0] = posX;
        this.renderData.toggleX[1] = posX + toggleBgWidth;
        posX = this.renderData.toggleX[1];
        posX += innerMargin;
        if (lowQuality) {
            ctx.restore();
            return;
        }
        if (!this.value.on) {
            ctx.globalAlpha = app.canvas.editor_alpha * 0.4;
        }
        const arrowWidth = 10;
        const strengthValueWidth = 36;
        const arrowHeight = 10;
        const strengthWidth = innerMargin +
            arrowWidth +
            innerMargin +
            strengthValueWidth +
            innerMargin +
            arrowWidth +
            innerMargin * 2;
        const loraWidth = node.size[0] - margin - posX - strengthWidth;
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        const loraLabel = String(this.value.lora || "None");
        ctx.fillText(fitString(ctx, loraLabel, loraWidth), posX, midY);
        this.renderData.loraX[0] = posX;
        this.renderData.loraX[1] = posX + loraWidth;
        posX = this.renderData.loraX[1];
        posX += innerMargin;
        ctx.fill(new Path2D(`M ${posX} ${midY} l ${arrowWidth} ${arrowHeight / 2} l 0 -${arrowHeight} L ${posX} ${midY} z`));
        this.renderData.strengthArrowLessX[0] = posX;
        this.renderData.strengthArrowLessX[1] = posX + arrowWidth;
        posX = this.renderData.strengthArrowLessX[1];
        posX += innerMargin;
        ctx.textAlign = "center";
        ctx.fillText(fitString(ctx, ((_a = this.value.strength) !== null && _a !== void 0 ? _a : 1).toFixed(2), strengthValueWidth), posX + strengthValueWidth / 2, midY);
        this.renderData.strengthX[0] = posX;
        this.renderData.strengthX[1] = posX + strengthValueWidth;
        posX = this.renderData.strengthX[1];
        posX += innerMargin;
        ctx.fill(new Path2D(`M ${posX} ${midY - arrowHeight / 2} l ${arrowWidth} ${arrowHeight / 2} l -${arrowWidth} ${arrowHeight / 2} v -${arrowHeight} z`));
        this.renderData.strengthArrowMoreX[0] = posX;
        this.renderData.strengthArrowMoreX[1] = posX + arrowWidth;
        posX = this.renderData.strengthArrowMoreX[1];
        ctx.globalAlpha = app.canvas.editor_alpha;
        ctx.restore();
    }
    serializeValue(serializedNode, widgetIndex) {
        return this.value;
    }
    onMouseDown(event, pos, node) {
        var _a, _b;
        const bounds = this.renderData;
        this.isDownOnStrength = false;
        this.haveMouseMovedStrength = false;
        if (pos[0] >= bounds.toggleX[0] && pos[0] <= bounds.toggleX[1]) {
            this.value.on = !this.value.on;
            this.cancelMouseDown();
        }
        else if (pos[0] >= bounds.loraX[0] && pos[0] <= bounds.loraX[1]) {
            showLoraChooser(event, (value) => {
                if (typeof value === "string") {
                    this.value.lora = value;
                }
                node.setDirtyCanvas(true, true);
            });
            this.cancelMouseDown();
        }
        else if (pos[0] >= bounds.strengthArrowLessX[0] && pos[0] <= bounds.strengthArrowLessX[1]) {
            let strength = ((_a = this.value.strength) !== null && _a !== void 0 ? _a : 1) - 0.05;
            this.value.strength = Math.round(strength * 100) / 100;
        }
        else if (pos[0] >= bounds.strengthArrowMoreX[0] && pos[0] <= bounds.strengthArrowMoreX[1]) {
            let strength = ((_b = this.value.strength) !== null && _b !== void 0 ? _b : 1) + 0.05;
            this.value.strength = Math.round(strength * 100) / 100;
        }
        if (pos[0] >= bounds.strengthArrowLessX[0] && pos[0] <= bounds.strengthArrowMoreX[1]) {
            this.isDownOnStrength = true;
        }
    }
    onMouseUp(event, pos, node) {
        const canvas = app.canvas;
        const bounds = this.renderData;
        if (!this.haveMouseMovedStrength &&
            pos[0] >= bounds.strengthX[0] &&
            pos[0] <= bounds.strengthX[1]) {
            canvas.prompt("Value", this.value.strength, (v) => {
                this.value.strength = Number(v);
            }, event);
        }
    }
    onMouseMove(event, pos, node) {
        let step = 0.5;
        if (this.isDownOnStrength && event.deltaX) {
            this.haveMouseMovedStrength = true;
            this.value.strength += event.deltaX * 0.1 * step;
        }
    }
}
const NODE_CLASS = RgthreePowerLoraLoader;
app.registerExtension({
    name: "rgthree.PowerLoraLoader",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === NODE_CLASS.type) {
            NODE_CLASS.nodeType = nodeType;
            NODE_CLASS.nodeData = nodeData;
            NODE_CLASS.setUp(nodeType);
        }
    },
});
