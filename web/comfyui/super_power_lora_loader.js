import { app } from "../../scripts/app.js";
import { NodeTypesString } from "./constants.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { addConnectionLayoutSupport } from "./utils.js";
import { rgthree } from "./rgthree.js";
import { rgthreeApi } from "../../rgthree/common/rgthree_api.js";
import { showLoraChooser, showTemplateChooser } from "./utils_menu.js";
import { moveArrayItem, removeArrayItem } from "../../rgthree/common/shared_utils.js";
import { drawNumberWidgetPart, drawRoundedRectangle, drawTogglePart, fitString, isLowQuality } from "./utils_canvas.js";
import { RgthreeBaseWidget, RgthreeBetterButtonWidget } from "./utils_widgets.js";

// Re‑use existing strength settings from base; only add trigger words + templates.
const PROP_LABEL_SHOW_STRENGTHS = "Show Strengths";
const PROP_LABEL_SHOW_STRENGTHS_STATIC = `@${PROP_LABEL_SHOW_STRENGTHS}`;
const PROP_VALUE_SHOW_STRENGTHS_SINGLE = "Single Strength";
const PROP_VALUE_SHOW_STRENGTHS_SEPARATE = "Separate Model & Clip";
const PROP_LABEL_SHOW_TRIGGER_WORDS = "Show Trigger Words";
const PROP_LABEL_SHOW_TRIGGER_WORDS_STATIC = `@${PROP_LABEL_SHOW_TRIGGER_WORDS}`;

// Settings constants
const PROP_LABEL_ENABLE_TAGS = "Enable Tags";
const PROP_LABEL_ENABLE_TAGS_STATIC = `@${PROP_LABEL_ENABLE_TAGS}`;
const PROP_LABEL_ENABLE_SORTING = "Enable Sorting";
const PROP_LABEL_ENABLE_SORTING_STATIC = `@${PROP_LABEL_ENABLE_SORTING}`;
const PROP_LABEL_ENABLE_TEMPLATES = "Enable Templates";
const PROP_LABEL_ENABLE_TEMPLATES_STATIC = `@${PROP_LABEL_ENABLE_TEMPLATES}`;
const PROP_LABEL_ENABLE_DELETION = "Enable LoRA Deletion";
const PROP_LABEL_ENABLE_DELETION_STATIC = `@${PROP_LABEL_ENABLE_DELETION}`;

class RgthreeSuperPowerLoraLoader extends RgthreeBaseServerNode {
    constructor(title = NODE_CLASS.title) {
        super(title);
        this.serialize_widgets = true;
        this.logger = rgthree.newLogSession("[Super Power Lora Loader]");
        this.loraWidgetsCounter = 0;
        // Initialize settings with tags disabled by default
        this.properties[PROP_LABEL_ENABLE_TAGS_STATIC] = false;
        this.properties[PROP_LABEL_ENABLE_SORTING_STATIC] = true;
        this.properties[PROP_LABEL_ENABLE_TEMPLATES_STATIC] = true;
        this.properties[PROP_LABEL_ENABLE_DELETION_STATIC] = true;
        this.widgetButtonSpacer = null;
        this.properties[PROP_LABEL_SHOW_STRENGTHS] = this.properties[PROP_LABEL_SHOW_STRENGTHS] || PROP_VALUE_SHOW_STRENGTHS_SINGLE;
        if (this.properties[PROP_LABEL_SHOW_TRIGGER_WORDS] === undefined) this.properties[PROP_LABEL_SHOW_TRIGGER_WORDS] = false;
        rgthreeApi.getLoras();
    }

    configure(info) {
        // Rebuild widgets similarly to base node configure but include trigger/template features.
        let hadId = !!info.id;
        if (hadId) super.configure(info);
        this._tempWidth = this.size[0];
        this._tempHeight = this.size[1];
        // Remove existing
        while (this.widgets?.length) this.removeWidget(0);
        this.widgetButtonSpacer = null;

        // Collect LoRA values
        let loraValues = [];
        for (const widgetValue of info.widgets_values || []) {
            if (widgetValue?.lora !== undefined) {
                loraValues.push({ ...widgetValue });
            }
        }

        // Group by tag only if tags are enabled
        if (this.properties[PROP_LABEL_ENABLE_TAGS_STATIC]) {
            let grouped = {};
            for (const v of loraValues) {
                const tag = v.tag || "General";
                if (!grouped[tag]) grouped[tag] = [];
                grouped[tag].push(v);
            }

            // Sort tags, General first (only if sorting is enabled)
            let sortedTags = Object.keys(grouped);
            if (this.properties[PROP_LABEL_ENABLE_SORTING_STATIC] !== false) {
                sortedTags = sortedTags.sort((a, b) => a === "General" ? -1 : b === "General" ? 1 : a.localeCompare(b));
            }

            // Add headers and LoRAs
            for (const tag of sortedTags) {
                // Add header
                const header = new SuperPowerLoraTagHeaderWidget(tag);
                this.addCustomWidget(header);
                // Add LoRAs
                for (const v of grouped[tag]) {
                    const widget = new SuperPowerLoraLoaderWidget("lora_" + (++this.loraWidgetsCounter));
                    widget.value = v;
                    this.addCustomWidget(widget);
                }
            }
        } else {
            // Tags disabled - just add LoRAs in original order without headers
            for (const v of loraValues) {
                const widget = new SuperPowerLoraLoaderWidget("lora_" + (++this.loraWidgetsCounter));
                widget.value = v;
                this.addCustomWidget(widget);
            }
        }

        this.addNonLoraWidgets();
        this._augmentSuperUI();
        this.size[0] = this._tempWidth;
        this.size[1] = Math.max(this._tempHeight, this.computeSize()[1]);
        this._ensureMinWidth();
    }

    onNodeCreated() {
        super.onNodeCreated?.();
        this.addNonLoraWidgets();
        this._augmentSuperUI();
        const computed = this.computeSize();
        this.size[0] = Math.max(this.size[0], computed[0]);
        this.size[1] = Math.max(this.size[1], computed[1]);
        this._ensureMinWidth();
        this.setDirtyCanvas(true,true);
    }

    addNonLoraWidgets() {
        // Basic structural widgets similar to base (divider + header placeholder + spacer + add button)
        if (!this.widgets.find(w=>w.value?.type === "SuperPowerLoraLoaderHeaderWidget")) {
            this.addCustomWidget(new SuperPowerLoraLoaderHeaderWidget());
        }
        if (!this.widgets.find(w=>w.name === "➕ Add Lora")) {
            this.widgetButtonSpacer = this.addCustomWidget(new RgthreeBetterButtonWidget("➕ Add Lora", (event)=>{
                rgthreeApi.getLoras().then(details => {
                    const loras = details.map(l=>l.file);
                    showLoraChooser(event, (value)=>{
                        if (typeof value === "string" && value !== "NONE" && !value.includes("Power Lora Chooser")) {
                            this.addNewLoraWidget(value);
                            const computed = this.computeSize();
                            this.size[1] = Math.max((this._tempHeight ?? 15), computed[1]);
                            this.setDirtyCanvas(true,true);
                        }
                    }, null, [...loras]);
                });
                return true;
            }));
        }
    }

    _ensureMinWidth() {
        const minWidth = this.properties[PROP_LABEL_SHOW_TRIGGER_WORDS] ? 450 : 250;
        this.size[0] = Math.max(this.size[0], minWidth);
    }

    _augmentSuperUI() {
        // Remove any previous super header and template buttons to keep idempotent.
        this.widgets = this.widgets.filter(w => !(
            w instanceof SuperPowerLoraLoaderHeaderWidget ||
            w.name === "💾 Save Template" ||
            w.name === "📂 Load Template" ||
            w.name === "⚙️ Settings"
        ));
        // Replace base header (identified by its value.type) with super header.
        const headerIndex = this.widgets.findIndex(w => w?.value?.type === "PowerLoraLoaderHeaderWidget");
        if (headerIndex !== -1) {
            this.widgets.splice(headerIndex, 1, new SuperPowerLoraLoaderHeaderWidget());
        } else {
            // Insert near top (after first widget if it's a divider/spacer)
            this.widgets.splice(0, 0, new SuperPowerLoraLoaderHeaderWidget());
        }
        
        // Add gear icon settings widget right after header
        const newHeaderIdx = this.widgets.findIndex(w => w instanceof SuperPowerLoraLoaderHeaderWidget);
        if (newHeaderIdx >= 0) {
            this.widgets.splice(newHeaderIdx + 1, 0, new RgthreeBetterButtonWidget("⚙️ Settings", (event) => {
                this.showSettingsMenu(event);
                return true;
            }));
        }
        // Add template buttons only if templates are enabled
        if (this.properties[PROP_LABEL_ENABLE_TEMPLATES_STATIC] !== false) {
            const addIdx = this.widgets.findIndex(w => w.name === "➕ Add Lora");
            const insertAt = addIdx >= 0 ? addIdx + 1 : this.widgets.length;
            this.widgets.splice(insertAt, 0, new RgthreeBetterButtonWidget("💾 Save Template", () => {
                app.canvas.prompt("Template name", "My Lora Set", (name) => {
                    if (!name) return;
                    const items = this.widgets.filter(w => w.name?.startsWith("lora_")).map(w => ({ 
                        ...w.value, 
                        tag: w.value.tag || "General" // Ensure tag is always saved
                    })).filter(v => v && v.lora && v.lora !== "None");
                    rgthreeApi.savePowerLoraTemplate(name, items);
                });
                return true;
            }));
            this.widgets.splice(insertAt + 1, 0, new RgthreeBetterButtonWidget("📂 Load Template", (event) => {
                showTemplateChooser(event, (selected) => {
                    if (typeof selected === "string" && selected !== "NONE") {
                        rgthreeApi.getPowerLoraTemplates(selected).then(resp => {
                            const tpl = resp && resp.items ? resp : null;
                            if (!tpl) return;
                            // Remove existing lora widgets
                            [...this.widgets].forEach(w => { if (w.name?.startsWith("lora_")) this.removeWidget(this.widgets.indexOf(w)); });
                            tpl.items.forEach(it => { 
                                const w = this.addNewLoraWidget(); 
                                // Ensure backward compatibility - add missing tag
                                w.value = { ...it, tag: it.tag || "General" }; 
                            });
                            // Force rebuild of tag headers and widget grouping
                            this.configure(this.serialize());
                            this.size[1] = Math.max((this._tempHeight ?? 15), this.computeSize()[1]);
                            this.setDirtyCanvas(true, true);
                        });
                    }
                });
                return true;
            }));
        }
    }

        addNewLoraWidget(lora) {
            this.loraWidgetsCounter++;
            const widget = this.addCustomWidget(new SuperPowerLoraLoaderWidget("lora_"+this.loraWidgetsCounter));
            if (lora) widget.setLora(lora);
            
            // Ensure General header exists
            if (!this.widgets.some(w => w instanceof SuperPowerLoraTagHeaderWidget && w.tag === "General")) {
                const header = new SuperPowerLoraTagHeaderWidget("General");
                // Insert at the beginning (before any other headers or widgets)
                let insertIndex = 0;
                // Skip past the main header widget if it exists
                if (this.widgets[0]?.value?.type === "SuperPowerLoraLoaderHeaderWidget") {
                    insertIndex = 1;
                }
                this.widgets.splice(insertIndex, 0, header);
            }
            
            // Move to correct group
            this.moveWidgetToCorrectGroup(widget);
            return widget;
        }

        hasLoraWidgets() { return !!this.widgets?.find(w=>w.name?.startsWith("lora_")); }
        allLorasState() {
            let allOn = true, allOff = true;
            for (const w of this.widgets) if (w.name?.startsWith("lora_")) { const on = w.value?.on; allOn = allOn && on===true; allOff = allOff && on===false; if(!allOn && !allOff) return null; }
            return allOn && this.widgets?.length ? true : false;
        }
        toggleAllLoras() { const allOn = this.allLorasState(); const to = !allOn; for (const w of this.widgets) if (w.name?.startsWith("lora_") && w.value?.on != null) w.value.on = to; }

        showSettingsMenu(event) {
            const menuItems = [
                {
                    content: `${this.properties[PROP_LABEL_ENABLE_TAGS_STATIC] ? "✅" : "❌"} Enable Tags`,
                    callback: () => {
                        this.properties[PROP_LABEL_ENABLE_TAGS_STATIC] = !this.properties[PROP_LABEL_ENABLE_TAGS_STATIC];
                        this.configure(this.serialize());
                        this.setDirtyCanvas(true, true);
                    }
                },
                {
                    content: `${this.properties[PROP_LABEL_ENABLE_SORTING_STATIC] ? "✅" : "❌"} Enable Sorting`,
                    callback: () => {
                        this.properties[PROP_LABEL_ENABLE_SORTING_STATIC] = !this.properties[PROP_LABEL_ENABLE_SORTING_STATIC];
                        this.configure(this.serialize());
                        this.setDirtyCanvas(true, true);
                    }
                },
                {
                    content: `${this.properties[PROP_LABEL_ENABLE_TEMPLATES_STATIC] ? "✅" : "❌"} Enable Templates`,
                    callback: () => {
                        this.properties[PROP_LABEL_ENABLE_TEMPLATES_STATIC] = !this.properties[PROP_LABEL_ENABLE_TEMPLATES_STATIC];
                        this.configure(this.serialize());
                        this.setDirtyCanvas(true, true);
                    }
                },
                {
                    content: `${this.properties[PROP_LABEL_ENABLE_DELETION_STATIC] ? "✅" : "❌"} Enable LoRA Deletion`,
                    callback: () => {
                        this.properties[PROP_LABEL_ENABLE_DELETION_STATIC] = !this.properties[PROP_LABEL_ENABLE_DELETION_STATIC];
                        this.setDirtyCanvas(true, true);
                    }
                }
            ];
            
            new LiteGraph.ContextMenu(menuItems, {
                event: event,
                title: "Settings",
                parentMenu: null
            });
        }
        getTriggerWords() { const out=[]; for (const w of this.widgets) if (w.name?.startsWith("lora_") && w.value?.on && w.value?.triggerWord) { const t=w.value.triggerWord.trim(); if(t) out.push(t); } return out.join(", "); }

        getSlotMenuOptions(slot) {
            if (slot.widget?.name?.startsWith("lora_")) {
                const widget = slot.widget;
                const menuItems = [];
                
                // Only show tag options if tags are enabled
                if (this.properties[PROP_LABEL_ENABLE_TAGS_STATIC]) {
                    menuItems.push({
                        content: `Assign Tag`,
                        callback: () => {
                            // Get existing tags
                            const existingTags = new Set(this.widgets.filter(w => w instanceof SuperPowerLoraTagHeaderWidget).map(w => w.tag));
                            const commonTags = ["General", "Character", "Style", "Quality", "Effect"];
                            const allTags = new Set([...commonTags, ...existingTags]);
                            const menuItems = [];
                            // Add all tags
                            for (const tag of allTags) {
                                menuItems.push({ content: tag, callback: () => widget.setTag(tag) });
                            }
                            menuItems.push(null);
                            menuItems.push({
                                content: "Custom...",
                                callback: () => {
                                    const canvas = app.canvas;
                                    canvas.prompt("Custom Tag", widget.value.tag || "General", (v) => widget.setTag(v || "General"));
                                }
                            });
                            new LiteGraph.ContextMenu(menuItems, { event: rgthree.lastCanvasMouseEvent });
                        },
                    });
                    menuItems.push(null);
                }
                
                menuItems.push({
                    content: `${widget.value.on ? "⚫" : "🟢"} Toggle ${widget.value.on ? "Off" : "On"}`,
                    callback: () => {
                        widget.value.on = !widget.value.on;
                    },
                });
                
                // Show move options if sorting is enabled (independent of tags)
                if (this.properties[PROP_LABEL_ENABLE_SORTING_STATIC] !== false) {
                    menuItems.push({
                        content: `⬆️ Move Up`,
                        disabled: !this.canMoveWidgetUp(widget),
                        callback: () => {
                            this.moveWidgetUp(widget);
                        },
                    });
                    menuItems.push({
                        content: `⬇️ Move Down`,
                        disabled: !this.canMoveWidgetDown(widget),
                        callback: () => {
                            this.moveWidgetDown(widget);
                        },
                    });
                }
                
                // Only show delete option if deletion is enabled
                if (this.properties[PROP_LABEL_ENABLE_DELETION_STATIC] !== false) {
                    menuItems.push({
                        content: `🗑️ Remove`,
                        callback: () => {
                            removeArrayItem(this.widgets, widget);
                            const computed = this.computeSize();
                            this.size[1] = Math.max((this._tempHeight ?? 15), computed[1]);
                            this.setDirtyCanvas(true, true);
                        },
                    });
                }
                
                new LiteGraph.ContextMenu(menuItems, {
                    title: "LORA WIDGET",
                    event: rgthree.lastCanvasMouseEvent,
                });
                return undefined;
            }
            return this.defaultGetSlotMenuOptions(slot);
        }

        canMoveWidgetUp(widget) {
            const index = this.widgets.indexOf(widget);
            const prev = this.widgets[index - 1];
            
            // If tags are enabled, only allow moving within the same tag
            if (this.properties[PROP_LABEL_ENABLE_TAGS_STATIC]) {
                return prev && prev.name?.startsWith("lora_") && prev.value?.tag === widget.value?.tag;
            } else {
                // If tags are disabled, allow moving among any LoRA widgets
                return prev && prev.name?.startsWith("lora_");
            }
        }

        canMoveWidgetDown(widget) {
            const index = this.widgets.indexOf(widget);
            const next = this.widgets[index + 1];
            
            // If tags are enabled, only allow moving within the same tag
            if (this.properties[PROP_LABEL_ENABLE_TAGS_STATIC]) {
                return next && next.name?.startsWith("lora_") && next.value?.tag === widget.value?.tag;
            } else {
                // If tags are disabled, allow moving among any LoRA widgets
                return next && next.name?.startsWith("lora_");
            }
        }

        moveWidgetUp(widget) {
            const index = this.widgets.indexOf(widget);
            if (this.canMoveWidgetUp(widget)) {
                moveArrayItem(this.widgets, widget, index - 1);
                this.setDirtyCanvas(true, true);
            }
        }

        moveWidgetDown(widget) {
            const index = this.widgets.indexOf(widget);
            if (this.canMoveWidgetDown(widget)) {
                moveArrayItem(this.widgets, widget, index + 1);
                this.setDirtyCanvas(true, true);
            }
        }

        moveWidgetToCorrectGroup(widget) {
            // Only do grouping if tags are enabled
            if (!this.properties[PROP_LABEL_ENABLE_TAGS_STATIC]) {
                return;
            }
            
            const tag = widget.value.tag || "General";
            
            // Check if header exists for this tag
            if (!this.widgets.some(w => w instanceof SuperPowerLoraTagHeaderWidget && w.tag === tag)) {
                // Create header
                const header = new SuperPowerLoraTagHeaderWidget(tag);
                // Find correct position for header based on sorted order
                const existingHeaders = this.widgets.filter(w => w instanceof SuperPowerLoraTagHeaderWidget);
                const allTags = existingHeaders.map(h => h.tag);
                allTags.push(tag);
                allTags.sort((a, b) => a === "General" ? -1 : b === "General" ? 1 : a.localeCompare(b));
                
                const targetIndex = allTags.indexOf(tag);
                let insertIndex = 0;
                
                if (targetIndex > 0 && existingHeaders.length > 0) {
                    const prevTag = allTags[targetIndex - 1];
                    const prevHeader = existingHeaders.find(h => h.tag === prevTag);
                    if (prevHeader) {
                        insertIndex = this.widgets.indexOf(prevHeader) + 1;
                        // Skip past all loras in the previous group
                        while (insertIndex < this.widgets.length && 
                               this.widgets[insertIndex].name?.startsWith("lora_")) {
                            insertIndex++;
                        }
                    }
                }
                
                this.widgets.splice(insertIndex, 0, header);
            }
            
            // Now move the widget to its group
            const headerIndex = this.widgets.findIndex(w => w instanceof SuperPowerLoraTagHeaderWidget && w.tag === tag);
            if (headerIndex !== -1) {
                // Find the end of this group
                let insertIndex = headerIndex + 1;
                while (insertIndex < this.widgets.length && 
                       this.widgets[insertIndex].name?.startsWith("lora_") &&
                       this.widgets[insertIndex] !== widget) {
                    insertIndex++;
                }
                
                const currentIndex = this.widgets.indexOf(widget);
                if (currentIndex !== -1 && insertIndex !== currentIndex) {
                    moveArrayItem(this.widgets, widget, insertIndex > currentIndex ? insertIndex - 1 : insertIndex);
                }
            }
        }

        computeSize() {
            const baseSize = super.computeSize();
            let height = 0;
            for (const widget of this.widgets) {
                height += widget.computeSize ? widget.computeSize()[1] : 20;
            }
            return [baseSize[0], height];
        }

        static setUp(comfyClass, nodeData) { RgthreeBaseServerNode.registerForOverride(comfyClass, nodeData, NODE_CLASS); }
        static onRegisteredForOverride(comfyClass, ctxClass) { addConnectionLayoutSupport(NODE_CLASS, app, [["Left","Right"],["Right","Left"]]); setTimeout(()=>{ NODE_CLASS.category = comfyClass.category; }); }
}

RgthreeSuperPowerLoraLoader.title = NodeTypesString.SUPER_POWER_LORA_LOADER;
RgthreeSuperPowerLoraLoader.type = NodeTypesString.SUPER_POWER_LORA_LOADER;
RgthreeSuperPowerLoraLoader.comfyClass = NodeTypesString.SUPER_POWER_LORA_LOADER; // Bind to alias backend
RgthreeSuperPowerLoraLoader[PROP_LABEL_SHOW_TRIGGER_WORDS_STATIC] = { type: "boolean", default: false };
RgthreeSuperPowerLoraLoader[PROP_LABEL_SHOW_STRENGTHS_STATIC] = { type: "combo", values: [PROP_VALUE_SHOW_STRENGTHS_SINGLE, PROP_VALUE_SHOW_STRENGTHS_SEPARATE] };

class SuperPowerLoraLoaderHeaderWidget extends RgthreeBaseWidget {
    constructor(name = "SuperPowerLoraLoaderHeaderWidget") {
        super(name);
        this.value = { type: "SuperPowerLoraLoaderHeaderWidget" };
        this.type = "custom";
        this.hitAreas = {
            toggle: { bounds: [0,0], onDown: this.onToggleDown },
            triggerToggle: { bounds: [0,0], onDown: this.onTriggerToggleDown }
        };
        this.showModelAndClip = null;
    }
    draw(ctx, node, w, posY, height) {
        if (!node.hasLoraWidgets()) return;
        this.showModelAndClip = node.properties[PROP_LABEL_SHOW_STRENGTHS] === PROP_VALUE_SHOW_STRENGTHS_SEPARATE;
        const margin = 10; const innerMargin = margin * 0.33; const lowQuality = isLowQuality();
        const allLoraState = node.allLorasState();
        posY += 2; const midY = posY + height * 0.5; let posX = 10;
        ctx.save();
        this.hitAreas.toggle.bounds = drawTogglePart(ctx, { posX, posY, height, value: allLoraState });
        if (!lowQuality) {
            posX += this.hitAreas.toggle.bounds[1] + innerMargin;
            ctx.globalAlpha = app.canvas.editor_alpha * 0.55;
            ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
            ctx.textAlign = "left"; ctx.textBaseline = "middle";
            ctx.fillText("Toggle All", posX, midY);
            const showTriggerWords = node.properties[PROP_LABEL_SHOW_TRIGGER_WORDS];
            // Strength labels on right
            let rposX = node.size[0] - margin - innerMargin - innerMargin;
            ctx.textAlign = "center";
            ctx.fillText(this.showModelAndClip ? "Clip" : "Strength", rposX - drawNumberWidgetPart.WIDTH_TOTAL / 2, midY);
            if (this.showModelAndClip) {
                rposX = rposX - drawNumberWidgetPart.WIDTH_TOTAL - innerMargin * 2;
                ctx.fillText("Model", rposX - drawNumberWidgetPart.WIDTH_TOTAL / 2, midY);
            }
            // Trigger words toggle near middle
            const triggerToggleX = node.size[0] * 0.5 - 40;
            this.hitAreas.triggerToggle.bounds = drawTogglePart(ctx, { posX: triggerToggleX, posY, height, value: showTriggerWords });
            ctx.textAlign = "left"; ctx.fillText("Trigger Words", triggerToggleX + this.hitAreas.triggerToggle.bounds[1] + innerMargin, midY);
        }
        ctx.restore();
    }
    onToggleDown(event, pos, node) { node.toggleAllLoras(); this.cancelMouseDown(); return true; }
    onTriggerToggleDown(event, pos, node) { node.properties[PROP_LABEL_SHOW_TRIGGER_WORDS] = !node.properties[PROP_LABEL_SHOW_TRIGGER_WORDS]; node._ensureMinWidth?.(); node.setDirtyCanvas(true,true); this.cancelMouseDown(); return true; }
}

class SuperPowerLoraTagHeaderWidget extends RgthreeBaseWidget {
    constructor(tag) {
        super("tag_header_" + tag);
        this.tag = tag;
        this.serialize = false;
        this.value = { type: "SuperPowerLoraTagHeaderWidget", tag: tag };
        this.type = "custom";
        this.hitAreas = {
            toggle: { bounds: [0,0], onDown: this.onToggleDown },
        };
    }
    draw(ctx, node, w, posY, height) {
        const margin = 10;
        const innerMargin = margin * 0.33;
        const midY = posY + height * 0.5;
        let posX = margin;
        ctx.save();
        
        // Check if all LoRAs in this tag are enabled
        const lorasInTag = node.widgets.filter(w => w.name?.startsWith("lora_") && w.value?.tag === this.tag);
        const allEnabled = lorasInTag.length > 0 && lorasInTag.every(w => w.value?.on === true);
        
        // Enable/disable toggle first (consistent with other toggles)
        this.hitAreas.toggle.bounds = drawTogglePart(ctx, { posX, posY, height, value: allEnabled });
        posX += this.hitAreas.toggle.bounds[1] + innerMargin;
        
        // Tag name after toggle
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(this.tag, posX, midY);
        posX += ctx.measureText(this.tag).width + innerMargin;
        
        // Draw separator line
        const availableWidth = node.size[0] - posX - margin;
        if (availableWidth > 20) { // Only draw if there's enough space
            ctx.globalAlpha = app.canvas.editor_alpha * 0.3;
            ctx.strokeStyle = LiteGraph.WIDGET_TEXT_COLOR;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]); // Dashed line
            ctx.beginPath();
            ctx.moveTo(posX, midY);
            ctx.lineTo(node.size[0] - margin, midY);
            ctx.stroke();
            ctx.setLineDash([]); // Reset line dash
        }
        
        ctx.restore();
    }
    onToggleDown(event, pos, node) {
        // Find all LoRAs in this tag
        const lorasInTag = node.widgets.filter(w => w.name?.startsWith("lora_") && w.value?.tag === this.tag);
        
        if (lorasInTag.length === 0) {
            this.cancelMouseDown();
            return true;
        }
        
        // Check current state - if all are on, turn them off, otherwise turn them all on
        const allEnabled = lorasInTag.every(w => w.value?.on === true);
        const newState = !allEnabled;
        
        // Apply to all LoRAs in this tag
        lorasInTag.forEach(w => {
            if (w.value) {
                w.value.on = newState;
            }
        });
        
        node.setDirtyCanvas(true, true);
        this.cancelMouseDown();
        return true;
    }
}

const DEFAULT_LORA_WIDGET_DATA = { on: true, lora: null, triggerWord: "", strength: 1, strengthTwo: null, tag: "General" };
class SuperPowerLoraLoaderWidget extends RgthreeBaseWidget {
    constructor(name) {
        super(name);
        this.type = "custom";
        this.haveMouseMovedStrength = false;
        this.showModelAndClip = null;
        this.hitAreas = {
            toggle: { bounds: [0,0], onDown: this.onToggleDown },
            tag: { bounds: [0,0], onClick: this.onTagClick },
            lora: { bounds: [0,0], onClick: this.onLoraClick },
            triggerWord: { bounds: [0,0], onClick: this.onTriggerWordClick },
            remove: { bounds: [0,0], onClick: this.onRemoveClick },
            moveUp: { bounds: [0,0], onClick: this.onMoveUpClick },
            moveDown: { bounds: [0,0], onClick: this.onMoveDownClick },
            strengthDec: { bounds: [0,0], onClick: this.onStrengthDecDown },
            strengthVal: { bounds: [0,0], onClick: this.onStrengthValUp },
            strengthInc: { bounds: [0,0], onClick: this.onStrengthIncDown },
            strengthAny: { bounds: [0,0], onMove: this.onStrengthAnyMove },
            strengthTwoDec: { bounds: [0,0], onClick: this.onStrengthTwoDecDown },
            strengthTwoVal: { bounds: [0,0], onClick: this.onStrengthTwoValUp },
            strengthTwoInc: { bounds: [0,0], onClick: this.onStrengthTwoIncDown },
            strengthTwoAny: { bounds: [0,0], onMove: this.onStrengthTwoAnyMove },
        };
        this._value = { ...DEFAULT_LORA_WIDGET_DATA };
    }
    set value(v) {
        this._value = v;
        if (typeof this._value !== "object") {
            this._value = { ...DEFAULT_LORA_WIDGET_DATA };
            if (this.showModelAndClip) this._value.strengthTwo = this._value.strength;
        }
        if (!this._value.tag) this._value.tag = "General";
    }
    get value() { return this._value; }
    setLora(lora) { this._value.lora = lora; }
    draw(ctx, node, w, posY, height) {
        this.node = node; // Store reference to node
        const currentShowModelAndClip = node.properties[PROP_LABEL_SHOW_STRENGTHS] === PROP_VALUE_SHOW_STRENGTHS_SEPARATE;
        if (this.showModelAndClip !== currentShowModelAndClip) {
            const old = this.showModelAndClip; this.showModelAndClip = currentShowModelAndClip;
            if (this.showModelAndClip) { if (old != null) this.value.strengthTwo = this.value.strength ?? 1; }
            else { this.value.strengthTwo = null; ["strengthTwoDec","strengthTwoVal","strengthTwoInc","strengthTwoAny"].forEach(k => this.hitAreas[k].bounds = [0,-1]); }
        }
        ctx.save();
        const margin = 10, innerMargin = margin * 0.33, lowQuality = isLowQuality(), midY = posY + height * 0.5; let posX = margin;
        drawRoundedRectangle(ctx, { pos: [posX,posY], size: [node.size[0]-margin*2,height] });
        this.hitAreas.toggle.bounds = drawTogglePart(ctx, { posX, posY, height, value: this.value.on });
        posX += this.hitAreas.toggle.bounds[1] + innerMargin;
        
        // Tag icon - only show if tags are enabled
        if (node.properties[PROP_LABEL_ENABLE_TAGS_STATIC]) {
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText("🏷️", posX, midY);
            this.hitAreas.tag.bounds = [posX, ctx.measureText("🏷️").width];
            posX += this.hitAreas.tag.bounds[1] + innerMargin;
        } else {
            this.hitAreas.tag.bounds = [0, -1]; // Hide hit area
        }
        if (lowQuality) { ctx.restore(); return; }
        if (!this.value.on) ctx.globalAlpha = app.canvas.editor_alpha * 0.4;
        ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
        let rposX = node.size[0] - margin - innerMargin - innerMargin;
        let removeWidth = 0;
        
        // Remove button - only show if deletion is enabled
        if (node.properties[PROP_LABEL_ENABLE_DELETION_STATIC] !== false) {
            const removeIconSize = height * 0.66; 
            removeWidth = removeIconSize + innerMargin; 
            ctx.textAlign = "right"; 
            ctx.textBaseline = "middle"; 
            ctx.fillText("✖", node.size[0]-margin-innerMargin, midY); 
            this.hitAreas.remove.bounds = [node.size[0]-margin-innerMargin-removeIconSize, removeWidth];
        } else {
            this.hitAreas.remove.bounds = [0, -1]; // Hide hit area
        }
        // Move arrows - show if sorting is enabled (independent of tags)
        let moveWidth = 0;
        if (node.properties[PROP_LABEL_ENABLE_SORTING_STATIC] !== false) {
            const moveIconSize = height * 0.66; 
            moveWidth = moveIconSize*2 + innerMargin; 
            const arrowsRightEdge = node.size[0]-margin-innerMargin-removeWidth-innerMargin;
            ctx.textAlign = "center"; 
            const downCenterX = arrowsRightEdge - moveIconSize*0.5; 
            const upCenterX = downCenterX - moveIconSize - innerMargin;
            const widgets = node.widgets; 
            const index = widgets.indexOf(this);
            const canMoveUp = !!(widgets[index-1]?.name?.startsWith("lora_"));
            const canMoveDown = !!(widgets[index+1]?.name?.startsWith("lora_"));
            const prevA = ctx.globalAlpha; 
            ctx.globalAlpha = prevA * (canMoveUp?1:0.35); 
            ctx.fillText("▲", upCenterX, midY); 
            ctx.globalAlpha = prevA * (canMoveDown?1:0.35); 
            ctx.fillText("▼", downCenterX, midY); 
            ctx.globalAlpha = prevA;
            this.hitAreas.moveUp.bounds = [upCenterX - moveIconSize*0.5, moveIconSize];
            this.hitAreas.moveDown.bounds = [downCenterX - moveIconSize*0.5, moveIconSize];
        } else {
            this.hitAreas.moveUp.bounds = [0, -1]; // Hide hit areas
            this.hitAreas.moveDown.bounds = [0, -1];
        }
        const strengthValue = this.showModelAndClip ? (this.value.strengthTwo ?? 1) : (this.value.strength ?? 1);
        const [leftArrow, text, rightArrow] = drawNumberWidgetPart(ctx, { posX: node.size[0]-margin-innerMargin-innerMargin-removeWidth-innerMargin-moveWidth-innerMargin, posY, height, value: strengthValue, direction: -1 });
        this.hitAreas.strengthDec.bounds = leftArrow; this.hitAreas.strengthVal.bounds = text; this.hitAreas.strengthInc.bounds = rightArrow; this.hitAreas.strengthAny.bounds = [leftArrow[0], rightArrow[0]+rightArrow[1]-leftArrow[0]]; rposX = leftArrow[0] - innerMargin;
        if (this.showModelAndClip) {
            rposX -= innerMargin;
            this.hitAreas.strengthTwoDec.bounds = this.hitAreas.strengthDec.bounds;
            this.hitAreas.strengthTwoVal.bounds = this.hitAreas.strengthVal.bounds;
            this.hitAreas.strengthTwoInc.bounds = this.hitAreas.strengthInc.bounds;
            this.hitAreas.strengthTwoAny.bounds = this.hitAreas.strengthAny.bounds;
            const [l2,t2,r2] = drawNumberWidgetPart(ctx, { posX: rposX, posY, height, value: (this.value.strength ?? 1), direction: -1 });
            this.hitAreas.strengthDec.bounds = l2; this.hitAreas.strengthVal.bounds = t2; this.hitAreas.strengthInc.bounds = r2; this.hitAreas.strengthAny.bounds = [l2[0], r2[0]+r2[1]-l2[0]]; rposX = l2[0] - innerMargin;
        }
        const showTriggerWords = node.properties[PROP_LABEL_SHOW_TRIGGER_WORDS];
        ctx.textAlign = "left"; ctx.textBaseline = "middle";
        if (showTriggerWords) {
            const availableWidth = rposX - posX - innerMargin; const loraWidth = Math.max(100, availableWidth*0.6); const triggerWidth = availableWidth - loraWidth - innerMargin;
            const loraLabel = String(this.value?.lora || "None"); ctx.fillText(fitString(ctx, loraLabel, loraWidth), posX, midY); this.hitAreas.lora.bounds = [posX, loraWidth]; posX += loraWidth + innerMargin;
            const triggerWord = String(this.value?.triggerWord || ""); ctx.globalAlpha = app.canvas.editor_alpha; ctx.fillStyle = triggerWord ? LiteGraph.WIDGET_TEXT_COLOR : "rgba(255,255,255,0.5)"; const displayText = triggerWord || "trigger word..."; ctx.fillText(fitString(ctx, displayText, triggerWidth), posX, midY); this.hitAreas.triggerWord.bounds = [posX, triggerWidth];
        } else {
            const availableWidth = rposX - posX; const loraLabel = String(this.value?.lora || "None"); ctx.fillText(fitString(ctx, loraLabel, availableWidth), posX, midY); this.hitAreas.lora.bounds = [posX, availableWidth]; this.hitAreas.triggerWord.bounds = [0,-1];
        }
        ctx.restore();
    }
    serializeValue(node, index) { const v = { ...this.value }; if (!this.showModelAndClip) delete v.strengthTwo; else v.strengthTwo = this.value.strengthTwo ?? 1; return v; }
    onToggleDown() { this.value.on = !this.value.on; this.cancelMouseDown(); return true; }
    onTagClick(event) {
        // Only show tag menu if tags are enabled
        if (!this.node.properties[PROP_LABEL_ENABLE_TAGS_STATIC]) {
            return;
        }
        
        // Get existing tags
        const existingTags = new Set(this.node.widgets.filter(w => w instanceof SuperPowerLoraTagHeaderWidget).map(w => w.tag));
        const commonTags = ["General", "Character", "Style", "Quality", "Effect"];
        const allTags = new Set([...commonTags, ...existingTags]);
        const menuItems = [];
        // Add all tags
        for (const tag of allTags) {
            menuItems.push({ content: tag, callback: () => this.setTag(tag) });
        }
        menuItems.push(null);
        menuItems.push({
            content: "Custom...",
            callback: () => {
                const canvas = app.canvas;
                canvas.prompt("Custom Tag", this.value.tag || "General", (v) => this.setTag(v || "General"), event);
            }
        });
        new LiteGraph.ContextMenu(menuItems, { event });
        this.cancelMouseDown();
    }
    setTag(tag) {
        this.value.tag = tag;
        
        // Only create headers and move widgets if tags are enabled
        if (!this.node.properties[PROP_LABEL_ENABLE_TAGS_STATIC]) {
            this.node.setDirtyCanvas(true, true);
            return;
        }
        
        // Check if header exists for this tag
        if (!this.node.widgets.some(w => w instanceof SuperPowerLoraTagHeaderWidget && w.tag === tag)) {
            // Create header
            const header = new SuperPowerLoraTagHeaderWidget(tag);
            // Find position for header
            const headerWidgets = this.node.widgets.filter(w => w instanceof SuperPowerLoraTagHeaderWidget);
            const headerTags = headerWidgets.map(w => w.tag);
            headerTags.push(tag);
            headerTags.sort((a, b) => a === "General" ? -1 : b === "General" ? 1 : a.localeCompare(b));
            const pos = headerTags.indexOf(tag);
            let insertIndex = 0;
            if (pos < headerWidgets.length) {
                insertIndex = this.node.widgets.indexOf(headerWidgets[pos]);
            } else {
                // After last header
                const lastHeader = headerWidgets[headerWidgets.length - 1];
                insertIndex = this.node.widgets.indexOf(lastHeader) + 1;
                // Skip LoRAs in the last group
                while (insertIndex < this.node.widgets.length && this.node.widgets[insertIndex].name?.startsWith("lora_")) {
                    insertIndex++;
                }
            }
            this.node.widgets.splice(insertIndex, 0, header);
        }
        this.node.moveWidgetToCorrectGroup(this);
        this.node.setDirtyCanvas(true, true);
    }
        onMoveUpClick(event,pos,node) { node = node || this.node; if(!node) return true; const widgets = node.widgets; const index = widgets.indexOf(this); const canMoveUp = !!(widgets[index-1]?.name?.startsWith("lora_")); if (canMoveUp) { moveArrayItem(widgets, this, index-1); node.setDirtyCanvas(true,true);} this.cancelMouseDown(); return true; }
        onMoveDownClick(event,pos,node) { node = node || this.node; if(!node) return true; const widgets = node.widgets; const index = widgets.indexOf(this); const canMoveDown = !!(widgets[index+1]?.name?.startsWith("lora_")); if (canMoveDown) { moveArrayItem(widgets, this, index+1); node.setDirtyCanvas(true,true);} this.cancelMouseDown(); return true; }
        onRemoveClick(event,pos,node) { node = node || this.node; if(!node) return true; const widgets = node.widgets; removeArrayItem(widgets, this); const computed = node.computeSize && node.computeSize(); if (computed) node.size[1] = Math.max((node._tempHeight ?? 15), computed[1]); node.setDirtyCanvas(true,true); this.cancelMouseDown(); return true; }
    onLoraClick(event) { showLoraChooser(event, (value) => { if (typeof value === "string") { this.value.lora = value; this.node.setDirtyCanvas(true,true);} }); this.cancelMouseDown(); }
        onTriggerWordClick(event,pos,node) {
            const canvas = app.canvas;
            const parentNode = node || this.node;
            canvas.prompt("Trigger Word", this.value.triggerWord || "", (v)=> {
                this.value.triggerWord = v;
                parentNode?.setDirtyCanvas(true,true);
            }, event);
            this.cancelMouseDown();
        }
    onStrengthDecDown() { this.stepStrength(-1,false); }
    onStrengthIncDown() { this.stepStrength(1,false); }
    onStrengthTwoDecDown() { this.stepStrength(-1,true); }
    onStrengthTwoIncDown() { this.stepStrength(1,true); }
    onStrengthAnyMove(event) { this.doOnStrengthAnyMove(event,false); }
    onStrengthTwoAnyMove(event) { this.doOnStrengthAnyMove(event,true); }
    doOnStrengthAnyMove(event,isTwo=false) { if (event.deltaX) { const prop = isTwo?"strengthTwo":"strength"; this.haveMouseMovedStrength = true; this.value[prop] = (this.value[prop] ?? 1) + event.deltaX * 0.05; } }
    onStrengthValUp(event) { this.doOnStrengthValUp(event,false); }
    onStrengthTwoValUp(event) { this.doOnStrengthValUp(event,true); }
    doOnStrengthValUp(event,isTwo=false) { if (this.haveMouseMovedStrength) return; const prop = isTwo?"strengthTwo":"strength"; const canvas = app.canvas; canvas.prompt("Value", this.value[prop], (v)=> this.value[prop]=Number(v), event); }
    onMouseUp(event,pos,node) { super.onMouseUp(event,pos,node); this.haveMouseMovedStrength = false; }
    stepStrength(direction,isTwo=false) { const step=0.05; const prop=isTwo?"strengthTwo":"strength"; const strength=(this.value[prop] ?? 1)+step*direction; this.value[prop]=Math.round(strength*100)/100; }
}

const NODE_CLASS = RgthreeSuperPowerLoraLoader;
app.registerExtension({
    name: "rgthree.SuperPowerLoraLoader",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === NODE_CLASS.type) {
            NODE_CLASS.setUp(nodeType, nodeData);
        }
    }
});

