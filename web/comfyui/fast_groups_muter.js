import { app } from "../../scripts/app.js";
import { RgthreeBaseVirtualNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
import { SERVICE as FAST_GROUPS_SERVICE } from "./fast_groups_service.js";
import { RgthreeToggleNavWidget } from "./utils_widgets.js";
import { filterByColor, filterByTitle, groupHasActiveNode, sortBy, } from "./utils_fast.js";
const PROPERTY_SORT = "sort";
const PROPERTY_SORT_CUSTOM_ALPHA = "customSortAlphabet";
const PROPERTY_MATCH_COLORS = "matchColors";
const PROPERTY_MATCH_TITLE = "matchTitle";
const PROPERTY_SHOW_NAV = "showNav";
const PROPERTY_RESTRICTION = "toggleRestriction";
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
        this.properties[PROPERTY_SORT] = "position";
        this.properties[PROPERTY_SORT_CUSTOM_ALPHA] = "";
        this.properties[PROPERTY_RESTRICTION] = "default";
    }
    onConstructed() {
        this.addOutput("OPT_CONNECTION", "*");
        return super.onConstructed();
    }
    configure(info) {
        var _a;
        if ((_a = info.outputs) === null || _a === void 0 ? void 0 : _a.length) {
            info.outputs.length = 1;
        }
        super.configure(info);
    }
    onAdded(graph) {
        FAST_GROUPS_SERVICE.addFastGroupNode(this);
    }
    onRemoved() {
        FAST_GROUPS_SERVICE.removeFastGroupNode(this);
    }
    get showNav() {
        var _a;
        return ((_a = this.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_SHOW_NAV]) !== false;
    }
    refreshWidgets() {
        var _a, _b, _c, _d, _e, _f, _g;
        let sort = ((_a = this.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_SORT]) || "position";
        const groups = [...FAST_GROUPS_SERVICE.getGroups(sort)];
        const alphaSorted = sortBy(groups, {
            customAlphabet: (_c = (_b = this.properties) === null || _b === void 0 ? void 0 : _b[PROPERTY_SORT_CUSTOM_ALPHA]) === null || _c === void 0 ? void 0 : _c.replace(/\n/g, ""),
            sort,
        });
        const colorFiltered = filterByColor(alphaSorted, {
            matchColors: (_d = this.properties) === null || _d === void 0 ? void 0 : _d[PROPERTY_MATCH_COLORS],
            nodeColorOption: "groupcolor",
        });
        const titleFiltered = filterByTitle(colorFiltered, {
            matchTitle: (_f = (_e = this.properties) === null || _e === void 0 ? void 0 : _e[PROPERTY_MATCH_TITLE]) === null || _f === void 0 ? void 0 : _f.trim(),
        });
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
            if ((_g = (_f = this.properties) === null || _f === void 0 ? void 0 : _f[PROPERTY_MATCH_TITLE]) === null || _g === void 0 ? void 0 : _g.trim()) {
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
            const widgetName = `Enable ${group.title}`;
            const widget = this.getOrCreateToggleWidget(group, widgetName);
            if (widget.name != widgetName) {
                widget.name = widgetName;
                this.setDirtyCanvas(true, false);
            }
            if (widget.value != group._rgthreeHasAnyActiveNode) {
                widget.value = (_g = group._rgthreeHasAnyActiveNode) !== null && _g !== void 0 ? _g : false;
                this.setDirtyCanvas(true, false);
            }
            if (this.widgets[index] !== widget) {
                const oldIndex = this.widgets.findIndex((w) => w === widget);
                this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]);
                this.setDirtyCanvas(true, false);
            }
            index++;
        }
        while ((this.widgets || [])[index]) {
            this.removeWidget(index++);
        }
    }
    getOrCreateToggleWidget(group, widgetName) {
        const existingWidget = this.widgets.find((w) => w.name === widgetName);
        if (existingWidget && existingWidget instanceof RgthreeToggleNavWidget) {
            return existingWidget;
        }
        this.tempSize = [...this.size];
        const widget = this.addCustomWidget(new RgthreeToggleNavWidget(group, () => this.showNav, (force, skipOtherNodeCheck) => {
            var _a, _b, _c, _d;
            group.recomputeInsideNodes();
            const hasAnyActiveNodes = groupHasActiveNode(group);
            let newValue = force != null ? force : !hasAnyActiveNodes;
            if (skipOtherNodeCheck !== true) {
                if (newValue && ((_b = (_a = this.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_RESTRICTION]) === null || _b === void 0 ? void 0 : _b.includes(" one"))) {
                    for (const widget of this.widgets) {
                        (_c = widget.doModeChange) === null || _c === void 0 ? void 0 : _c.call(widget, false, true);
                    }
                }
                else if (!newValue && ((_d = this.properties) === null || _d === void 0 ? void 0 : _d[PROPERTY_RESTRICTION]) === "always one") {
                    newValue = this.widgets.every((w) => !w.value || w === widget);
                }
            }
            for (const node of group._nodes) {
                node.mode = (newValue ? this.modeOn : this.modeOff);
            }
            widget.value = newValue;
            app.graph.setDirtyCanvas(true, false);
        }));
        this.setSize(this.computeSize());
        return widget;
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
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (action === "Mute all" || action === "Bypass all") {
            const alwaysOne = ((_a = this.properties) === null || _a === void 0 ? void 0 : _a[PROPERTY_RESTRICTION]) === "always one";
            for (const [index, widget] of this.widgets.entries()) {
                (_b = widget.doModeChange) === null || _b === void 0 ? void 0 : _b.call(widget, alwaysOne && !index ? true : false, true);
            }
        }
        else if (action === "Enable all") {
            const onlyOne = (_c = this.properties) === null || _c === void 0 ? void 0 : _c[PROPERTY_RESTRICTION].includes(" one");
            for (const [index, widget] of this.widgets.entries()) {
                (_d = widget.doModeChange) === null || _d === void 0 ? void 0 : _d.call(widget, onlyOne && index > 0 ? false : true, true);
            }
        }
        else if (action === "Toggle all") {
            const onlyOne = (_e = this.properties) === null || _e === void 0 ? void 0 : _e[PROPERTY_RESTRICTION].includes(" one");
            let foundOne = false;
            for (const [index, widget] of this.widgets.entries()) {
                let newValue = onlyOne && foundOne ? false : !widget.value;
                foundOne = foundOne || newValue;
                (_f = widget.doModeChange) === null || _f === void 0 ? void 0 : _f.call(widget, newValue, true);
            }
            if (!foundOne && ((_g = this.properties) === null || _g === void 0 ? void 0 : _g[PROPERTY_RESTRICTION]) === "always one") {
                (_h = this.widgets[this.widgets.length - 1]) === null || _h === void 0 ? void 0 : _h.doModeChange(true, true);
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
              <code>${PROPERTY_SORT}</code> - Sort the toggles' order by "alphanumeric", graph
              "position", or "custom alphabet". <i>(default: "position")</i>
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
    static setUp(clazz) {
        LiteGraph.registerNodeType(clazz.type, clazz);
        clazz.category = clazz._category;
    }
}
BaseFastGroupsModeChanger.type = NodeTypesString.FAST_GROUPS_MUTER;
BaseFastGroupsModeChanger.title = NodeTypesString.FAST_GROUPS_MUTER;
BaseFastGroupsModeChanger.exposedActions = ["Mute all", "Enable all", "Toggle all"];
BaseFastGroupsModeChanger["@matchColors"] = { type: "string" };
BaseFastGroupsModeChanger["@matchTitle"] = { type: "string" };
BaseFastGroupsModeChanger["@showNav"] = { type: "boolean" };
BaseFastGroupsModeChanger["@sort"] = {
    type: "combo",
    values: ["position", "alphanumeric", "custom alphabet"],
};
BaseFastGroupsModeChanger["@customSortAlphabet"] = { type: "string" };
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
    static setUp(clazz) {
        LiteGraph.registerNodeType(clazz.type, clazz);
        clazz.category = clazz._category;
    }
}
FastGroupsMuter.type = NodeTypesString.FAST_GROUPS_MUTER;
FastGroupsMuter.title = NodeTypesString.FAST_GROUPS_MUTER;
FastGroupsMuter.exposedActions = ["Bypass all", "Enable all", "Toggle all"];
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
