import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
import { addConnectionLayoutSupport } from "./utils.js";
export class RgthreeImageComparer extends RgthreeBaseServerNode {
    constructor(title = RgthreeImageComparer.title) {
        super(title);
        this.imgs = [];
        this.images = [];
        this.isPointerDown = false;
    }
    onExecuted(output) {
        var _a;
        (_a = super.onExecuted) === null || _a === void 0 ? void 0 : _a.call(this, output);
        console.log(app.nodePreviewImages);
        console.log(app.nodePreviewImages[this.id]);
        this.imgs = output.images || [];
        this.images = [];
        for (const imgData of this.imgs) {
            let img = new Image();
            img.src = api.apiURL(`/view?filename=${encodeURIComponent(imgData.filename)}&type=${imgData.type}&subfolder=${imgData.subfolder}${app.getPreviewFormatParam()}${app.getRandParam()}`);
            this.images.push(img);
        }
    }
    onNodeCreated() {
        const widget = {
            type: "RGTHREE_CANVAS_COMPARER",
            name: "CANVAS_COMPARER",
            options: { serialize: false },
            value: null,
            draw(ctx, node, width, y) {
                let [nodeWidth, nodeHeight] = node.size;
                const image = node.isPointerDown ? node.images[1] : node.images[0];
                if (!(image === null || image === void 0 ? void 0 : image.naturalWidth) || !(image === null || image === void 0 ? void 0 : image.naturalHeight)) {
                    return;
                }
                const imageAspect = image.width / image.height;
                let height = nodeHeight - y;
                const widgetAspect = width / height;
                let targetWidth, targetHeight;
                if (imageAspect > widgetAspect) {
                    targetWidth = width;
                    targetHeight = width / imageAspect;
                }
                else {
                    targetHeight = height;
                    targetWidth = height * imageAspect;
                }
                ctx.drawImage(image, (width - targetWidth) / 2, y + (height - targetHeight) / 2, targetWidth, targetHeight);
            },
            computeSize(...args) {
                return [128, 128];
            },
        };
        this.addCustomWidget(widget);
    }
    setIsPointerDown(down = this.isPointerDown) {
        const newIsDown = down && !!app.canvas.pointer_is_down;
        if (this.isPointerDown !== newIsDown) {
            this.isPointerDown = newIsDown;
            this.setDirtyCanvas(true, false);
        }
        if (this.isPointerDown) {
            requestAnimationFrame(() => {
                this.setIsPointerDown();
            });
        }
    }
    onMouseDown(event, pos, graphCanvas) {
        var _a;
        (_a = super.onMouseDown) === null || _a === void 0 ? void 0 : _a.call(this, event, pos, graphCanvas);
        this.setIsPointerDown();
    }
    onMouseEnter(event, pos, graphCanvas) {
        var _a;
        (_a = super.onMouseEnter) === null || _a === void 0 ? void 0 : _a.call(this, event, pos, graphCanvas);
        this.setIsPointerDown(!!app.canvas.pointer_is_down);
    }
    onMouseLeave(event, pos, graphCanvas) {
        var _a;
        (_a = super.onMouseLeave) === null || _a === void 0 ? void 0 : _a.call(this, event, pos, graphCanvas);
        this.setIsPointerDown(false);
    }
    static setUp(comfyClass) {
        RgthreeBaseServerNode.registerForOverride(comfyClass, RgthreeImageComparer);
        addConnectionLayoutSupport(RgthreeBaseServerNode, app, [
            ["Left", "Right"],
            ["Right", "Left"],
        ]);
        setTimeout(() => {
            RgthreeImageComparer.category = comfyClass.category;
        });
    }
}
RgthreeImageComparer.title = NodeTypesString.IMAGE_COMPARER;
RgthreeImageComparer.type = NodeTypesString.IMAGE_COMPARER;
RgthreeImageComparer.comfyClass = NodeTypesString.IMAGE_COMPARER;
app.registerExtension({
    name: "rgthree.ImageComparer",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === RgthreeImageComparer.type) {
            console.log("beforeRegisterNodeDef", nodeType, nodeData);
            RgthreeImageComparer.nodeType = nodeType;
            RgthreeImageComparer.nodeData = nodeData;
            RgthreeImageComparer.setUp(nodeType);
        }
    },
});
