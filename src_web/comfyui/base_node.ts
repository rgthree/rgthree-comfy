// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
import { NodeMode } from "typings/comfy.js";
import type {
  IWidget,
  SerializedLGraphNode,
  LiteGraph as TLiteGraph,
  LGraphNode as TLGraphNode,
  LGraphCanvas,
  ContextMenuItem,
} from "typings/litegraph.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";
// @ts-ignore
import { app } from "../../scripts/app.js";

import { rgthree } from "./rgthree.js";
import { addHelpMenuItem } from "./utils.js";
import { RgthreeHelpDialog } from "rgthree/common/dialog.js";

declare const LGraphNode: typeof TLGraphNode;
declare const LiteGraph: typeof TLiteGraph;

/**
 * A base node with standard methods, extending the LGraphNode.
 * This can be used for ui-nodes and a further base for server nodes.
 */
export class RgthreeBaseNode extends LGraphNode {
  /**
   * Action strings that can be exposed and triggered from other nodes, like Fast Actions Button.
   */
  static exposedActions: string[] = [];

  static override title = "__NEED_NAME__";
  // `category` seems to get reset at register, so we'll
  // re-reset it after the register call. ¯\_(ツ)_/¯
  static category = "rgthree";
  static _category = "rgthree";

  /** A temporary width value that can be used to ensure compute size operates correctly. */
  _tempWidth = 0;

  /** Private Mode member so we can override the setter/getter and call an `onModeChange`. */
  private mode_: NodeMode;

  isVirtualNode = false;
  removed = false;
  configuring = false;

  helpDialog: RgthreeHelpDialog | null = null;

  constructor(title = RgthreeBaseNode.title) {
    super(title);
    if (title == "__NEED_NAME__") {
      throw new Error("RgthreeBaseNode needs overrides.");
    }
    this.properties = this.properties || {};
  }

  override configure(info: SerializedLGraphNode<TLGraphNode>): void {
    this.configuring = true;
    super.configure(info);
    // Fix https://github.com/comfyanonymous/ComfyUI/issues/1448 locally.
    // Can removed when fixed and adopted.
    for (const w of this.widgets || []) {
      w.last_y = w.last_y || 0;
    }
    this.configuring = false;
  }

  /**
   * Override clone for, at the least, deep-copying properties.
   */
  override clone() {
    const cloned = super.clone();
    // This is whild, but LiteGraph clone doesn't deep clone data, so we will. We'll use structured
    // clone, which most browsers in 2022 support, but but we'll check.
    if (cloned.properties && !!window.structuredClone) {
      cloned.properties = structuredClone(cloned.properties);
    }
    return cloned;
  }

  // @ts-ignore - Changing the property to an accessor here seems to work, but ts compiler complains.
  override set mode(mode: NodeMode) {
    if (this.mode_ != mode) {
      this.mode_ = mode;
      this.onModeChange();
    }
  }
  override get mode() {
    return this.mode_;
  }

  /** When a mode change, we want all connected nodes to match. */
  onModeChange() {
    // Override
  }

  /**
   * Given a string, do something. At the least, handle any `exposedActions` that may be called and
   * passed into from other nodes, like Fast Actions Button
   */
  async handleAction(action: string) {
    action; // No-op. Should be overridden but OK if not.
  }

  /**
   * Guess this doesn't exist in Litegraph...
   */
  removeWidget(widgetOrSlot?: IWidget | number) {
    if (typeof widgetOrSlot === "number") {
      this.widgets.splice(widgetOrSlot, 1);
    } else if (widgetOrSlot) {
      const index = this.widgets.indexOf(widgetOrSlot);
      if (index > -1) {
        this.widgets.splice(index, 1);
      }
    }
  }

  override onRemoved(): void {
    super.onRemoved?.();
    this.removed = true;
  }

  static setUp<T extends RgthreeBaseNode>(...args: any[]) {
    // No-op.
  }

  /**
   * A function to provide help text to be overridden.
   */
  getHelp() {
    return "";
  }

  showHelp() {
    const help = this.getHelp() || (this.constructor as any).help;
    if (help) {
      this.helpDialog = new RgthreeHelpDialog(this, help).show();
      this.helpDialog.addEventListener("close", (e) => {
        console.log("close", e);
        this.helpDialog = null;
      });
    }
  }

  override onKeyDown(event: KeyboardEvent): void {
    rgthree.handleKeydown(event);
    if (event.key == "?" && !this.helpDialog) {
      this.showHelp();
    }
  }

  override onKeyUp(event: KeyboardEvent): void {
    rgthree.handleKeyup(event);
  }

  override getExtraMenuOptions(canvas: LGraphCanvas, options: ContextMenuItem[]): void {
    // Some other extensions override getExtraMenuOptions on the nodeType as it comes through from
    // the server, so we can call out to that if we don't have our own.
    if (super.getExtraMenuOptions) {
      super.getExtraMenuOptions?.apply(this, [canvas, options]);
    } else if ((this.constructor as any).nodeType?.prototype?.getExtraMenuOptions) {
      (this.constructor as any).nodeType?.prototype?.getExtraMenuOptions?.apply(this, [
        canvas,
        options,
      ]);
    }
    // If we have help content, then add a menu item.
    const help = this.getHelp() || (this.constructor as any).help;
    if (help) {
      addHelpMenuItem(this, help, options);
    }
  }
}

const overriddenServerNodes = new Map<any, any>();

/**
 * A base node with standard methods, extending the LGraphNode.
 * This is somewhat experimental, but if comfyui is going to keep breaking widgets and inputs, it
 * seems safer than NOT overriding.
 */
export class RgthreeBaseServerNode extends RgthreeBaseNode {
  static nodeData: any | null = null;
  static nodeType: any | null = null;

  comfyClass!: string;

  constructor(title: string) {
    super(title);
    this.serialize_widgets = true;
    this.setupFromServerNodeData();
  }

  getWidgets() {
    return ComfyWidgets;
  }

  override onDrawForeground(ctx: CanvasRenderingContext2D, canvas: LGraphCanvas): void {
    const nodeType = (this.constructor as any).nodeType;
    // This is specifically for ComfyUi-Manager to draw the badge... though could have other
    // side-effects if other extensions override. If it gets messy, may have to remove.
    nodeType?.prototype?.onDrawForeground?.apply(this, [ctx, canvas]);
    super.onDrawForeground && super.onDrawForeground(ctx, canvas);
  }

  /**
   * This takes the server data and builds out the inputs, outputs and widgets. It's similar to the
   * ComfyNode constructor in registerNodes in ComfyUI's app.js, but is more stable and thus
   * shouldn't break as often when it modifyies widgets and types.
   */
  async setupFromServerNodeData() {
    const nodeData = (this.constructor as any).nodeData;
    if (!nodeData) {
      throw Error("No node data");
    }

    // Necessary for serialization so Comfy backend can check types.
    // Serialized as `class_type`. See app.js#graphToPrompt
    this.comfyClass = nodeData.name;

    let inputs = nodeData["input"]["required"];
    if (nodeData["input"]["optional"] != undefined) {
      inputs = Object.assign({}, inputs, nodeData["input"]["optional"]);
    }

    const WIDGETS = this.getWidgets();

    const config: { minWidth: number; minHeight: number; widget?: null | { options: any } } = {
      minWidth: 1,
      minHeight: 1,
      widget: null,
    };
    for (const inputName in inputs) {
      const inputData = inputs[inputName];
      const type = inputData[0];
      // If we're forcing the input, just do it now and forget all that widget stuff.
      // This is one of the differences from ComfyNode and provides smoother experience for inputs
      // that are going to remain inputs anyway.
      // Also, it fixes https://github.com/comfyanonymous/ComfyUI/issues/1404 (for rgthree nodes)
      if (inputData[1]?.forceInput) {
        this.addInput(inputName, type);
      } else {
        let widgetCreated = true;
        if (Array.isArray(type)) {
          // Enums
          Object.assign(config, WIDGETS.COMBO(this, inputName, inputData, app) || {});
        } else if (`${type}:${inputName}` in WIDGETS) {
          // Support custom widgets by Type:Name
          Object.assign(
            config,
            WIDGETS[`${type}:${inputName}`](this, inputName, inputData, app) || {},
          );
        } else if (type in WIDGETS) {
          // Standard type widgets
          Object.assign(config, WIDGETS[type](this, inputName, inputData, app) || {});
        } else {
          // Node connection inputs
          this.addInput(inputName, type);
          widgetCreated = false;
        }

        // Don't actually need this right now, but ported it over from ComfyWidget.
        if (widgetCreated && inputData[1]?.forceInput && config?.widget) {
          if (!config.widget.options) config.widget.options = {};
          config.widget.options.forceInput = inputData[1].forceInput;
        }
        if (widgetCreated && inputData[1]?.defaultInput && config?.widget) {
          if (!config.widget.options) config.widget.options = {};
          config.widget.options.defaultInput = inputData[1].defaultInput;
        }
      }
    }

    for (const o in nodeData["output"]) {
      let output = nodeData["output"][o];
      if (output instanceof Array) output = "COMBO";
      const outputName = nodeData["output_name"][o] || output;
      const outputShape = nodeData["output_is_list"][o]
        ? LiteGraph.GRID_SHAPE
        : LiteGraph.CIRCLE_SHAPE;
      this.addOutput(outputName, output, { shape: outputShape });
    }

    const s = this.computeSize();
    s[0] = Math.max(config.minWidth, s[0] * 1.5);
    s[1] = Math.max(config.minHeight, s[1]);
    this.size = s;
    this.serialize_widgets = true;
  }

  static __registeredForOverride__: boolean = false;
  static registerForOverride(comfyClass: any, rgthreeClass: any) {
    if (overriddenServerNodes.has(comfyClass)) {
      throw Error(
        `Already have a class to overridde ${
          comfyClass.type || comfyClass.name || comfyClass.title
        }`,
      );
    }
    overriddenServerNodes.set(comfyClass, rgthreeClass);
    // Mark the rgthreeClass as `__registeredForOverride__` because ComfyUI will repeatedly call
    // this and certain setups will only want to setup once (like adding context menus, etc).
    if (!rgthreeClass.__registeredForOverride__) {
      rgthreeClass.__registeredForOverride__ = true;
      rgthreeClass.onRegisteredForOverride(comfyClass, rgthreeClass);
    }
  }

  static onRegisteredForOverride(comfyClass: any, rgthreeClass: any) {
    // To be overridden
  }
}

const oldregisterNodeType = LiteGraph.registerNodeType;
/**
 * ComfyUI calls registerNodeType with its ComfyNode, but we don't trust that will remain stable, so
 * we need to identify it, intercept it, and supply our own class for the node.
 */
LiteGraph.registerNodeType = function (nodeId: string, baseClass: any) {
  const clazz = overriddenServerNodes.get(baseClass) || baseClass;
  if (clazz !== baseClass) {
    const classLabel = clazz.type || clazz.name || clazz.title;
    const [n, v] = rgthree.logger.debugParts(
      `${nodeId}: replacing default ComfyNode implementation with custom ${classLabel} class.`,
    );
    console[n]?.(...v);
  }

  return oldregisterNodeType.call(LiteGraph, nodeId, clazz);
};
