import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
import { addConnectionLayoutSupport } from "./utils.js";
export class RgthreeImageComparer extends RgthreeBaseServerNode {
    constructor(title = RgthreeImageComparer.title) {
        super(title);
        this.imageIndex = 0;
        this.imgs = [];
        this.serialize_widgets = true;
        this.isPointerDown = false;
        this.isPointerOver = false;
        this.pointerOverPos = [0, 0];
        this.canvasWidget = null;
        this.properties['comparer_mode'] = 'Slide';
    }
    onExecuted(output) {
        var _a;
        (_a = super.onExecuted) === null || _a === void 0 ? void 0 : _a.call(this, output);
        this.canvasWidget.value = (output.images || []).map((d) => api.apiURL(`/view?filename=${encodeURIComponent(d.filename)}&type=${d.type}&subfolder=${d.subfolder}${app.getPreviewFormatParam()}${app.getRandParam()}`));
    }
    drawWidgetImage(ctx, image, y, cropX) {
        if (!(image === null || image === void 0 ? void 0 : image.naturalWidth) || !(image === null || image === void 0 ? void 0 : image.naturalHeight)) {
            return;
        }
        let [nodeWidth, nodeHeight] = this.size;
        const imageAspect = image.naturalWidth / image.naturalHeight;
        let height = nodeHeight - y;
        const widgetAspect = nodeWidth / height;
        let targetWidth, targetHeight;
        let offsetX = 0;
        if (imageAspect > widgetAspect) {
            targetWidth = nodeWidth;
            targetHeight = nodeWidth / imageAspect;
        }
        else {
            targetHeight = height;
            targetWidth = height * imageAspect;
            offsetX = (nodeWidth - targetWidth) / 2;
        }
        const widthMultiplier = image.naturalWidth / targetWidth;
        const sourceX = 0;
        const sourceY = 0;
        const sourceWidth = cropX != null ? (cropX - offsetX) * widthMultiplier : image.naturalWidth;
        const sourceHeight = image.naturalHeight;
        const destX = (nodeWidth - targetWidth) / 2;
        const destY = y + (height - targetHeight) / 2;
        const destWidth = cropX != null ? (cropX - offsetX) : targetWidth;
        const destHeight = targetHeight;
        ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, destX, destY, destWidth, destHeight);
        if (cropX != null
            && cropX >= (nodeWidth - targetWidth) / 2
            && cropX <= targetWidth + offsetX) {
            let globalCompositeOperation = ctx.globalCompositeOperation;
            ctx.globalCompositeOperation = "difference";
            ctx.moveTo(cropX, destY);
            ctx.lineTo(cropX, destY + destHeight);
            ctx.strokeStyle = 'rgba(255,255,255, 1)';
            ctx.stroke();
            ctx.globalCompositeOperation = globalCompositeOperation;
        }
    }
    onNodeCreated() {
        const node = this;
        const widget = {
            type: "RGTHREE_CANVAS_COMPARER",
            name: "CANVAS_COMPARER",
            options: { serialize: false },
            _value: [],
            set value(v) {
                this._value = v;
                node.imgs = [];
                if (v && v.length) {
                    for (let i = 0; i < 2; i++) {
                        let img = new Image();
                        img.src = v[i];
                        node.imgs.push(img);
                    }
                }
            },
            get value() {
                return this._value;
            },
            draw(ctx, node, width, y) {
                var _a;
                let [nodeWidth, nodeHeight] = node.size;
                if (((_a = node.properties) === null || _a === void 0 ? void 0 : _a['comparer_mode']) === 'Click') {
                    const image = node.isPointerDown ? node.imgs[1] : node.imgs[0];
                    node.drawWidgetImage(ctx, image, y);
                }
                else {
                    node.drawWidgetImage(ctx, node.imgs[0], y);
                    if (node.isPointerOver) {
                        node.drawWidgetImage(ctx, node.imgs[1], y, node.pointerOverPos[0]);
                    }
                }
            },
            computeSize(...args) {
                return [64, 64];
            },
        };
        this.canvasWidget = this.addCustomWidget(widget);
        this.setSize(this.computeSize());
        this.setDirtyCanvas(true, true);
    }
    setIsPointerDown(down = this.isPointerDown) {
        const newIsDown = down && !!app.canvas.pointer_is_down;
        if (this.isPointerDown !== newIsDown) {
            this.isPointerDown = newIsDown;
            this.setDirtyCanvas(true, false);
        }
        this.imageIndex = this.isPointerDown ? 1 : 0;
        if (this.isPointerDown) {
            requestAnimationFrame(() => {
                this.setIsPointerDown();
            });
        }
    }
    onMouseDown(event, pos, graphCanvas) {
        var _a;
        (_a = super.onMouseDown) === null || _a === void 0 ? void 0 : _a.call(this, event, pos, graphCanvas);
        this.setIsPointerDown(true);
    }
    onMouseEnter(event, pos, graphCanvas) {
        var _a;
        (_a = super.onMouseEnter) === null || _a === void 0 ? void 0 : _a.call(this, event, pos, graphCanvas);
        this.setIsPointerDown(!!app.canvas.pointer_is_down);
        this.isPointerOver = true;
    }
    onMouseLeave(event, pos, graphCanvas) {
        var _a;
        (_a = super.onMouseLeave) === null || _a === void 0 ? void 0 : _a.call(this, event, pos, graphCanvas);
        this.setIsPointerDown(false);
        this.isPointerOver = false;
    }
    onMouseMove(event, pos, graphCanvas) {
        var _a;
        (_a = super.onMouseMove) === null || _a === void 0 ? void 0 : _a.call(this, event, pos, graphCanvas);
        this.pointerOverPos = [...pos];
        this.imageIndex = this.pointerOverPos[0] > (this.size[0] / 2) ? 1 : 0;
    }
    getHelp() {
        return `
      <p>
        The ${this.type.replace("(rgthree)", "")} node compares two images on top of each other.
      </p>
      <ul>
        <li>
          <p>
            <strong>Notes</strong>
          </p>
          <ul>
            <li><p>
              The right-click menu may show image options (Open Image, Save Image, etc.) which will
              correspond to the first image (image_a) if clicked on the left-half of the node, or
              the second image if on the right half of the node.
            </p></li>
          </ul>
        </li>
        <li>
          <p>
            <strong>Inputs</strong>
          </p>
          <ul>
            <li><p>
              <code>image_a</code> <i>Required.</i> The first image to use to compare. If image_b is
              not supplied and image_a is a batch, the comparer will use the first two images of
              image_a.
            </p></li>
            <li><p>
              <code>image_b</code> <i>Optional.</i> The second image to use to compare. Optional
              only if image_a is a batch with two images.
            </p></li>
          </ul>
        </li>
        <li>
          <p>
            <strong>Properties.</strong> You can change the following properties (by right-clicking
            on the node, and select "Properties" or "Properties Panel" from the menu):
          </p>
          <ul>
            <li><p>
              <code>comparer_mode</code> - Choose between "Slide" and "Click". Defaults to "Slide".
            </p></li>
          </ul>
        </li>
      </ul>`;
    }
    static setUp(comfyClass, nodeData) {
        RgthreeBaseServerNode.registerForOverride(comfyClass, nodeData, RgthreeImageComparer);
    }
    static onRegisteredForOverride(comfyClass) {
        addConnectionLayoutSupport(RgthreeImageComparer, app, [
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
RgthreeImageComparer["@comparer_mode"] = {
    type: "combo",
    values: ["Slide", "Click"],
};
app.registerExtension({
    name: "rgthree.ImageComparer",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === RgthreeImageComparer.type) {
            RgthreeImageComparer.setUp(nodeType, nodeData);
        }
    },
});
