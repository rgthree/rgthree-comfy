import type { LGraphNode } from "typings/litegraph.js";
import type { ComfyApp, ComfyWidget } from "../typings/comfy.js";

type ComfyWidgetFn = (
  node: LGraphNode,
  inputName: string,
  inputData: any,
  app: ComfyApp,
) => { widget: ComfyWidget };

/**
 * A dummy ComfyWidgets that we can import from our code, which we'll rewrite later to the comfyui
 * hosted widgets.js
 */
export declare const ComfyWidgets: {
  COMBO: ComfyWidgetFn;
  STRING: ComfyWidgetFn;
  [key: string]: ComfyWidgetFn;
};
