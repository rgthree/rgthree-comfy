// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
// @ts-ignore
import type {ComfyApp, ComfyObjectInfo,} from 'typings/comfy.js';
import type {Constructor} from 'typings/index.js'
import { RgthreeBaseNode } from "./base_node.js";
import { applyMixins } from "./utils.js";
import { IComboWidget, IWidget, LGraph, LGraphCanvas, LGraphNode, SerializedLGraphNode, Vector2 } from "typings/litegraph.js";

class ImageInsetCrop extends RgthreeBaseNode {

  static override type = '__OVERRIDE_ME__';
  static comfyClass = '__OVERRIDE_ME__';


  static override exposedActions = ['Reset Crop'];
  static maxResolution = 8192;

  override onAdded(graph: LGraph): void {
    const measurementWidget = this.widgets[0]!;
    let callback = measurementWidget.callback;
    measurementWidget.callback = (...args) => {
      this.setWidgetStep()
      callback && callback.apply(measurementWidget, [...args]);
    }
    this.setWidgetStep();
  }
  override configure(info: SerializedLGraphNode<LGraphNode>): void {
    super.configure(info);
    this.setWidgetStep();
  }

  private setWidgetStep() {
    const measurementWidget = this.widgets[0]!;
    for (let i = 1; i <= 4; i++) {
      if (measurementWidget.value === 'Pixels') {
        this.widgets[i]!.options.step = 80;
        this.widgets[i]!.options.max = ImageInsetCrop.maxResolution;
      } else {
        this.widgets[i]!.options.step = 10;
        this.widgets[i]!.options.max = 99;
      }
    }
  }

  override async handleAction(action: string): Promise<void> {
    if (action === 'Reset Crop') {
      for (const widget of this.widgets) {
        if (['left', 'right', 'top', 'bottom'].includes(widget.name!)) {
          widget.value = 0;
        }
      }
    }
  }

  static override setUp<T extends RgthreeBaseNode>(clazz: any) {
    ImageInsetCrop.title = clazz.title;
    ImageInsetCrop.comfyClass = clazz.comfyClass;
    setTimeout(() => {
      ImageInsetCrop.category = clazz.category;
    });

    applyMixins(clazz, [RgthreeBaseNode, ImageInsetCrop]);
  }
}


app.registerExtension({
	name: "rgthree.ImageInsetCrop",
	async beforeRegisterNodeDef(nodeType: Constructor<LGraphNode>, nodeData: ComfyObjectInfo, _app: ComfyApp) {
    if (nodeData.name === "Image Inset Crop (rgthree)") {
      ImageInsetCrop.setUp(nodeType);
		}
	},
});