import { app } from "../../scripts/app.js";
import { RgthreeBaseNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
export class Bookmark extends RgthreeBaseNode {
    get _collapsed_width() {
        return this.___collapsed_width;
    }
    set _collapsed_width(width) {
        const canvas = app.canvas;
        const ctx = canvas.canvas.getContext('2d');
        const oldFont = ctx.font;
        ctx.font = canvas.title_text_font;
        this.___collapsed_width = 40 + ctx.measureText(this.title).width;
        ctx.font = oldFont;
    }
    constructor(title = Bookmark.title) {
        super(title);
        this.___collapsed_width = 0;
        this.isVirtualNode = true;
        this.serialize_widgets = true;
        this.addWidget('text', 'shortcut_key', '1', (value, ...args) => {
            value = value.trim()[0] || '1';
        }, {
            y: 8,
        });
        this.addWidget('number', 'zoom', 1, (value) => {
        }, {
            y: 8 + LiteGraph.NODE_WIDGET_HEIGHT + 4,
            max: 2,
            min: 0.5,
            precision: 2,
        });
        this.keypressBound = this.onKeypress.bind(this);
    }
    static setUp(clazz) {
        LiteGraph.registerNodeType(clazz.type, clazz);
        clazz.category = clazz._category;
    }
    onAdded(graph) {
        window.addEventListener("keydown", this.keypressBound);
    }
    onRemoved() {
        window.removeEventListener("keydown", this.keypressBound);
    }
    async onKeypress(event) {
        const target = event.target;
        if (['input', 'textarea'].includes(target.localName)) {
            return;
        }
        if (event.key.toLocaleLowerCase() === this.widgets[0].value.toLocaleLowerCase()) {
            this.canvasToBookmark();
        }
    }
    canvasToBookmark() {
        var _a, _b;
        const canvas = app.canvas;
        if ((_a = canvas === null || canvas === void 0 ? void 0 : canvas.ds) === null || _a === void 0 ? void 0 : _a.offset) {
            canvas.ds.offset[0] = -this.pos[0] + 16;
            canvas.ds.offset[1] = -this.pos[1] + 40;
        }
        if (((_b = canvas === null || canvas === void 0 ? void 0 : canvas.ds) === null || _b === void 0 ? void 0 : _b.scale) != null) {
            canvas.ds.scale = Number(this.widgets[1].value || 1);
        }
        canvas.setDirty(true, true);
    }
}
Bookmark.type = NodeTypesString.BOOKMARK;
Bookmark.title = "🔖";
Bookmark.slot_start_y = -20;
app.registerExtension({
    name: "rgthree.Bookmark",
    registerCustomNodes() {
        Bookmark.setUp(Bookmark);
    },
});
