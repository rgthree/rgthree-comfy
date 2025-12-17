import { app } from "../../scripts/app.js";
import { RgthreeBaseVirtualNode } from "./base_node.js";
import { SERVICE as KEY_EVENT_SERVICE } from "./services/key_events_services.js";
import { SERVICE as BOOKMARKS_SERVICE } from "./services/bookmarks_services.js";
import { NodeTypesString } from "./constants.js";
import { getClosestOrSelf, query } from "../../rgthree/common/utils_dom.js";
import { wait } from "../../rgthree/common/shared_utils.js";
import { findFromNodeForSubgraph } from "./utils.js";
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
        this.longPressTimer = null;
        this.longPressTriggered = false;
        this.pendingShortcut = false;
        const nextShortcutChar = BOOKMARKS_SERVICE.getNextShortcut();
        this.addWidget("text", "shortcut_key", nextShortcutChar, (value, ...args) => {
            value = value.trim()[0] || "1";
        }, {
            y: 8,
        });
        this.addWidget("number", "zoom", 1, (value) => { }, {
            y: 8 + LiteGraph.NODE_WIDGET_HEIGHT + 4,
            max: 2,
            min: 0.5,
            precision: 2,
        });
        this.keypressBound = this.onKeypress.bind(this);
        this.keyupBound = this.onKeyup.bind(this);
        this.title = "🔖";
        this.onConstructed();
    }
    get shortcutKey() {
        var _a, _b, _c;
        return (_c = (_b = (_a = this.widgets[0]) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.toLocaleLowerCase()) !== null && _c !== void 0 ? _c : "";
    }
    onAdded(graph) {
        KEY_EVENT_SERVICE.addEventListener("keydown", this.keypressBound);
        KEY_EVENT_SERVICE.addEventListener("keyup", this.keyupBound);
    }
    onRemoved() {
        KEY_EVENT_SERVICE.removeEventListener("keydown", this.keypressBound);
        KEY_EVENT_SERVICE.removeEventListener("keyup", this.keyupBound);
        this.clearLongPressTimer();
    }
    clearLongPressTimer() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }
    onKeypress(event) {
        const originalEvent = event.detail.originalEvent;
        const target = originalEvent.target;
        if (getClosestOrSelf(target, 'input,textarea,[contenteditable="true"]')) {
            return;
        }
        if (KEY_EVENT_SERVICE.areOnlyKeysDown(this.widgets[0].value, true)) {
            this.pendingShortcut = true;
            this.longPressTriggered = false;
            originalEvent.preventDefault();
            originalEvent.stopPropagation();
            if (!this.longPressTimer) {
                this.longPressTimer = setTimeout(() => {
                    this.longPressTimer = null;
                    if (KEY_EVENT_SERVICE.areOnlyKeysDown(this.widgets[0].value, true)
                        && this.graph === app.canvas.getCurrentGraph()) {
                        this.setBookmarkFromCanvas();
                        this.longPressTriggered = true;
                        this.pendingShortcut = false;
                    }
                }, 1000);
            }
        }
    }
    onKeyup(event) {
        const originalEvent = event.detail.originalEvent;
        const target = originalEvent.target;
        if (getClosestOrSelf(target, 'input,textarea,[contenteditable="true"]')) {
            return;
        }
        if (this.pendingShortcut) {
            this.clearLongPressTimer();
            if (!this.longPressTriggered) {
                this.canvasToBookmark();
                originalEvent.preventDefault();
                originalEvent.stopPropagation();
            }
            this.pendingShortcut = false;
            this.longPressTriggered = false;
        }
    }
    onMouseDown(event, pos, graphCanvas) {
        var _a;
        const input = query(".graphdialog > input.value");
        if (input && input.value === ((_a = this.widgets[0]) === null || _a === void 0 ? void 0 : _a.value)) {
            input.addEventListener("keydown", (e) => {
                KEY_EVENT_SERVICE.handleKeyDownOrUp(e);
                e.preventDefault();
                e.stopPropagation();
                input.value = Object.keys(KEY_EVENT_SERVICE.downKeys).join(" + ");
            });
        }
        return false;
    }
    async canvasToBookmark() {
        var _a, _b;
        const canvas = app.canvas;
        if (this.graph !== app.canvas.getCurrentGraph()) {
            const subgraph = this.graph;
            const fromNode = findFromNodeForSubgraph(subgraph.id);
            canvas.openSubgraph(subgraph, fromNode);
            await wait(16);
        }
        if ((_a = canvas === null || canvas === void 0 ? void 0 : canvas.ds) === null || _a === void 0 ? void 0 : _a.offset) {
            canvas.ds.offset[0] = -this.pos[0] + 16;
            canvas.ds.offset[1] = -this.pos[1] + 40;
        }
        if (((_b = canvas === null || canvas === void 0 ? void 0 : canvas.ds) === null || _b === void 0 ? void 0 : _b.scale) != null) {
            canvas.ds.scale = Number(this.widgets[1].value || 1);
        }
        canvas.setDirty(true, true);
    }
    setBookmarkFromCanvas() {
        var _a, _b;
        const canvas = app.canvas;
        if (this.graph !== canvas.getCurrentGraph())
            return;
        const offset = (_a = canvas === null || canvas === void 0 ? void 0 : canvas.ds) === null || _a === void 0 ? void 0 : _a.offset;
        if (offset) {
            this.pos[0] = -offset[0] + 16;
            this.pos[1] = -offset[1] + 40;
        }
        if (((_b = canvas === null || canvas === void 0 ? void 0 : canvas.ds) === null || _b === void 0 ? void 0 : _b.scale) != null) {
            if (this.widgets && this.widgets[1]) {
                this.widgets[1].value = Number(canvas.ds.scale || 1);
            }
        }
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
