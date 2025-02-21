import { app } from "../../scripts/app.js";
import { RgthreeBaseVirtualNode } from "./base_node.js";
import { SERVICE as KEY_EVENT_SERVICE } from "./services/key_events_services.js";
import { NodeTypesString } from "./constants.js";
import { getClosestOrSelf, queryOne } from "../../rgthree/common/utils_dom.js";
export class Bookmark extends RgthreeBaseVirtualNode {
    get _collapsed_width() {
        return this.___collapsed_width;
    }
    set _collapsed_width(width) {
        const canvas = app.canvas;
        const ctx = canvas.canvas.getContext("2d");
        const oldFont = ctx.font;
        ctx.font = canvas.title_text_font;
        this.___collapsed_width = 40 + ctx.measureText(this.title).width;
        ctx.font = oldFont;
    }
    constructor(title = Bookmark.title) {
        super(title);
        this.comfyClass = NodeTypesString.BOOKMARK;
        this.___collapsed_width = 0;
        this.isVirtualNode = true;
        this.serialize_widgets = true;
        const nextShortcutChar = getNextShortcut();
        this.addWidget("text", "shortcut_key", nextShortcutChar, (value, ...args) => {
            value = value.trim()[0] || "1";
        }, { y: 8 });
        this.addWidget("number", "zoom", 1, (value) => { }, {
            y: 8 + LiteGraph.NODE_WIDGET_HEIGHT + 4,
            max: 2,
            min: 0.5,
            precision: 2,
        });
        const presets = [
            "top left",
            "top center",
            "top right",
            "center",
            "bottom left",
            "bottom center",
            "bottom right",
        ];
        this.addWidget("combo", "Preset", "center", (value) => {
        }, {
            y: 8 + (LiteGraph.NODE_WIDGET_HEIGHT + 4) * 2,
            values: presets,
        });
        this.addWidget("number", "X-Offset", 16, (value) => { }, {
            y: 8 + (LiteGraph.NODE_WIDGET_HEIGHT + 4) * 3,
            precision: 0,
        });
        this.addWidget("number", "Y-Offset", 40, (value) => { }, {
            y: 8 + (LiteGraph.NODE_WIDGET_HEIGHT + 4) * 4,
            precision: 0,
        });
        this.keypressBound = this.onKeypress.bind(this);
        this.title = "🔖";
        this.onConstructed();
    }
    get shortcutKey() {
        var _a, _b, _c;
        return (_c = (_b = (_a = this.widgets[0]) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.toLocaleLowerCase()) !== null && _c !== void 0 ? _c : "";
    }
    onAdded(graph) {
        KEY_EVENT_SERVICE.addEventListener("keydown", this.keypressBound);
    }
    onRemoved() {
        KEY_EVENT_SERVICE.removeEventListener("keydown", this.keypressBound);
    }
    onKeypress(event) {
        const originalEvent = event.detail.originalEvent;
        const target = originalEvent.target;
        if (getClosestOrSelf(target, 'input,textarea,[contenteditable="true"]')) {
            return;
        }
        if (KEY_EVENT_SERVICE.areOnlyKeysDown(this.widgets[0].value, true)) {
            this.canvasToBookmark();
            originalEvent.preventDefault();
            originalEvent.stopPropagation();
        }
    }
    onMouseDown(event, pos, graphCanvas) {
        var _a;
        const input = queryOne(".graphdialog > input.value");
        if (input && input.value === ((_a = this.widgets[0]) === null || _a === void 0 ? void 0 : _a.value)) {
            input.addEventListener("keydown", (e) => {
                KEY_EVENT_SERVICE.handleKeyDownOrUp(e);
                e.preventDefault();
                e.stopPropagation();
                input.value = Object.keys(KEY_EVENT_SERVICE.downKeys).join(" + ");
            });
        }
    }
    canvasToBookmark() {
        var _a, _b, _c, _d, _e;
        const canvas = app.canvas;
        if (!((_a = canvas === null || canvas === void 0 ? void 0 : canvas.ds) === null || _a === void 0 ? void 0 : _a.offset) || canvas.ds.scale == null) {
            console.error("Canvas offset or scale is undefined.");
            return;
        }
        const presets = {
            "top left": { x: 0, y: 0 },
            "top center": { x: canvas.canvas.width / 2, y: 0 },
            "top right": { x: canvas.canvas.width, y: 0 },
            "center": { x: canvas.canvas.width / 2, y: canvas.canvas.height / 2 },
            "bottom left": { x: 0, y: canvas.canvas.height },
            "bottom center": { x: canvas.canvas.width / 2, y: canvas.canvas.height },
            "bottom right": { x: canvas.canvas.width, y: canvas.canvas.height },
        };
        const presetName = String(((_b = this.widgets[2]) === null || _b === void 0 ? void 0 : _b.value) || "center");
        const preset = presets[presetName];
        if (!preset) {
            console.error(`Invalid preset: ${presetName}`);
            return;
        }
        const xOffset = Number(((_c = this.widgets[3]) === null || _c === void 0 ? void 0 : _c.value) || 0);
        const yOffset = Number(((_d = this.widgets[4]) === null || _d === void 0 ? void 0 : _d.value) || 0);
        canvas.ds.offset[0] = -this.pos[0] + preset.x + xOffset;
        canvas.ds.offset[1] = -this.pos[1] + preset.y + yOffset;
        canvas.ds.scale = Number(((_e = this.widgets[1]) === null || _e === void 0 ? void 0 : _e.value) || 1);
        canvas.setDirty(true, true);
    }
}
Bookmark.type = NodeTypesString.BOOKMARK;
Bookmark.title = NodeTypesString.BOOKMARK;
Bookmark.slot_start_y = -20;
app.registerExtension({
    name: "rgthree.Bookmark",
    registerCustomNodes() {
        Bookmark.setUp();
    },
});
function isBookmark(node) {
    return node.type === NodeTypesString.BOOKMARK;
}
function getExistingShortcuts() {
    const graph = app.graph;
    const bookmarkNodes = graph._nodes.filter(isBookmark);
    const usedShortcuts = new Set(bookmarkNodes.map((n) => n.shortcutKey));
    return usedShortcuts;
}
const SHORTCUT_DEFAULTS = "1234567890abcdefghijklmnopqrstuvwxyz".split("");
function getNextShortcut() {
    var _a;
    const existingShortcuts = getExistingShortcuts();
    return (_a = SHORTCUT_DEFAULTS.find((char) => !existingShortcuts.has(char))) !== null && _a !== void 0 ? _a : "1";
}
