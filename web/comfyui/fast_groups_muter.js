import { app } from "../../scripts/app.js";
import { RgthreeBaseVirtualNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
import { SERVICE as FAST_GROUPS_SERVICE } from "./services/fast_groups_service.js";
import { drawNodeWidget, fitString } from "./utils_canvas.js";
import { RgthreeBaseWidget } from "./utils_widgets.js";
import { changeModeOfNodes, getGroupNodes } from "./utils.js";
const PROPERTY_SORT = "sort";
const PROPERTY_SORT_CUSTOM_ALPHA = "customSortAlphabet";
const PROPERTY_MATCH_COLORS = "matchColors";
const PROPERTY_MATCH_TITLE = "matchTitle";
const PROPERTY_SHOW_NAV = "showNav";
const PROPERTY_SHOW_ALL_GRAPHS = "showAllGraphs";
const PROPERTY_RESTRICTION = "toggleRestriction";
const PROPERTY_MANUAL_ORDER = "manualOrder";
const SORT_MANUAL = "manual";
export class BaseFastGroupsModeChanger extends RgthreeBaseVirtualNode {
    constructor(title = FastGroupsMuter.title) {
        super(title);
        this.modeOn = LiteGraph.ALWAYS;
        this.modeOff = LiteGraph.NEVER;
        this.debouncerTempWidth = 0;
        this.tempSize = null;
        this.serialize_widgets = false;
        this.helpActions = "mute and unmute";
        this.properties[PROPERTY_MATCH_COLORS] = "";
        this.properties[PROPERTY_MATCH_TITLE] = "";
        this.properties[PROPERTY_SHOW_NAV] = true;
        this.properties[PROPERTY_SHOW_ALL_GRAPHS] = true;
        this.properties[PROPERTY_SORT] = "position";
        this.properties[PROPERTY_SORT_CUSTOM_ALPHA] = "";
        this.properties[PROPERTY_RESTRICTION] = "default";
        this.properties[PROPERTY_MANUAL_ORDER] = [];
        this.dragWidget = null;
        this.dragDropIndex = -1;
    }
    onConstructed() {
        this.addOutput("OPT_CONNECTION", "*");
        return super.onConstructed();
    }
    onAdded(graph) {
        FAST_GROUPS_SERVICE.addFastGroupNode(this);
    }
    onRemoved() {
        FAST_GROUPS_SERVICE.removeFastGroupNode(this);
    }
    refreshWidgets() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const canvas = app.canvas;
        let sort = ((_a = this.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_SORT]) || "position";
        let customAlphabet = null;
        if (sort === "custom alphabet") {
            const customAlphaStr = (_c = (_b = this.properties) === null || _b === void 0 ? void 0 : _b[PROPERTY_SORT_CUSTOM_ALPHA]) === null || _c === void 0 ? void 0 : _c.replace(/\n/g, "");
            if (customAlphaStr && customAlphaStr.trim()) {
                customAlphabet = customAlphaStr.includes(",")
                    ? customAlphaStr.toLocaleLowerCase().split(",")
                    : customAlphaStr.toLocaleLowerCase().trim().split("");
            }
            if (!(customAlphabet === null || customAlphabet === void 0 ? void 0 : customAlphabet.length)) {
                sort = "alphanumeric";
                customAlphabet = null;
            }
        }
        const groups = [...FAST_GROUPS_SERVICE.getGroups(sort)];
        if (customAlphabet === null || customAlphabet === void 0 ? void 0 : customAlphabet.length) {
            groups.sort((a, b) => {
                let aIndex = -1;
                let bIndex = -1;
                for (const [index, alpha] of customAlphabet.entries()) {
                    aIndex =
                        aIndex < 0 ? (a.title.toLocaleLowerCase().startsWith(alpha) ? index : -1) : aIndex;
                    bIndex =
                        bIndex < 0 ? (b.title.toLocaleLowerCase().startsWith(alpha) ? index : -1) : bIndex;
                    if (aIndex > -1 && bIndex > -1) {
                        break;
                    }
                }
                if (aIndex > -1 && bIndex > -1) {
                    const ret = aIndex - bIndex;
                    if (ret === 0) {
                        return a.title.localeCompare(b.title);
                    }
                    return ret;
                }
                else if (aIndex > -1) {
                    return -1;
                }
                else if (bIndex > -1) {
                    return 1;
                }
                return a.title.localeCompare(b.title);
            });
        }
        if (sort === SORT_MANUAL) {
            const order = (this.properties === null || this.properties === void 0 ? void 0 : this.properties[PROPERTY_MANUAL_ORDER]) || [];
            const rank = new Map();
            order.forEach((title, i) => rank.set(title, i));
            groups.sort((a, b) => {
                const ai = rank.has(a.title) ? rank.get(a.title) : Number.MAX_SAFE_INTEGER;
                const bi = rank.has(b.title) ? rank.get(b.title) : Number.MAX_SAFE_INTEGER;
                if (ai === bi) {
                    return 0;
                }
                return ai - bi;
            });
        }
        let filterColors = (((_e = (_d = this.properties) === null || _d === void 0 ? void 0 : _d[PROPERTY_MATCH_COLORS]) === null || _e === void 0 ? void 0 : _e.split(",")) || []).filter((c) => c.trim());
        if (filterColors.length) {
            filterColors = filterColors.map((color) => {
                color = color.trim().toLocaleLowerCase();
                if (LGraphCanvas.node_colors[color]) {
                    color = LGraphCanvas.node_colors[color].groupcolor;
                }
                color = color.replace("#", "").toLocaleLowerCase();
                if (color.length === 3) {
                    color = color.replace(/(.)(.)(.)/, "$1$1$2$2$3$3");
                }
                return `#${color}`;
            });
        }
        let index = 0;
        for (const group of groups) {
            if (filterColors.length) {
                let groupColor = (_f = group.color) === null || _f === void 0 ? void 0 : _f.replace("#", "").trim().toLocaleLowerCase();
                if (!groupColor) {
                    continue;
                }
                if (groupColor.length === 3) {
                    groupColor = groupColor.replace(/(.)(.)(.)/, "$1$1$2$2$3$3");
                }
                groupColor = `#${groupColor}`;
                if (!filterColors.includes(groupColor)) {
                    continue;
                }
            }
            if ((_h = (_g = this.properties) === null || _g === void 0 ? void 0 : _g[PROPERTY_MATCH_TITLE]) === null || _h === void 0 ? void 0 : _h.trim()) {
                try {
                    if (!new RegExp(this.properties[PROPERTY_MATCH_TITLE], "i").exec(group.title)) {
                        continue;
                    }
                }
                catch (e) {
                    console.error(e);
                    continue;
                }
            }
            const showAllGraphs = (_j = this.properties) === null || _j === void 0 ? void 0 : _j[PROPERTY_SHOW_ALL_GRAPHS];
            if (!showAllGraphs && group.graph !== app.canvas.getCurrentGraph()) {
                continue;
            }
            let isDirty = false;
            const widgetLabel = `Enable ${group.title}`;
            let widget = this.widgets.find((w) => w.label === widgetLabel);
            if (!widget) {
                this.tempSize = [...this.size];
                widget = this.addCustomWidget(new FastGroupsToggleRowWidget(group, this));
                this.setSize(this.computeSize());
                isDirty = true;
            }
            if (widget.label != widgetLabel) {
                widget.label = widgetLabel;
                isDirty = true;
            }
            if (group.rgthree_hasAnyActiveNode != null &&
                widget.toggled != group.rgthree_hasAnyActiveNode) {
                widget.toggled = group.rgthree_hasAnyActiveNode;
                isDirty = true;
            }
            if (this.widgets[index] !== widget) {
                const oldIndex = this.widgets.findIndex((w) => w === widget);
                this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]);
                isDirty = true;
            }
            if (isDirty) {
                this.setDirtyCanvas(true, false);
            }
            index++;
        }
        while ((this.widgets || [])[index]) {
            this.removeWidget(index++);
        }
    }
    computeSize(out) {
        let size = super.computeSize(out);
        if (this.tempSize) {
            size[0] = Math.max(this.tempSize[0], size[0]);
            size[1] = Math.max(this.tempSize[1], size[1]);
            this.debouncerTempWidth && clearTimeout(this.debouncerTempWidth);
            this.debouncerTempWidth = setTimeout(() => {
                this.tempSize = null;
            }, 32);
        }
        setTimeout(() => {
            var _a;
            (_a = this.graph) === null || _a === void 0 ? void 0 : _a.setDirtyCanvas(true, true);
        }, 16);
        return size;
    }
    getRowWidgets() {
        return (this.widgets || []).filter((w) => w instanceof FastGroupsToggleRowWidget);
    }
    commitManualOrder(from, to) {
        const rows = this.getRowWidgets();
        to = Math.max(0, Math.min(rows.length - 1, to));
        if (from < 0 || from >= rows.length || from === to) {
            this.setDirtyCanvas(true, false);
            return;
        }
        rows.splice(to, 0, rows.splice(from, 1)[0]);
        let r = 0;
        for (let i = 0; i < this.widgets.length; i++) {
            if (this.widgets[i] instanceof FastGroupsToggleRowWidget) {
                this.widgets[i] = rows[r++];
            }
        }
        this.properties[PROPERTY_SORT] = SORT_MANUAL;
        this.properties[PROPERTY_MANUAL_ORDER] = rows.map((w) => w.group.title);
        this.setDirtyCanvas(true, true);
    }
    async handleAction(action) {
        var _a, _b, _c, _d, _e;
        if (action === "Mute all" || action === "Bypass all") {
            const alwaysOne = ((_a = this.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_RESTRICTION]) === "always one";
            for (const [index, widget] of this.widgets.entries()) {
                widget === null || widget === void 0 ? void 0 : widget.doModeChange(alwaysOne && !index ? true : false, true);
            }
        }
        else if (action === "Enable all") {
            const onlyOne = (_b = this.properties) === null || _b === void 0 ? void 0 : _b[PROPERTY_RESTRICTION].includes(" one");
            for (const [index, widget] of this.widgets.entries()) {
                widget === null || widget === void 0 ? void 0 : widget.doModeChange(onlyOne && index > 0 ? false : true, true);
            }
        }
        else if (action === "Toggle all") {
            const onlyOne = (_c = this.properties) === null || _c === void 0 ? void 0 : _c[PROPERTY_RESTRICTION].includes(" one");
            let foundOne = false;
            for (const [index, widget] of this.widgets.entries()) {
                let newValue = onlyOne && foundOne ? false : !widget.value;
                foundOne = foundOne || newValue;
                widget === null || widget === void 0 ? void 0 : widget.doModeChange(newValue, true);
            }
            if (!foundOne && ((_d = this.properties) === null || _d === void 0 ? void 0 : _d[PROPERTY_RESTRICTION]) === "always one") {
                (_e = this.widgets[this.widgets.length - 1]) === null || _e === void 0 ? void 0 : _e.doModeChange(true, true);
            }
        }
    }
    getHelp() {
        return `
      <p>The ${this.type.replace("(rgthree)", "")} is an input-less node that automatically collects all groups in your current
      workflow and allows you to quickly ${this.helpActions} all nodes within the group.</p>
      <ul>
        <li>
          <p>
            <strong>Properties.</strong> You can change the following properties (by right-clicking
            on the node, and select "Properties" or "Properties Panel" from the menu):
          </p>
          <ul>
            <li><p>
              <code>${PROPERTY_MATCH_COLORS}</code> - Only add groups that match the provided
              colors. Can be ComfyUI colors (red, pale_blue) or hex codes (#a4d399). Multiple can be
              added, comma delimited.
            </p></li>
            <li><p>
              <code>${PROPERTY_MATCH_TITLE}</code> - Filter the list of toggles by title match
              (string match, or regular expression).
            </p></li>
            <li><p>
              <code>${PROPERTY_SHOW_NAV}</code> - Add / remove a quick navigation arrow to take you
              to the group. <i>(default: true)</i>
            </p></li>
            <li><p>
              <code>${PROPERTY_SHOW_ALL_GRAPHS}</code> - Show groups from all [sub]graphs in the
              workflow. <i>(default: true)</i>
            </p></li>
            <li><p>
              <code>${PROPERTY_SORT}</code> - Sort the toggles' order by "alphanumeric", graph
              "position", "custom alphabet", or "manual". <i>(default: "position")</i>
            </p>
            <p>
              <strong>Manual drag ordering:</strong> drag any row by its label (the left part of
              the row, away from the toggle and nav arrow) and drop it in a new position. The first
              drag automatically switches <code>${PROPERTY_SORT}</code> to "manual", and the order
              is saved with your workflow. Newly-added groups appear at the end until you place
              them.
            </p></li>
            <li>
              <p>
                <code>${PROPERTY_SORT_CUSTOM_ALPHA}</code> - When the
                <code>${PROPERTY_SORT}</code> property is "custom alphabet" you can define the
                alphabet to use here, which will match the <i>beginning</i> of each group name and
                sort against it. If group titles do not match any custom alphabet entry, then they
                will be put after groups that do, ordered alphanumerically.
              </p>
              <p>
                This can be a list of single characters, like "zyxw..." or comma delimited strings
                for more control, like "sdxl,pro,sd,n,p".
              </p>
              <p>
                Note, when two group title match the same custom alphabet entry, the <i>normal
                alphanumeric alphabet</i> breaks the tie. For instance, a custom alphabet of
                "e,s,d" will order groups names like "SDXL, SEGS, Detailer" eventhough the custom
                alphabet has an "e" before "d" (where one may expect "SE" to be before "SD").
              </p>
              <p>
                To have "SEGS" appear before "SDXL" you can use longer strings. For instance, the
                custom alphabet value of "se,s,f" would work here.
              </p>
            </li>
            <li><p>
              <code>${PROPERTY_RESTRICTION}</code> - Optionally, attempt to restrict the number of
              widgets that can be enabled to a maximum of one, or always one.
              </p>
              <p><em><strong>Note:</strong> If using "max one" or "always one" then this is only
              enforced when clicking a toggle on this node; if nodes within groups are changed
              outside of the initial toggle click, then these restriction will not be enforced, and
              could result in a state where more than one toggle is enabled. This could also happen
              if nodes are overlapped with multiple groups.
            </p></li>

          </ul>
        </li>
      </ul>`;
    }
}
BaseFastGroupsModeChanger.type = NodeTypesString.FAST_GROUPS_MUTER;
BaseFastGroupsModeChanger.title = NodeTypesString.FAST_GROUPS_MUTER;
BaseFastGroupsModeChanger.exposedActions = ["Mute all", "Enable all", "Toggle all"];
BaseFastGroupsModeChanger["@matchColors"] = { type: "string" };
BaseFastGroupsModeChanger["@matchTitle"] = { type: "string" };
BaseFastGroupsModeChanger["@showNav"] = { type: "boolean" };
BaseFastGroupsModeChanger["@showAllGraphs"] = { type: "boolean" };
BaseFastGroupsModeChanger["@sort"] = {
    type: "combo",
    values: ["position", "alphanumeric", "custom alphabet", "manual"],
};
BaseFastGroupsModeChanger["@customSortAlphabet"] = { type: "string" };
BaseFastGroupsModeChanger["@manualOrder"] = { type: "array" };
BaseFastGroupsModeChanger["@toggleRestriction"] = {
    type: "combo",
    values: ["default", "max one", "always one"],
};
export class FastGroupsMuter extends BaseFastGroupsModeChanger {
    constructor(title = FastGroupsMuter.title) {
        super(title);
        this.comfyClass = NodeTypesString.FAST_GROUPS_MUTER;
        this.helpActions = "mute and unmute";
        this.modeOn = LiteGraph.ALWAYS;
        this.modeOff = LiteGraph.NEVER;
        this.onConstructed();
    }
}
FastGroupsMuter.type = NodeTypesString.FAST_GROUPS_MUTER;
FastGroupsMuter.title = NodeTypesString.FAST_GROUPS_MUTER;
FastGroupsMuter.exposedActions = ["Bypass all", "Enable all", "Toggle all"];
class FastGroupsToggleRowWidget extends RgthreeBaseWidget {
    constructor(group, node) {
        super("RGTHREE_TOGGLE_AND_NAV");
        this.value = { toggled: false };
        this.options = { on: "yes", off: "no" };
        this.type = "custom";
        this.label = "";
        this.group = group;
        this.node = node;
        this.dragging = false;
        this.dragStartY = 0;
        this.dragStartIndex = -1;
        this.hitAreas = {
            drag: { bounds: [0, 0], onDown: this.onDragDown, onMove: this.onDragMove, onUp: this.onDragUp },
            toggle: { bounds: [0, 0], onClick: this.onToggleClick },
            nav: { bounds: [0, 0], onClick: this.onNavClick },
        };
    }
    doModeChange(force, skipOtherNodeCheck) {
        var _a, _b, _c, _d;
        this.group.recomputeInsideNodes();
        const hasAnyActiveNodes = getGroupNodes(this.group).some((n) => n.mode === LiteGraph.ALWAYS);
        let newValue = force != null ? force : !hasAnyActiveNodes;
        if (skipOtherNodeCheck !== true) {
            if (newValue && ((_b = (_a = this.node.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_RESTRICTION]) === null || _b === void 0 ? void 0 : _b.includes(" one"))) {
                for (const widget of this.node.widgets) {
                    if (widget instanceof FastGroupsToggleRowWidget) {
                        widget.doModeChange(false, true);
                    }
                }
            }
            else if (!newValue && ((_c = this.node.properties) === null || _c === void 0 ? void 0 : _c[PROPERTY_RESTRICTION]) === "always one") {
                newValue = this.node.widgets.every((w) => !w.value || w === this);
            }
        }
        changeModeOfNodes(getGroupNodes(this.group), (newValue ? this.node.modeOn : this.node.modeOff));
        this.group.rgthree_hasAnyActiveNode = newValue;
        this.toggled = newValue;
        (_d = this.group.graph) === null || _d === void 0 ? void 0 : _d.setDirtyCanvas(true, false);
    }
    get toggled() {
        return this.value.toggled;
    }
    set toggled(value) {
        this.value.toggled = value;
    }
    toggle(value) {
        value = value == null ? !this.toggled : value;
        if (value !== this.toggled) {
            this.value.toggled = value;
            this.doModeChange();
        }
    }
    draw(ctx, node, width, posY, height) {
        var _a;
        const fastNode = node;
        const isDragging = fastNode.dragWidget === this;
        if (isDragging) {
            ctx.save();
            ctx.globalAlpha = 0.4;
        }
        const widgetData = drawNodeWidget(ctx, { size: [width, height], pos: [15, posY] });
        const showNav = ((_a = node.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_SHOW_NAV]) !== false;
        const navWidth = 28 + 1;
        const navStart = width - 15 - navWidth;
        const toggleWidth = 90;
        const toggleStart = navStart - toggleWidth;
        this.hitAreas.nav.bounds = showNav ? [navStart, navWidth] : [width, 0];
        this.hitAreas.toggle.bounds = [toggleStart, showNav ? toggleWidth : toggleWidth + navWidth];
        this.hitAreas.drag.bounds = [15, Math.max(0, toggleStart - 15)];
        let currentX = widgetData.width - widgetData.margin;
        if (!widgetData.lowQuality && showNav) {
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
        else if (widgetData.lowQuality && showNav) {
            currentX -= 28;
        }
        currentX -= 7;
        ctx.fillStyle = this.toggled ? "#89A" : "#333";
        ctx.beginPath();
        const toggleRadius = height * 0.36;
        ctx.arc(currentX - toggleRadius, posY + height * 0.5, toggleRadius, 0, Math.PI * 2);
        ctx.fill();
        currentX -= toggleRadius * 2;
        if (!widgetData.lowQuality) {
            currentX -= 4;
            ctx.textAlign = "right";
            ctx.fillStyle = this.toggled ? widgetData.colorText : widgetData.colorTextSecondary;
            const label = this.label;
            const toggleLabelOn = this.options.on || "true";
            const toggleLabelOff = this.options.off || "false";
            ctx.fillText(this.toggled ? toggleLabelOn : toggleLabelOff, currentX, posY + height * 0.7);
            currentX -= Math.max(ctx.measureText(toggleLabelOn).width, ctx.measureText(toggleLabelOff).width);
            currentX -= 7;
            ctx.textAlign = "left";
            let maxLabelWidth = widgetData.width - widgetData.margin - 10 - (widgetData.width - currentX);
            const labelX = widgetData.margin + 10 + 10;
            if (label != null) {
                ctx.fillText(fitString(ctx, label, maxLabelWidth - 10), labelX, posY + height * 0.7);
            }
            const gripX = widgetData.margin + 6;
            const gripMidY = posY + height * 0.5;
            ctx.fillStyle = widgetData.colorTextSecondary;
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.arc(gripX, gripMidY + i * 4, 1.1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        if (isDragging) {
            ctx.restore();
        }
        const fastNode2 = node;
        if (fastNode2.dragWidget &&
            fastNode2.dragWidget !== this &&
            fastNode2.dragDropIndex > -1) {
            const rows = (node.widgets || []).filter((w) => w instanceof FastGroupsToggleRowWidget);
            if (rows[fastNode2.dragDropIndex] === this) {
                ctx.save();
                ctx.strokeStyle = "#89A";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(widgetData.margin, posY - 1);
                ctx.lineTo(widgetData.width - widgetData.margin, posY - 1);
                ctx.stroke();
                ctx.restore();
            }
        }
    }
    serializeValue(node, index) {
        return this.value;
    }
    onDragDown(event, pos, node) {
        const rows = this.node.getRowWidgets();
        this.dragStartIndex = rows.indexOf(this);
        if (this.dragStartIndex < 0) {
            return false;
        }
        this.dragging = true;
        this.dragStartY = pos[1];
        this.node.dragWidget = this;
        this.node.dragDropIndex = this.dragStartIndex;
        this.node.setDirtyCanvas(true, false);
        return true;
    }
    onDragMove(event, pos, node) {
        if (!this.dragging) {
            return;
        }
        const rows = this.node.getRowWidgets();
        const slot = LiteGraph.NODE_WIDGET_HEIGHT + 4;
        const movedSlots = Math.round((pos[1] - this.dragStartY) / slot);
        let idx = this.dragStartIndex + movedSlots;
        idx = Math.max(0, Math.min(rows.length - 1, idx));
        if (idx !== this.node.dragDropIndex) {
            this.node.dragDropIndex = idx;
            this.node.setDirtyCanvas(true, false);
        }
    }
    onDragUp(event, pos, node) {
        if (!this.dragging) {
            return false;
        }
        const target = this.node.dragDropIndex;
        const from = this.dragStartIndex;
        this.dragging = false;
        this.dragStartIndex = -1;
        this.node.dragWidget = null;
        this.node.dragDropIndex = -1;
        this.node.commitManualOrder(from, target);
        return true;
    }
    onToggleClick(event, pos, node) {
        this.toggle();
        return true;
    }
    onNavClick(event, pos, node) {
        var _a, _b;
        if (((_a = node.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_SHOW_NAV]) === false) {
            return false;
        }
        const canvas = app.canvas;
        const lowQuality = (((_b = canvas.ds) === null || _b === void 0 ? void 0 : _b.scale) || 1) <= 0.5;
        if (lowQuality) {
            return false;
        }
        canvas.centerOnNode(this.group);
        const zoomCurrent = canvas.ds && canvas.ds.scale ? canvas.ds.scale : 1;
        const zoomX = canvas.canvas.width / this.group._size[0] - 0.02;
        const zoomY = canvas.canvas.height / this.group._size[1] - 0.02;
        canvas.setZoom(Math.min(zoomCurrent, zoomX, zoomY), [
            canvas.canvas.width / 2,
            canvas.canvas.height / 2,
        ]);
        canvas.setDirty(true, true);
        return true;
    }
}
app.registerExtension({
    name: "rgthree.FastGroupsMuter",
    registerCustomNodes() {
        FastGroupsMuter.setUp();
    },
    loadedGraphNode(node) {
        if (node.type == FastGroupsMuter.title) {
            node.tempSize = [...node.size];
        }
    },
});
