var _a;
import { app } from "../../scripts/app.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
import { addConnectionLayoutSupport } from "./utils.js";
import { NodeTypesString } from "./constants.js";
import { drawInfoIcon, drawNumberWidgetPart, drawRoundedRectangle, drawTogglePart, fitString, isLowQuality, } from "./utils_canvas.js";
import { RgthreeBaseWidget, RgthreeBetterButtonWidget, RgthreeDividerWidget, } from "./utils_widgets.js";
import { rgthreeApi } from "../../rgthree/common/rgthree_api.js";
import { showLoraChooser, showTemplateChooser } from "./utils_menu.js";
import { moveArrayItem, removeArrayItem } from "../../rgthree/common/shared_utils.js";
import { RgthreeLoraInfoDialog } from "./dialog_info.js";
import { LORA_INFO_SERVICE } from "../../rgthree/common/model_info_service.js";
const PROP_LABEL_SHOW_STRENGTHS = "Show Strengths";
const PROP_LABEL_SHOW_STRENGTHS_STATIC = `@${PROP_LABEL_SHOW_STRENGTHS}`;
const PROP_VALUE_SHOW_STRENGTHS_SINGLE = "Single Strength";
const PROP_VALUE_SHOW_STRENGTHS_SEPARATE = "Separate Model & Clip";
const PROP_LABEL_SHOW_TRIGGER_WORDS = "Show Trigger Words";
const PROP_LABEL_SHOW_TRIGGER_WORDS_STATIC = `@${PROP_LABEL_SHOW_TRIGGER_WORDS}`;
class RgthreePowerLoraLoader extends RgthreeBaseServerNode {
    constructor(title = NODE_CLASS.title) {
        super(title);
        this.serialize_widgets = true;
        this.logger = rgthree.newLogSession(`[Power Lora Stack]`);
        this.loraWidgetsCounter = 0;
        this.widgetButtonSpacer = null;
        this.properties[PROP_LABEL_SHOW_STRENGTHS] = PROP_VALUE_SHOW_STRENGTHS_SINGLE;
        this.properties[PROP_LABEL_SHOW_TRIGGER_WORDS] = false;
        rgthreeApi.getLoras();
    }
    configure(info) {
        var _b;
        while ((_b = this.widgets) === null || _b === void 0 ? void 0 : _b.length)
            this.removeWidget(0);
        this.widgetButtonSpacer = null;
        super.configure(info);
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
    }
    onNodeCreated() {
        var _b;
        (_b = super.onNodeCreated) === null || _b === void 0 ? void 0 : _b.call(this);
        this.addNonLoraWidgets();
        const computed = this.computeSize();
        this.size = this.size || [0, 0];
        const minWidth = this.properties[PROP_LABEL_SHOW_TRIGGER_WORDS] ? 450 : 250;
        this.size[0] = Math.max(this.size[0], computed[0], minWidth);
        this.size[1] = Math.max(this.size[1], computed[1]);
        this.setDirtyCanvas(true, true);
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
        moveArrayItem(this.widgets, this.addCustomWidget(new RgthreeDividerWidget({ marginTop: 4, marginBottom: 0, thickness: 0 })), 0);
        moveArrayItem(this.widgets, this.addCustomWidget(new PowerLoraLoaderHeaderWidget()), 1);
        this.widgetButtonSpacer = this.addCustomWidget(new RgthreeDividerWidget({ marginTop: 4, marginBottom: 0, thickness: 0 }));
        this.addCustomWidget(new RgthreeBetterButtonWidget("➕ Add Lora", (event, pos, node) => {
            rgthreeApi.getLoras().then((lorasDetails) => {
                const loras = lorasDetails.map((l) => l.file);
                showLoraChooser(event, (value) => {
                    var _b;
                    if (typeof value === "string") {
                        if (value.includes("Power Lora Chooser")) {
                        }
                        else if (value !== "NONE") {
                            this.addNewLoraWidget(value);
                            const computed = this.computeSize();
                            const tempHeight = (_b = this._tempHeight) !== null && _b !== void 0 ? _b : 15;
                            this.size[1] = Math.max(tempHeight, computed[1]);
                            this.setDirtyCanvas(true, true);
                        }
                    }
                }, null, [...loras]);
            });
            return true;
        }));
        this.addCustomWidget(new RgthreeBetterButtonWidget("💾 Save Template", (_event, _pos, node) => {
            // The ComfyUI prompt is asynchronous and returns the value via the callback (3rd arg).
            // We therefore need to do the work that depends on the name inside that callback.
            app.canvas.prompt(
                "Template name",
                "My Lora Set",
                (name) => {
                    if (!name)
                        return;
                    const items = this.widgets
                        .filter((w) => { var _b; return (_b = w.name) === null || _b === void 0 ? void 0 : _b.startsWith("lora_"); })
                        .map((w) => ({ ...w.value }))
                        .filter((v) => v && v.lora && v.lora !== "None");
                    rgthreeApi.savePowerLoraTemplate(name, items);
                }
            );
            return true;
        }));
        this.addCustomWidget(new RgthreeBetterButtonWidget("📂 Load Template", (event, _pos, node) => {
            showTemplateChooser(event, (selected) => {
                if (typeof selected === "string" && selected !== "NONE") {
                    console.log('Loading template:', selected);
                    rgthreeApi.getPowerLoraTemplates(selected).then((resp) => {
                        console.log('Template response:', resp);
                        // The response should be the template object directly when fetching by name
                        const tpl = resp && resp.items ? resp : null;
                        if (!tpl || !tpl.items) {
                            console.error('Invalid template response:', resp);
                            return;
                        }
                        const current = [...this.widgets];
                        for (const w of current) {
                            var _b;
                            if ((_b = w.name) === null || _b === void 0 ? void 0 : _b.startsWith("lora_")) {
                                this.removeWidget(this.widgets.indexOf(w));
                            }
                        }
                        for (const it of tpl.items) {
                            const widget = this.addNewLoraWidget();
                            widget.value = { ...it };
                        }
                        const computed = this.computeSize();
                        const tempHeight = (_b = this._tempHeight) !== null && _b !== void 0 ? _b : 15;
                        this.size[1] = Math.max(tempHeight, computed[1]);
                        this.setDirtyCanvas(true, true);
                    }).catch(error => {
                        console.error('Failed to load template:', error);
                    });
                }
            });
            return true;
        }));
    }
    getSlotInPosition(canvasX, canvasY) {
        var _b;
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
            if ((_b = lastWidget === null || lastWidget === void 0 ? void 0 : lastWidget.name) === null || _b === void 0 ? void 0 : _b.startsWith("lora_")) {
                return { widget: lastWidget, output: { type: "LORA WIDGET" } };
            }
        }
        return slot;
    }
    getSlotMenuOptions(slot) {
        var _b, _c, _d, _e, _f, _g;
        if ((_c = (_b = slot === null || slot === void 0 ? void 0 : slot.widget) === null || _b === void 0 ? void 0 : _b.name) === null || _c === void 0 ? void 0 : _c.startsWith("lora_")) {
            const widget = slot.widget;
            const index = this.widgets.indexOf(widget);
            const canMoveUp = !!((_e = (_d = this.widgets[index - 1]) === null || _d === void 0 ? void 0 : _d.name) === null || _e === void 0 ? void 0 : _e.startsWith("lora_"));
            const canMoveDown = !!((_g = (_f = this.widgets[index + 1]) === null || _f === void 0 ? void 0 : _f.name) === null || _g === void 0 ? void 0 : _g.startsWith("lora_"));
            const menuItems = [
                {
                    content: `ℹ️ Show Info`,
                    callback: () => {
                        widget.showLoraInfoDialog();
                    },
                },
                null,
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
                {
                    content: `🗑️ Remove`,
                    callback: () => {
                        removeArrayItem(this.widgets, widget);
                    },
                },
            ];
            new LiteGraph.ContextMenu(menuItems, {
                title: "LORA WIDGET",
                event: rgthree.lastCanvasMouseEvent,
            });
            return undefined;
        }
        return this.defaultGetSlotMenuOptions(slot);
    }
    refreshComboInNode(defs) {
        rgthreeApi.getLoras(true);
    }
    hasLoraWidgets() {
        var _b;
        return !!((_b = this.widgets) === null || _b === void 0 ? void 0 : _b.find((w) => { var _b; return (_b = w.name) === null || _b === void 0 ? void 0 : _b.startsWith("lora_"); }));
    }
    allLorasState() {
        var _b, _c, _d;
        let allOn = true;
        let allOff = true;
        for (const widget of this.widgets) {
            if ((_b = widget.name) === null || _b === void 0 ? void 0 : _b.startsWith("lora_")) {
                const on = (_c = widget.value) === null || _c === void 0 ? void 0 : _c.on;
                allOn = allOn && on === true;
                allOff = allOff && on === false;
                if (!allOn && !allOff) {
                    return null;
                }
            }
        }
        return allOn && ((_d = this.widgets) === null || _d === void 0 ? void 0 : _d.length) ? true : false;
    }
    toggleAllLoras() {
        var _b, _c;
        const allOn = this.allLorasState();
        const toggledTo = !allOn ? true : false;
        for (const widget of this.widgets) {
            if (((_b = widget.name) === null || _b === void 0 ? void 0 : _b.startsWith("lora_")) && ((_c = widget.value) === null || _c === void 0 ? void 0 : _c.on) != null) {
                widget.value.on = toggledTo;
            }
        }
    }
    getTriggerWords() {
        const triggerWords = [];
        for (const widget of this.widgets) {
            if (widget.name && widget.name.startsWith("lora_") && widget.value && widget.value.on && widget.value.triggerWord) {
                triggerWords.push(widget.value.triggerWord.trim());
            }
        }
        return triggerWords.filter(word => word.length > 0).join(", ");
    }
    static setUp(comfyClass, nodeData) {
        RgthreeBaseServerNode.registerForOverride(comfyClass, nodeData, NODE_CLASS);
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
    getHelp() {
        return `
      <p>
        The ${this.type.replace("(rgthree)", "")} is a powerful node that condenses 100s of pixels
        of functionality in a single, dynamic node that allows you to add loras, change strengths,
        and quickly toggle on/off all without taking up half your screen.
      </p>
      <ul>
        <li><p>
          Add as many Lora's as you would like by clicking the "+ Add Lora" button.
          There's no real limit!
        </p></li>
        <li><p>
          Click on the trigger word field for each lora to add activation words that will be 
          automatically combined and output as text for use with prompt nodes.
        </p></li>
        <li><p>
          Right-click on a Lora widget for special options to move the lora up or down
          (no image affect, only presentational), toggle it on/off, or delete the row all together.
        </p></li>
        <li>
          <p>
            <strong>Properties.</strong> You can change the following properties (by right-clicking
            on the node, and select "Properties" or "Properties Panel" from the menu):
          </p>
          <ul>
            <li><p>
              <code>${PROP_LABEL_SHOW_STRENGTHS}</code> - Change between showing a single, simple
              strength (which will be used for both model and clip), or a more advanced view with
              both model and clip strengths being modifiable.
            </p></li>
          </ul>
        </li>
      </ul>`;
    }
}
_a = PROP_LABEL_SHOW_STRENGTHS_STATIC;
RgthreePowerLoraLoader.title = NodeTypesString.POWER_LORA_LOADER;
RgthreePowerLoraLoader.type = NodeTypesString.POWER_LORA_LOADER;
RgthreePowerLoraLoader.comfyClass = NodeTypesString.POWER_LORA_LOADER;
RgthreePowerLoraLoader[_a] = {
    type: "combo",
    values: [PROP_VALUE_SHOW_STRENGTHS_SINGLE, PROP_VALUE_SHOW_STRENGTHS_SEPARATE],
};
RgthreePowerLoraLoader[PROP_LABEL_SHOW_TRIGGER_WORDS_STATIC] = {
    type: "boolean",
    default: false,
};
class PowerLoraLoaderHeaderWidget extends RgthreeBaseWidget {
    constructor(name = "PowerLoraLoaderHeaderWidget") {
        super(name);
        this.value = { type: "PowerLoraLoaderHeaderWidget" };
        this.type = "custom";
        this.hitAreas = {
            toggle: { bounds: [0, 0], onDown: this.onToggleDown },
            triggerToggle: { bounds: [0, 0], onDown: this.onTriggerToggleDown },
        };
        this.showModelAndClip = null;
    }
    draw(ctx, node, w, posY, height) {
        if (!node.hasLoraWidgets()) {
            return;
        }
        this.showModelAndClip =
            node.properties[PROP_LABEL_SHOW_STRENGTHS] === PROP_VALUE_SHOW_STRENGTHS_SEPARATE;
        const margin = 10;
        const innerMargin = margin * 0.33;
        const lowQuality = isLowQuality();
        const allLoraState = node.allLorasState();
        posY += 2;
        const midY = posY + height * 0.5;
        let posX = 10;
        ctx.save();
        this.hitAreas.toggle.bounds = drawTogglePart(ctx, { posX, posY, height, value: allLoraState });
        if (!lowQuality) {
            posX += this.hitAreas.toggle.bounds[1] + innerMargin;
            ctx.globalAlpha = app.canvas.editor_alpha * 0.55;
            ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText("Toggle All", posX, midY);
            
            // Check if trigger words are enabled
            const showTriggerWords = node.properties[PROP_LABEL_SHOW_TRIGGER_WORDS];
            
            if (showTriggerWords) {
                // Add labels for the columns when trigger words are enabled
                const availableWidth = node.size[0] - posX - margin * 4 - innerMargin * 6;
                const loraWidth = Math.max(100, availableWidth * 0.6);
                const triggerWidth = availableWidth - loraWidth - innerMargin;
                
                ctx.textAlign = "center";
                ctx.fillText("LoRA", posX + loraWidth / 2, midY);
                
                // Draw trigger words toggle and label
                const triggerLabelX = posX + loraWidth + innerMargin + triggerWidth / 2;
                const triggerToggleX = triggerLabelX - 60; // Position toggle to the left of label
                
                this.hitAreas.triggerToggle.bounds = drawTogglePart(ctx, { 
                    posX: triggerToggleX, 
                    posY: posY, 
                    height, 
                    value: showTriggerWords 
                });
                
                ctx.textAlign = "left";
                ctx.fillText("Trigger Words", triggerToggleX + this.hitAreas.triggerToggle.bounds[1] + innerMargin, midY);
            } else {
                // Just show "LoRA" label when trigger words are disabled
                ctx.textAlign = "center";
                const loraLabelX = posX + (node.size[0] - posX - margin * 4) / 2;
                ctx.fillText("LoRA", loraLabelX, midY);
                
                // Draw trigger words toggle (off state)
                const triggerToggleX = loraLabelX + 100;
                this.hitAreas.triggerToggle.bounds = drawTogglePart(ctx, { 
                    posX: triggerToggleX, 
                    posY: posY, 
                    height, 
                    value: false 
                });
                
                ctx.textAlign = "left";
                ctx.fillText("Trigger Words", triggerToggleX + this.hitAreas.triggerToggle.bounds[1] + innerMargin, midY);
            }
            
            let rposX = node.size[0] - margin - innerMargin - innerMargin;
            ctx.textAlign = "center";
            ctx.fillText(this.showModelAndClip ? "Clip" : "Strength", rposX - drawNumberWidgetPart.WIDTH_TOTAL / 2, midY);
            if (this.showModelAndClip) {
                rposX = rposX - drawNumberWidgetPart.WIDTH_TOTAL - innerMargin * 2;
                ctx.fillText("Model", rposX - drawNumberWidgetPart.WIDTH_TOTAL / 2, midY);
            }
        }
        ctx.restore();
    }
    onToggleDown(event, pos, node) {
        node.toggleAllLoras();
        this.cancelMouseDown();
        return true;
    }
    onTriggerToggleDown(event, pos, node) {
        node.properties[PROP_LABEL_SHOW_TRIGGER_WORDS] = !node.properties[PROP_LABEL_SHOW_TRIGGER_WORDS];
        node.setDirtyCanvas(true, true);
        this.cancelMouseDown();
        return true;
    }
}
const DEFAULT_LORA_WIDGET_DATA = {
    on: true,
    lora: null,
    triggerWord: "",
    strength: 1,
    strengthTwo: null,
};
class PowerLoraLoaderWidget extends RgthreeBaseWidget {
    constructor(name) {
        super(name);
        this.type = "custom";
        this.haveMouseMovedStrength = false;
        this.loraInfoPromise = null;
        this.loraInfo = null;
        this.showModelAndClip = null;
        this.hitAreas = {
            toggle: { bounds: [0, 0], onDown: this.onToggleDown },
            lora: { bounds: [0, 0], onClick: this.onLoraClick },
            triggerWord: { bounds: [0, 0], onClick: this.onTriggerWordClick },
            remove: { bounds: [0, 0], onClick: this.onRemoveClick },
            moveUp: { bounds: [0, 0], onClick: this.onMoveUpClick },
            moveDown: { bounds: [0, 0], onClick: this.onMoveDownClick },
            strengthDec: { bounds: [0, 0], onClick: this.onStrengthDecDown },
            strengthVal: { bounds: [0, 0], onClick: this.onStrengthValUp },
            strengthInc: { bounds: [0, 0], onClick: this.onStrengthIncDown },
            strengthAny: { bounds: [0, 0], onMove: this.onStrengthAnyMove },
            strengthTwoDec: { bounds: [0, 0], onClick: this.onStrengthTwoDecDown },
            strengthTwoVal: { bounds: [0, 0], onClick: this.onStrengthTwoValUp },
            strengthTwoInc: { bounds: [0, 0], onClick: this.onStrengthTwoIncDown },
            strengthTwoAny: { bounds: [0, 0], onMove: this.onStrengthTwoAnyMove },
        };
        this._value = {
            on: true,
            lora: null,
            triggerWord: "",
            strength: 1,
            strengthTwo: null,
        };
    }
    
    get minWidth() {
        const node = app.graph._nodes?.find(n => n.widgets?.includes(this));
        const showTriggerWords = node?.properties?.[PROP_LABEL_SHOW_TRIGGER_WORDS];
        return showTriggerWords ? 350 : 200;
    }
    set value(v) {
        this._value = v;
        if (typeof this._value !== "object") {
            this._value = { ...DEFAULT_LORA_WIDGET_DATA };
            if (this.showModelAndClip) {
                this._value.strengthTwo = this._value.strength;
            }
        }
        this.getLoraInfo();
    }
    get value() {
        return this._value;
    }
    setLora(lora) {
        this._value.lora = lora;
        this.getLoraInfo();
    }
    draw(ctx, node, w, posY, height) {
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        let currentShowModelAndClip = node.properties[PROP_LABEL_SHOW_STRENGTHS] === PROP_VALUE_SHOW_STRENGTHS_SEPARATE;
        let showTriggerWords = node.properties[PROP_LABEL_SHOW_TRIGGER_WORDS];
        
        if (this.showModelAndClip !== currentShowModelAndClip) {
            let oldShowModelAndClip = this.showModelAndClip;
            this.showModelAndClip = currentShowModelAndClip;
            if (this.showModelAndClip) {
                if (oldShowModelAndClip != null) {
                    this.value.strengthTwo = (_b = this.value.strength) !== null && _b !== void 0 ? _b : 1;
                }
            }
            else {
                this.value.strengthTwo = null;
                this.hitAreas.strengthTwoDec.bounds = [0, -1];
                this.hitAreas.strengthTwoVal.bounds = [0, -1];
                this.hitAreas.strengthTwoInc.bounds = [0, -1];
                this.hitAreas.strengthTwoAny.bounds = [0, -1];
            }
        }
        ctx.save();
        const margin = 10;
        const innerMargin = margin * 0.33;
        const lowQuality = isLowQuality();
        const midY = posY + height * 0.5;
        let posX = margin;
        drawRoundedRectangle(ctx, { pos: [posX, posY], size: [node.size[0] - margin * 2, height] });
        this.hitAreas.toggle.bounds = drawTogglePart(ctx, { posX, posY, height, value: this.value.on });
        posX += this.hitAreas.toggle.bounds[1] + innerMargin;
        if (lowQuality) {
            ctx.restore();
            return;
        }
        if (!this.value.on) {
            ctx.globalAlpha = app.canvas.editor_alpha * 0.4;
        }
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        let rposX = node.size[0] - margin - innerMargin - innerMargin;
        
        // Draw remove button
        const removeIconSize = height * 0.66;
        const removeWidth = removeIconSize + innerMargin;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        ctx.fillText("✖", node.size[0] - margin - innerMargin, midY);
        this.hitAreas.remove.bounds = [node.size[0] - margin - innerMargin - removeIconSize, removeWidth];
        
        // Draw move up/down arrows to reorder
        const moveIconSize = height * 0.66;
        const moveWidth = moveIconSize * 2 + innerMargin;
        const arrowsRightEdge = node.size[0] - margin - innerMargin - removeWidth - innerMargin;
        ctx.textAlign = "center";
        // Compute centers for up and down icons
        const downCenterX = arrowsRightEdge - moveIconSize * 0.5;
        const upCenterX = downCenterX - moveIconSize - innerMargin;
        
        // Determine if we can move up/down (only within contiguous lora widgets)
        const widgets = node.widgets;
        const index = widgets.indexOf(this);
        const canMoveUp = !!(widgets[index - 1] && widgets[index - 1].name && widgets[index - 1].name.startsWith("lora_"));
        const canMoveDown = !!(widgets[index + 1] && widgets[index + 1].name && widgets[index + 1].name.startsWith("lora_"));
        
        const previousAlpha = ctx.globalAlpha;
        ctx.globalAlpha = previousAlpha * (canMoveUp ? 1 : 0.35);
        ctx.fillText("▲", upCenterX, midY);
        ctx.globalAlpha = previousAlpha * (canMoveDown ? 1 : 0.35);
        ctx.fillText("▼", downCenterX, midY);
        ctx.globalAlpha = previousAlpha;
        
        // Set hit areas
        this.hitAreas.moveUp.bounds = [upCenterX - moveIconSize * 0.5, moveIconSize];
        this.hitAreas.moveDown.bounds = [downCenterX - moveIconSize * 0.5, moveIconSize];
        
        const strengthValue = this.showModelAndClip
            ? ((_c = this.value.strengthTwo) !== null && _c !== void 0 ? _c : 1)
            : ((_d = this.value.strength) !== null && _d !== void 0 ? _d : 1);
        let textColor = undefined;
        if (((_e = this.loraInfo) === null || _e === void 0 ? void 0 : _e.strengthMax) != null && strengthValue > ((_f = this.loraInfo) === null || _f === void 0 ? void 0 : _f.strengthMax)) {
            textColor = "#c66";
        }
        else if (((_g = this.loraInfo) === null || _g === void 0 ? void 0 : _g.strengthMin) != null && strengthValue < ((_h = this.loraInfo) === null || _h === void 0 ? void 0 : _h.strengthMin)) {
            textColor = "#c66";
        }
        const [leftArrow, text, rightArrow] = drawNumberWidgetPart(ctx, {
            posX: node.size[0] - margin - innerMargin - innerMargin - removeWidth - innerMargin - moveWidth - innerMargin,
            posY,
            height,
            value: strengthValue,
            direction: -1,
            textColor,
        });
        this.hitAreas.strengthDec.bounds = leftArrow;
        this.hitAreas.strengthVal.bounds = text;
        this.hitAreas.strengthInc.bounds = rightArrow;
        this.hitAreas.strengthAny.bounds = [leftArrow[0], rightArrow[0] + rightArrow[1] - leftArrow[0]];
        rposX = leftArrow[0] - innerMargin;
        if (this.showModelAndClip) {
            rposX -= innerMargin;
            this.hitAreas.strengthTwoDec.bounds = this.hitAreas.strengthDec.bounds;
            this.hitAreas.strengthTwoVal.bounds = this.hitAreas.strengthVal.bounds;
            this.hitAreas.strengthTwoInc.bounds = this.hitAreas.strengthInc.bounds;
            this.hitAreas.strengthTwoAny.bounds = this.hitAreas.strengthAny.bounds;
            let textColor = undefined;
            if (((_j = this.loraInfo) === null || _j === void 0 ? void 0 : _j.strengthMax) != null && this.value.strength > ((_k = this.loraInfo) === null || _k === void 0 ? void 0 : _k.strengthMax)) {
                textColor = "#c66";
            }
            else if (((_l = this.loraInfo) === null || _l === void 0 ? void 0 : _l.strengthMin) != null &&
                this.value.strength < ((_m = this.loraInfo) === null || _m === void 0 ? void 0 : _m.strengthMin)) {
                textColor = "#c66";
            }
            const [leftArrow, text, rightArrow] = drawNumberWidgetPart(ctx, {
                posX: rposX,
                posY,
                height,
                value: (_o = this.value.strength) !== null && _o !== void 0 ? _o : 1,
                direction: -1,
                textColor,
            });
            this.hitAreas.strengthDec.bounds = leftArrow;
            this.hitAreas.strengthVal.bounds = text;
            this.hitAreas.strengthInc.bounds = rightArrow;
            this.hitAreas.strengthAny.bounds = [
                leftArrow[0],
                rightArrow[0] + rightArrow[1] - leftArrow[0],
            ];
            rposX = leftArrow[0] - innerMargin;
        }
        const infoIconSize = height * 0.66;
        const infoWidth = infoIconSize + innerMargin + innerMargin;
        if (this.hitAreas["info"]) {
            rposX -= innerMargin;
            drawInfoIcon(ctx, rposX - infoIconSize, posY + (height - infoIconSize) / 2, infoIconSize);
            this.hitAreas.info.bounds = [rposX - infoIconSize, infoWidth];
            rposX = rposX - infoIconSize - innerMargin;
        }
        
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        
        if (showTriggerWords) {
            // Calculate available space and split between lora name and trigger word
            const availableWidth = rposX - posX - innerMargin;
            const loraWidth = Math.max(100, availableWidth * 0.6); // 60% for lora name, minimum 100px
            const triggerWidth = availableWidth - loraWidth - innerMargin;
            
            // Draw lora name
            const loraLabel = String(((_p = this.value) === null || _p === void 0 ? void 0 : _p.lora) || "None");
            ctx.fillText(fitString(ctx, loraLabel, loraWidth), posX, midY);
            this.hitAreas.lora.bounds = [posX, loraWidth];
            posX += loraWidth + innerMargin;
            
            // Draw trigger word field with background
            const triggerWord = String(((_q = this.value) === null || _q === void 0 ? void 0 : _q.triggerWord) || "");
            const triggerPadding = 4;
            
            // Draw trigger word background
            ctx.save();
            ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            ctx.fillRect(posX - triggerPadding, posY + triggerPadding, triggerWidth + triggerPadding * 2, height - triggerPadding * 2);
            ctx.restore();
            
            // Draw trigger word text
            ctx.fillStyle = triggerWord ? LiteGraph.WIDGET_TEXT_COLOR : "rgba(255, 255, 255, 0.5)";
            const displayText = triggerWord || "trigger word...";
            ctx.fillText(fitString(ctx, displayText, triggerWidth), posX, midY);
            this.hitAreas.triggerWord.bounds = [posX - triggerPadding, triggerWidth + triggerPadding * 2];
        } else {
            // Only show lora name when trigger words are disabled
            const availableWidth = rposX - posX;
            const loraLabel = String(((_p = this.value) === null || _p === void 0 ? void 0 : _p.lora) || "None");
            ctx.fillText(fitString(ctx, loraLabel, availableWidth), posX, midY);
            this.hitAreas.lora.bounds = [posX, availableWidth];
            
            // Disable trigger word hit area
            this.hitAreas.triggerWord.bounds = [0, -1];
        }
        
        ctx.globalAlpha = app.canvas.editor_alpha;
        ctx.restore();
    }
    serializeValue(node, index) {
        var _b;
        const v = { ...this.value };
        if (!this.showModelAndClip) {
            delete v.strengthTwo;
        }
        else {
            this.value.strengthTwo = (_b = this.value.strengthTwo) !== null && _b !== void 0 ? _b : 1;
            v.strengthTwo = this.value.strengthTwo;
        }
        return v;
    }
    onToggleDown(event, pos, node) {
        this.value.on = !this.value.on;
        this.cancelMouseDown();
        return true;
    }
    onMoveUpClick(event, pos, node) {
        const widgets = node.widgets;
        const index = widgets.indexOf(this);
        const canMoveUp = !!(widgets[index - 1] && widgets[index - 1].name && widgets[index - 1].name.startsWith("lora_"));
        if (canMoveUp) {
            moveArrayItem(widgets, this, index - 1);
            node.setDirtyCanvas(true, true);
        }
        this.cancelMouseDown();
        return true;
    }
    onMoveDownClick(event, pos, node) {
        const widgets = node.widgets;
        const index = widgets.indexOf(this);
        const canMoveDown = !!(widgets[index + 1] && widgets[index + 1].name && widgets[index + 1].name.startsWith("lora_"));
        if (canMoveDown) {
            moveArrayItem(widgets, this, index + 1);
            node.setDirtyCanvas(true, true);
        }
        this.cancelMouseDown();
        return true;
    }
    onRemoveClick(event, pos, node) {
        const widgets = node.widgets;
        removeArrayItem(widgets, this);
        const computed = node.computeSize && node.computeSize();
        if (computed) {
            node.size[1] = Math.max((node._tempHeight !== null && node._tempHeight !== void 0 ? node._tempHeight : 15), computed[1]);
        }
        node.setDirtyCanvas(true, true);
        this.cancelMouseDown();
        return true;
    }
    onInfoDown(event, pos, node) {
        this.showLoraInfoDialog();
    }
    onLoraClick(event, pos, node) {
        showLoraChooser(event, (value) => {
            if (typeof value === "string") {
                this.value.lora = value;
                this.loraInfo = null;
                this.getLoraInfo();
            }
            node.setDirtyCanvas(true, true);
        });
        this.cancelMouseDown();
    }
    onTriggerWordClick(event, pos, node) {
        const canvas = app.canvas;
        canvas.prompt("Trigger Word", this.value.triggerWord || "", (value) => {
            this.value.triggerWord = value;
            node.setDirtyCanvas(true, true);
        }, event);
        this.cancelMouseDown();
    }
    onStrengthDecDown(event, pos, node) {
        this.stepStrength(-1, false);
    }
    onStrengthIncDown(event, pos, node) {
        this.stepStrength(1, false);
    }
    onStrengthTwoDecDown(event, pos, node) {
        this.stepStrength(-1, true);
    }
    onStrengthTwoIncDown(event, pos, node) {
        this.stepStrength(1, true);
    }
    onStrengthAnyMove(event, pos, node) {
        this.doOnStrengthAnyMove(event, false);
    }
    onStrengthTwoAnyMove(event, pos, node) {
        this.doOnStrengthAnyMove(event, true);
    }
    doOnStrengthAnyMove(event, isTwo = false) {
        var _b;
        if (event.deltaX) {
            let prop = isTwo ? "strengthTwo" : "strength";
            this.haveMouseMovedStrength = true;
            this.value[prop] = ((_b = this.value[prop]) !== null && _b !== void 0 ? _b : 1) + event.deltaX * 0.05;
        }
    }
    onStrengthValUp(event, pos, node) {
        this.doOnStrengthValUp(event, false);
    }
    onStrengthTwoValUp(event, pos, node) {
        this.doOnStrengthValUp(event, true);
    }
    doOnStrengthValUp(event, isTwo = false) {
        if (this.haveMouseMovedStrength)
            return;
        let prop = isTwo ? "strengthTwo" : "strength";
        const canvas = app.canvas;
        canvas.prompt("Value", this.value[prop], (v) => (this.value[prop] = Number(v)), event);
    }
    onMouseUp(event, pos, node) {
        super.onMouseUp(event, pos, node);
        this.haveMouseMovedStrength = false;
    }
    showLoraInfoDialog() {
        if (!this.value.lora || this.value.lora === "None") {
            return;
        }
        const infoDialog = new RgthreeLoraInfoDialog(this.value.lora).show();
        infoDialog.addEventListener("close", ((e) => {
            if (e.detail.dirty) {
                this.getLoraInfo(true);
            }
        }));
    }
    stepStrength(direction, isTwo = false) {
        var _b;
        let step = 0.05;
        let prop = isTwo ? "strengthTwo" : "strength";
        let strength = ((_b = this.value[prop]) !== null && _b !== void 0 ? _b : 1) + step * direction;
        this.value[prop] = Math.round(strength * 100) / 100;
    }
    getLoraInfo(force = false) {
        if (!this.loraInfoPromise || force == true) {
            let promise;
            if (this.value.lora && this.value.lora != "None") {
                promise = LORA_INFO_SERVICE.getInfo(this.value.lora, force, true);
            }
            else {
                promise = Promise.resolve(null);
            }
            this.loraInfoPromise = promise.then((v) => (this.loraInfo = v));
        }
        return this.loraInfoPromise;
    }
}
const NODE_CLASS = RgthreePowerLoraLoader;
app.registerExtension({
    name: "rgthree.PowerLoraLoader",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === NODE_CLASS.type) {
            NODE_CLASS.setUp(nodeType, nodeData);
        }
    },
});
