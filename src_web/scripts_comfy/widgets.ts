import type {ComfyApp} from "@comfyorg/frontend";
import type {IWidget, LGraphNode} from "@comfyorg/litegraph";

type ComfyWidgetFn = (
  node: LGraphNode,
  inputName: string,
  inputData: any,
  app: ComfyApp,
) => {widget: IWidget};

/**
 * A dummy ComfyWidgets that we can import from our code, which we'll rewrite later to the comfyui
 * hosted widgets.js
 */
export declare const ComfyWidgets: {
  COMBO: ComfyWidgetFn;
  STRING: ComfyWidgetFn;
  [key: string]: ComfyWidgetFn;
};
