import { app } from "../../scripts/app.js";
import { RgthreeBaseNode } from "./base_node.js";
import { applyMixins } from "./utils.js";
class ImageInsetCrop extends RgthreeBaseNode {
    onAdded(graph) {
        const measurementWidget = this.widgets[0];
        let callback = measurementWidget.callback;
        measurementWidget.callback = (...args) => {
            this.setWidgetStep();
            callback && callback.apply(measurementWidget, [...args]);
        };
        this.setWidgetStep();
    }
    configure(info) {
        super.configure(info);
        this.setWidgetStep();
    }
    setWidgetStep() {
        const measurementWidget = this.widgets[0];
        for (let i = 1; i <= 4; i++) {
            if (measurementWidget.value === 'Pixels') {
                this.widgets[i].options.step = 80;
                this.widgets[i].options.max = ImageInsetCrop.maxResolution;
            }
            else {
                this.widgets[i].options.step = 10;
                this.widgets[i].options.max = 99;
            }
        }
    }
    async handleAction(action) {
        if (action === 'Reset Crop') {
            for (const widget of this.widgets) {
                if (['left', 'right', 'top', 'bottom'].includes(widget.name)) {
                    widget.value = 0;
                }
            }
        }
    }
    static setUp(clazz) {
        ImageInsetCrop.title = clazz.title;
        ImageInsetCrop.comfyClass = clazz.comfyClass;
        setTimeout(() => {
            ImageInsetCrop.category = clazz.category;
        });
        applyMixins(clazz, [RgthreeBaseNode, ImageInsetCrop]);
    }
}
ImageInsetCrop.type = '__OVERRIDE_ME__';
ImageInsetCrop.comfyClass = '__OVERRIDE_ME__';
ImageInsetCrop.exposedActions = ['Reset Crop'];
ImageInsetCrop.maxResolution = 8192;
app.registerExtension({
    name: "rgthree.ImageInsetCrop",
    async beforeRegisterNodeDef(nodeType, nodeData, _app) {
        if (nodeData.name === "Image Inset Crop (rgthree)") {
            ImageInsetCrop.setUp(nodeType);
        }
    },
});
