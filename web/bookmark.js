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
        this.addWidget('text', 'shortcut_key', '1', (value, ...args) => {
            value = value.trim()[0] || '1';
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
        const canvas = app.canvas;
        canvas.ds.offset[0] = -this.pos[0] + 16;
        canvas.ds.offset[1] = -this.pos[1] + 40;
        canvas.setDirty(true, true);
    }
}
Bookmark.type = NodeTypesString.BOOKMARK;
Bookmark.title = "🔖";
app.registerExtension({
    name: "rgthree.Bookmark",
    registerCustomNodes() {
        Bookmark.setUp(Bookmark);
    },
});
