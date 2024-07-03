import { app } from "../../scripts/app.js";
import { drawNodeWidget, drawRoundedRectangle, fitString, isLowQuality } from "./utils_canvas.js";
export function drawLabelAndValue(ctx, label, value, width, posY, height, options) {
    var _a;
    const outerMargin = 15;
    const innerMargin = 10;
    const midY = posY + height / 2;
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
    const labelX = outerMargin + innerMargin + ((_a = options === null || options === void 0 ? void 0 : options.offsetLeft) !== null && _a !== void 0 ? _a : 0);
    ctx.fillText(label, labelX, midY);
    const valueXLeft = labelX + ctx.measureText(label).width + 7;
    const valueXRight = width - (outerMargin + innerMargin);
    ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
    ctx.textAlign = "right";
    ctx.fillText(fitString(ctx, value, valueXRight - valueXLeft), valueXRight, midY);
    ctx.restore();
}
export class RgthreeBaseWidget {
    constructor(name) {
        this.last_y = 0;
        this.mouseDowned = null;
        this.isMouseDownedAndOver = false;
        this.hitAreas = {};
        this.downedHitAreasForMove = [];
        this.name = name;
    }
    clickWasWithinBounds(pos, bounds) {
        let xStart = bounds[0];
        let xEnd = xStart + (bounds.length > 2 ? bounds[2] : bounds[1]);
        const clickedX = pos[0] >= xStart && pos[0] <= xEnd;
        if (bounds.length === 2) {
            return clickedX;
        }
        return clickedX && pos[1] >= bounds[1] && pos[1] <= bounds[1] + bounds[3];
    }
    mouse(event, pos, node) {
        var _a, _b, _c;
        const canvas = app.canvas;
        if (event.type == "pointerdown") {
            this.mouseDowned = [...pos];
            this.isMouseDownedAndOver = true;
            this.downedHitAreasForMove.length = 0;
            let anyHandled = false;
            for (const part of Object.values(this.hitAreas)) {
                if ((part.onDown || part.onMove) && this.clickWasWithinBounds(pos, part.bounds)) {
                    if (part.onMove) {
                        this.downedHitAreasForMove.push(part);
                    }
                    if (part.onDown) {
                        const thisHandled = part.onDown.apply(this, [event, pos, node, part]);
                        anyHandled = anyHandled || thisHandled == true;
                    }
                }
            }
            return (_a = this.onMouseDown(event, pos, node)) !== null && _a !== void 0 ? _a : anyHandled;
        }
        if (event.type == "pointerup") {
            if (!this.mouseDowned)
                return true;
            this.downedHitAreasForMove.length = 0;
            this.cancelMouseDown();
            let anyHandled = false;
            for (const part of Object.values(this.hitAreas)) {
                if (part.onUp && this.clickWasWithinBounds(pos, part.bounds)) {
                    const thisHandled = part.onUp.apply(this, [event, pos, node, part]);
                    anyHandled = anyHandled || thisHandled == true;
                }
            }
            return (_b = this.onMouseUp(event, pos, node)) !== null && _b !== void 0 ? _b : anyHandled;
        }
        if (event.type == "pointermove") {
            this.isMouseDownedAndOver = !!this.mouseDowned;
            if (this.mouseDowned &&
                (pos[0] < 15 ||
                    pos[0] > node.size[0] - 15 ||
                    pos[1] < this.last_y ||
                    pos[1] > this.last_y + LiteGraph.NODE_WIDGET_HEIGHT)) {
                this.isMouseDownedAndOver = false;
            }
            for (const part of this.downedHitAreasForMove) {
                part.onMove.apply(this, [event, pos, node, part]);
            }
            return (_c = this.onMouseMove(event, pos, node)) !== null && _c !== void 0 ? _c : true;
        }
        return false;
    }
    cancelMouseDown() {
        this.mouseDowned = null;
        this.isMouseDownedAndOver = false;
        this.downedHitAreasForMove.length = 0;
    }
    onMouseDown(event, pos, node) {
        return;
    }
    onMouseUp(event, pos, node) {
        return;
    }
    onMouseMove(event, pos, node) {
        return;
    }
}
export class RgthreeBetterButtonWidget extends RgthreeBaseWidget {
    constructor(name, mouseUpCallback) {
        super(name);
        this.value = "";
        this.mouseUpCallback = mouseUpCallback;
    }
    draw(ctx, node, width, y, height) {
        if (!isLowQuality() && !this.isMouseDownedAndOver) {
            drawRoundedRectangle(ctx, {
                width: width - 30 - 2,
                height,
                posY: y + 1,
                posX: 15 + 1,
                borderRadius: 4,
                colorBackground: "#000000aa",
                colorStroke: "#000000aa",
            });
        }
        drawRoundedRectangle(ctx, {
            width: width - 30,
            height,
            posY: y + (this.isMouseDownedAndOver ? 1 : 0),
            posX: 15,
            borderRadius: isLowQuality() ? 0 : 4,
            colorBackground: this.isMouseDownedAndOver ? "#444" : LiteGraph.WIDGET_BGCOLOR,
        });
        if (!isLowQuality()) {
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
            ctx.fillText(this.name, node.size[0] / 2, y + height / 2 + (this.isMouseDownedAndOver ? 1 : 0));
        }
    }
    onMouseUp(event, pos, node) {
        return this.mouseUpCallback(event, pos, node);
    }
}
export class RgthreeBetterTextWidget {
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }
    draw(ctx, node, width, y, height) {
        const widgetData = drawNodeWidget(ctx, { width, height, posY: y });
        if (!widgetData.lowQuality) {
            drawLabelAndValue(ctx, this.name, this.value, width, y, height);
        }
    }
    mouse(event, pos, node) {
        const canvas = app.canvas;
        if (event.type == "pointerdown") {
            canvas.prompt("Label", this.value, (v) => (this.value = v), event);
            return true;
        }
        return false;
    }
}
export class RgthreeDividerWidget {
    constructor(widgetOptions) {
        this.options = { serialize: false };
        this.value = null;
        this.name = "divider";
        this.widgetOptions = {
            marginTop: 7,
            marginBottom: 7,
            marginLeft: 15,
            marginRight: 15,
            color: LiteGraph.WIDGET_OUTLINE_COLOR,
            thickness: 1,
        };
        Object.assign(this.widgetOptions, widgetOptions || {});
    }
    draw(ctx, node, width, posY, h) {
        if (this.widgetOptions.thickness) {
            ctx.strokeStyle = this.widgetOptions.color;
            const x = this.widgetOptions.marginLeft;
            const y = posY + this.widgetOptions.marginTop;
            const w = width - this.widgetOptions.marginLeft - this.widgetOptions.marginRight;
            ctx.stroke(new Path2D(`M ${x} ${y} h ${w}`));
        }
    }
    computeSize(width) {
        return [
            width,
            this.widgetOptions.marginTop + this.widgetOptions.marginBottom + this.widgetOptions.thickness,
        ];
    }
}
export class RgthreeLabelWidget {
    constructor(name, widgetOptions) {
        this.options = { serialize: false };
        this.value = null;
        this.widgetOptions = {};
        this.posY = 0;
        this.name = name;
        Object.assign(this.widgetOptions, widgetOptions);
    }
    draw(ctx, node, width, posY, height) {
        this.posY = posY;
        ctx.save();
        ctx.textAlign = this.widgetOptions.align || "left";
        ctx.fillStyle = this.widgetOptions.color || LiteGraph.WIDGET_TEXT_COLOR;
        const oldFont = ctx.font;
        if (this.widgetOptions.italic) {
            ctx.font = "italic " + ctx.font;
        }
        if (this.widgetOptions.size) {
            ctx.font = ctx.font.replace(/\d+px/, `${this.widgetOptions.size}px`);
        }
        const midY = posY + height / 2;
        ctx.textBaseline = "middle";
        if (this.widgetOptions.align === "center") {
            ctx.fillText(this.name, node.size[0] / 2, midY);
        }
        else {
            ctx.fillText(this.name, 15, midY);
        }
        ctx.font = oldFont;
        if (this.widgetOptions.actionLabel === "__PLUS_ICON__") {
            const plus = new Path2D(`M${node.size[0] - 15 - 2} ${posY + 7} v4 h-4 v4 h-4 v-4 h-4 v-4 h4 v-4 h4 v4 h4 z`);
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.fillStyle = "#3a3";
            ctx.strokeStyle = "#383";
            ctx.fill(plus);
            ctx.stroke(plus);
        }
        ctx.restore();
    }
    mouse(event, nodePos, node) {
        if (event.type !== "pointerdown" ||
            isLowQuality() ||
            !this.widgetOptions.actionLabel ||
            !this.widgetOptions.actionCallback) {
            return false;
        }
        const pos = [nodePos[0], nodePos[1] - this.posY];
        const rightX = node.size[0] - 15;
        if (pos[0] > rightX || pos[0] < rightX - 16) {
            return false;
        }
        this.widgetOptions.actionCallback(event);
        return true;
    }
}
export class RgthreeToggleNavWidget {
    constructor(node, showNav, doModeChange) {
        this.node = node;
        this.showNav = showNav;
        this.doModeChange = doModeChange;
        this.name = "RGTHREE_TOGGLE_AND_NAV";
        this.label = "";
        this.value = false;
        this.disabled = false;
        this.options = { on: "yes", off: "no" };
    }
    callback(value, graphCanvas, node, pos, event) {
        this.doModeChange();
    }
    draw(ctx, node, width, posY, height) {
        const widgetData = drawNodeWidget(ctx, {
            width,
            height,
            posY,
        });
        let currentX = widgetData.width - widgetData.margin;
        if (!widgetData.lowQuality && this.showNav()) {
            currentX -= 7;
            const midY = widgetData.posY + widgetData.height * 0.5;
            ctx.fillStyle = ctx.strokeStyle = "#89A";
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            const arrow = new Path2D(`M${currentX} ${midY} l -7 6 v -3 h -7 v -6 h 7 v -3 z`);
            ctx.fill(arrow);
            ctx.stroke(arrow);
            currentX -= 14;
            currentX -= 7;
            ctx.strokeStyle = widgetData.colorOutline;
            ctx.stroke(new Path2D(`M ${currentX} ${widgetData.posY} v ${widgetData.height}`));
        }
        else if (widgetData.lowQuality && this.showNav()) {
            currentX -= 28;
        }
        currentX -= 7;
        ctx.fillStyle = this.value ? "#89A" : "#333";
        ctx.beginPath();
        const toggleRadius = height * 0.36;
        ctx.arc(currentX - toggleRadius, posY + height * 0.5, toggleRadius, 0, Math.PI * 2);
        ctx.fill();
        currentX -= toggleRadius * 2;
        if (!widgetData.lowQuality) {
            currentX -= 4;
            ctx.textAlign = "right";
            ctx.fillStyle = this.value ? widgetData.colorText : widgetData.colorTextSecondary;
            const label = this.label || this.name;
            const toggleLabelOn = this.options.on || "true";
            const toggleLabelOff = this.options.off || "false";
            ctx.fillText(this.value ? toggleLabelOn : toggleLabelOff, currentX, posY + height * 0.7);
            currentX -= Math.max(ctx.measureText(toggleLabelOn).width, ctx.measureText(toggleLabelOff).width);
            currentX -= 7;
            ctx.textAlign = "left";
            let maxLabelWidth = widgetData.width - widgetData.margin - 10 - (widgetData.width - currentX);
            if (label != null) {
                ctx.fillText(fitString(ctx, label, maxLabelWidth), widgetData.margin + 10, posY + height * 0.7);
            }
        }
    }
    serializeValue(serializedNode, widgetIndex) {
        return this.value;
    }
    mouse(event, pos, selfNode) {
        var _a, _b;
        if (event.type == "pointerdown") {
            if (this.showNav() && pos[0] >= selfNode.size[0] - 15 - 28 - 1) {
                const canvas = app.canvas;
                const lowQuality = (((_a = canvas.ds) === null || _a === void 0 ? void 0 : _a.scale) || 1) <= 0.5;
                if (!lowQuality) {
                    canvas.centerOnNode(this.node);
                    const zoomCurrent = ((_b = canvas.ds) === null || _b === void 0 ? void 0 : _b.scale) || 1;
                    const zoomX = canvas.canvas.width / this.node.size[0] - 0.02;
                    const zoomY = canvas.canvas.height / this.node.size[1] - 0.02;
                    canvas.setZoom(Math.min(zoomCurrent, zoomX, zoomY), [
                        canvas.canvas.width / 2,
                        canvas.canvas.height / 2,
                    ]);
                    canvas.setDirty(true, true);
                }
            }
            else {
                this.value = !this.value;
                setTimeout(() => {
                    var _a;
                    (_a = this.callback) === null || _a === void 0 ? void 0 : _a.call(this, this.value, app.canvas, selfNode, pos, event);
                }, 20);
            }
        }
        return true;
    }
}
