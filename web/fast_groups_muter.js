import { app } from "../../scripts/app.js";
import { RgthreeBaseNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
import { addHelpMenuItem } from "./utils.js";
const PROPERTY_SORT = "sort";
const PROPERTY_MATCH_COLORS = "matchColors";
const PROPERTY_MATCH_TITLE = "matchTitle";
const PROPERTY_SHOW_NAV = "showNav";
export class FastGroupsMuter extends RgthreeBaseNode {
    constructor(title = FastGroupsMuter.title) {
        super(title);
        this.modeOn = LiteGraph.ALWAYS;
        this.modeOff = LiteGraph.NEVER;
        this.debouncerTempWidth = 0;
        this.refreshWidgetsTimeout = null;
        this.tempSize = null;
        this.serialize_widgets = false;
        this.helpActions = 'must and unmute';
        this.properties[PROPERTY_SORT] = "position";
        this.properties[PROPERTY_MATCH_COLORS] = "";
        this.properties[PROPERTY_MATCH_TITLE] = "";
        this.properties[PROPERTY_SHOW_NAV] = true;
        this.addOutput("OPT_CONNECTION", "*");
    }
    onNodeCreated() {
        if (!this.configuring) {
            this.refreshWidgets();
        }
        else {
            setTimeout(() => {
                this.refreshWidgets();
            }, 600);
        }
    }
    refreshWidgets() {
        var _a, _b, _c, _d, _e, _f;
        const graph = app.graph;
        const sort = ((_a = this.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_SORT]) || "position";
        const groups = [...graph._groups].sort((a, b) => {
            if (sort === "alphanumeric") {
                return a.title.localeCompare(b.title);
            }
            const aY = Math.floor(a._pos[1] / 30);
            const bY = Math.floor(b._pos[1] / 30);
            if (aY == bY) {
                const aX = Math.floor(a._pos[0] / 30);
                const bX = Math.floor(b._pos[0] / 30);
                return aX - bX;
            }
            return aY - bY;
        });
        let filterColors = (((_c = (_b = this.properties) === null || _b === void 0 ? void 0 : _b[PROPERTY_MATCH_COLORS]) === null || _c === void 0 ? void 0 : _c.split(",")) || []).filter((c) => c.trim());
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
                let groupColor = group.color.replace("#", "").trim().toLocaleLowerCase();
                if (groupColor.length === 3) {
                    groupColor = groupColor.replace(/(.)(.)(.)/, "$1$1$2$2$3$3");
                }
                groupColor = `#${groupColor}`;
                if (!filterColors.includes(groupColor)) {
                    continue;
                }
            }
            if ((_e = (_d = this.properties) === null || _d === void 0 ? void 0 : _d[PROPERTY_MATCH_TITLE]) === null || _e === void 0 ? void 0 : _e.trim()) {
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
            this.widgets = this.widgets || [];
            const widgetName = `Enable ${group.title}`;
            let widget = this.widgets.find((w) => w.name === widgetName);
            if (!widget) {
                this.tempSize = [...this.size];
                widget = this.addCustomWidget({
                    name: "RGTHREE_TOGGLE_AND_NAV",
                    label: "",
                    value: false,
                    disabled: false,
                    options: { on: "yes", off: "no" },
                    draw: function (ctx, node, width, posY, height) {
                        var _a;
                        let margin = 15;
                        let outline_color = LiteGraph.WIDGET_OUTLINE_COLOR;
                        let background_color = LiteGraph.WIDGET_BGCOLOR;
                        let text_color = LiteGraph.WIDGET_TEXT_COLOR;
                        let secondary_text_color = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
                        const showNav = ((_a = node.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_SHOW_NAV]) !== false;
                        const spaceForNav = showNav ? 28 : 0;
                        ctx.textAlign = "left";
                        ctx.strokeStyle = outline_color;
                        ctx.fillStyle = background_color;
                        ctx.beginPath();
                        ctx.roundRect(margin, posY, width - margin * 2, height, [height * 0.5]);
                        ctx.fill();
                        ctx.stroke();
                        ctx.fillStyle = this.value ? "#89A" : "#333";
                        ctx.beginPath();
                        ctx.arc(width - margin * 2 - spaceForNav, posY + height * 0.5, height * 0.36, 0, Math.PI * 2);
                        ctx.fill();
                        if (showNav) {
                            const midY = posY + height * 0.5;
                            const rightX = width - margin;
                            ctx.strokeStyle = outline_color;
                            ctx.beginPath();
                            ctx.moveTo(rightX - spaceForNav, posY);
                            ctx.lineTo(rightX - spaceForNav, posY + height);
                            ctx.stroke();
                            ctx.fillStyle = "#89A";
                            ctx.strokeStyle = ctx.fillStyle;
                            ctx.lineJoin = "round";
                            ctx.lineCap = "round";
                            ctx.beginPath();
                            ctx.moveTo(rightX - 21, midY - height * 0.12);
                            ctx.lineTo(rightX - 14, midY - height * 0.12);
                            ctx.lineTo(rightX - 14, midY - height * 0.31);
                            ctx.lineTo(rightX - 7, midY);
                            ctx.lineTo(rightX - 14, midY + height * 0.31);
                            ctx.lineTo(rightX - 14, midY + height * 0.12);
                            ctx.lineTo(rightX - 21, midY + height * 0.12);
                            ctx.lineTo(rightX - 21, midY - height * 0.12);
                            ctx.fill();
                            ctx.stroke();
                        }
                        ctx.textAlign = "left";
                        ctx.fillStyle = this.value ? text_color : secondary_text_color;
                        const label = this.label || this.name;
                        if (label != null) {
                            ctx.fillText(label, margin * 2, posY + height * 0.7);
                        }
                        ctx.textAlign = "right";
                        ctx.fillText(this.value ? this.options.on || "true" : this.options.off || "false", width - margin * 2 - 10 - spaceForNav, posY + height * 0.7);
                    },
                    serializeValue(serializedNode, widgetIndex) {
                        return this.value;
                    },
                    mouse(event, pos, node) {
                        var _a;
                        if (event.type == "pointerdown") {
                            if (((_a = node.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_SHOW_NAV]) !== false &&
                                pos[0] >= node.size[0] - 15 - 28 - 1) {
                                app.canvas.centerOnNode(group);
                            }
                            else {
                                this.value = !this.value;
                                setTimeout(() => {
                                    var _a;
                                    (_a = this.callback) === null || _a === void 0 ? void 0 : _a.call(this, this.value, app.canvas, node, pos, event);
                                }, 20);
                            }
                        }
                        return true;
                    },
                });
                widget.doModeChange = (force) => {
                    group.recomputeInsideNodes();
                    let off = force == null ? group._nodes.every((n) => n.mode === this.modeOff) : force;
                    for (const node of group._nodes) {
                        node.mode = (off ? this.modeOn : this.modeOff);
                    }
                    widget.value = off;
                };
                widget.callback = () => {
                    widget.doModeChange();
                };
                this.setSize(this.computeSize());
            }
            if (!((_f = group._nodes) === null || _f === void 0 ? void 0 : _f.length)) {
                group.recomputeInsideNodes();
            }
            widget.name = widgetName;
            widget.value = !group._nodes.every((n) => n.mode === this.modeOff);
            if (this.widgets[index] !== widget) {
                const oldIndex = this.widgets.findIndex((w) => w === widget);
                this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]);
            }
            index++;
        }
        while ((this.widgets || [])[index]) {
            this.removeWidget(index++);
        }
        this.refreshWidgetsTimeout && clearTimeout(this.refreshWidgetsTimeout);
        this.refreshWidgetsTimeout = setTimeout(() => {
            if (!this.removed) {
                this.refreshWidgets();
            }
        }, 500);
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
            app.graph.setDirtyCanvas(true, true);
        }, 16);
        return size;
    }
    async handleAction(action) {
        if (action === "Mute all") {
            for (const widget of this.widgets) {
                widget === null || widget === void 0 ? void 0 : widget.doModeChange(false);
            }
        }
        else if (action === "Enable all") {
            for (const widget of this.widgets) {
                widget === null || widget === void 0 ? void 0 : widget.doModeChange(true);
            }
        }
    }
    getExtraMenuOptions(canvas, menuOptions) {
        addHelpMenuItem(this, `
        <p>The ${this.type.replace("(rgthree)", "")} is an input-less node that automatically collects all groups in your current
        workflow and allows you to quickly ${this.helpActions} all nodes within the group.</p>
        <ul>
          <li>
            <p><strong>Properties.</strong> You can change the following properties (by right-clicking on the node, and select "Properties" or "Properties Panel" from the menu):</p>
            <ul>
              <li><p><code>${PROPERTY_SORT}</code> - Sort the toggles' order by alphanumeric or graph position.</p></li>
              <li><p><code>${PROPERTY_MATCH_COLORS}</code> - Only add groups that match the provided colors. Can be ComfyUI colors (red, pale_blue) or hex codes (#a4d399). Multiple can be added, comma delimited.</p></li>
              <li><p><code>${PROPERTY_MATCH_TITLE}</code> - Filter the list of toggles by title match (string match, or regular expression).</p></li>
              <li><p><code>${PROPERTY_SHOW_NAV}</code> - Add / remove a quick navigation arrow to take you to the group.</p></li>
            </ul>
          </li>
        </ul>
      `, menuOptions);
    }
    static setUp(clazz) {
        LiteGraph.registerNodeType(clazz.type, clazz);
        clazz.category = clazz._category;
    }
}
FastGroupsMuter.type = NodeTypesString.FAST_GROUPS_MUTER;
FastGroupsMuter.title = NodeTypesString.FAST_GROUPS_MUTER;
FastGroupsMuter.exposedActions = ["Mute all", "Enable all"];
FastGroupsMuter["@sort"] = {
    type: "combo",
    values: ["position", "alphanumeric"],
};
FastGroupsMuter["@matchColors"] = { type: "string" };
FastGroupsMuter["@matchTitle"] = { type: "string" };
FastGroupsMuter["@showNav"] = { type: "boolean" };
app.registerExtension({
    name: "rgthree.FastGroupsMuter",
    registerCustomNodes() {
        FastGroupsMuter.setUp(FastGroupsMuter);
    },
    loadedGraphNode(node) {
        if (node.type == FastGroupsMuter.title) {
            node.tempSize = [...node.size];
        }
    },
});
