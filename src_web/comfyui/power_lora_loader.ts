// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
import type {
  ContextMenuItem,
  LGraphNode as TLGraphNode,
  LiteGraph as TLiteGraph,
  IWidget,
  LGraphCanvas,
  SerializedLGraphNode,
  Vector2,
  AdjustedMouseEvent,
} from "typings/litegraph.js";
import type { ComfyObjectInfo, ComfyNodeConstructor } from "typings/comfy.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
import { addConnectionLayoutSupport } from "./utils.js";
import { NodeTypesString } from "./constants.js";
import { drawRoundedRectangle, fitString, isLowQuality } from "./utils_canvas.js";
import {
  RgthreeBaseWidget,
  RgthreeBetterButtonWidget,
  RgthreeDividerWidget,
  drawLabelAndValue,
} from "./utils_widgets.js";
import { rgthreeApi } from "rgthree/common/rgthree_api.js";
import { showLoraChooser } from "./utils_menu.js";
import { moveArrayItem, removeArrayItem } from "rgthree/common/shared_utils.js";

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;

/**
 * The Power Lora Loader is a super-simply Lora Loader node that can load multiple Loras at once,
 * and quick toggle each, all in an ultra-condensed node.
 */
class RgthreePowerLoraLoader extends RgthreeBaseServerNode {
  static override title = NodeTypesString.POWER_LORA_LOADER;
  static override type = NodeTypesString.POWER_LORA_LOADER;
  static comfyClass = NodeTypesString.POWER_LORA_LOADER;

  private logger = rgthree.newLogSession(`[Power Lora Stack]`);

  /** Keep track of the spacer, new lora widgets will go before it when it exists. */
  private widgetButtonSpacer: IWidget | null = null;
  /** Counts the number of lora widgets. This is used to give unique names.  */
  private loraWidgetsCounter = 0;

  override serialize_widgets = true;

  constructor(title = NODE_CLASS.title) {
    super(title);
    rgthreeApi.getLoras();
  }

  /**
   * Handles configuration from a saved workflow by first removing our default widgets that were
   * added in `onNodeCreated`, letting `super.configure` and do nothing, then create our lora
   * widgets and, finally, add back in our default widgets.
   */
  override configure(info: SerializedLGraphNode<TLGraphNode>): void {
    while (this.widgets?.length) this.removeWidget(0);
    this.widgetButtonSpacer = null;
    super.configure(info);

    // Since we add the widgets dynamically, we need to wait to set their values
    // with a short timeout.
    setTimeout(() => {
      (this as any)._tempWidth = this.size[0];
      (this as any)._tempHeight = this.size[1];
      for (const widgetValue of info.widgets_values || []) {
        if (widgetValue?.lora !== undefined) {
          const widget = this.addNewLoraWidget();
          widget.value = { ...widgetValue };
        }
      }
      this.addNonLoraWidgets();
      this.size[0] = (this as any)._tempWidth;
      this.size[1] = Math.max((this as any)._tempHeight, this.computeSize()[1]);
    }, 100);
  }

  /**
   * Adds the non-lora widgets. If we'll be configured then we remove them and add them back, so
   * this is really only for newly created nodes in the current session.
   */
  override onNodeCreated() {
    super.onNodeCreated?.();
    this.addNonLoraWidgets();
  }

  /** Adds a new lora widget in the proper space. */
  private addNewLoraWidget(lora?: string) {
    this.loraWidgetsCounter++;
    const widget = this.addCustomWidget(
      new PowerLoraLoaderWidget("lora_" + this.loraWidgetsCounter),
    );
    if (lora) widget.setLora(lora);
    if (this.widgetButtonSpacer) {
      moveArrayItem(this.widgets, widget, this.widgets.indexOf(this.widgetButtonSpacer));
    }
    return widget;
  }

  /** Adds the non-lora widgets around any lora ones that may be there from configuration. */
  private addNonLoraWidgets() {
    const initialSpacer = this.addCustomWidget(
      new RgthreeDividerWidget({ marginTop: 4, marginBottom: 0, thickness: 0 }),
    );
    moveArrayItem(this.widgets, initialSpacer, 0);

    this.widgetButtonSpacer = this.addCustomWidget(
      new RgthreeDividerWidget({ marginTop: 4, marginBottom: 0, thickness: 0 }),
    );

    this.addCustomWidget(
      new RgthreeBetterButtonWidget(
        "➕ Add Lora",
        (event: AdjustedMouseEvent, pos: Vector2, node: TLGraphNode) => {
          showLoraChooser(event as PointerEvent, (value: ContextMenuItem) => {
            if (typeof value === "string") {
              if (value !== "NONE") {
                this.addNewLoraWidget(value);
                this.size[1] = Math.max((this as any)._tempHeight, this.computeSize()[1]);
              }
            }
          });
          return true;
        },
      ),
    );
  }

  /**
   * Hacks the `getSlotInPosition` call amde from LiteGraph. This should only get Inputs or Outputs
   * but we also want to provide some options when clicking a widget. So, we'll see if we clicked a
   * widget, then pass some data. LiteGraph will then immediately call `getSlotMenuOptions` with
   * that data. It will also later check `slot.input.type` (or output) to set the title, so we can
   * also override that. Otherwise, this should be pretty clean.
   */
  override getSlotInPosition(canvasX: number, canvasY: number): any {
    const slot = super.getSlotInPosition(canvasX, canvasY);
    // No slot, let's see if it's a widget.
    if (!slot) {
      let lastWidget = null;
      for (const widget of this.widgets) {
        // If last_y isn't set, something is wrong. Bail.
        if (!widget.last_y) return;
        if (canvasY > this.pos[1] + widget.last_y) {
          lastWidget = widget;
          continue;
        }
        break;
      }
      // Only care about lora widget clicks.
      if (lastWidget?.name?.startsWith("lora_")) {
        return { widget: lastWidget, output: { type: "LORA WIDGET" } };
      }
    }
    return slot;
  }

  /**
   * Working with the overridden `getSlotInPosition` above, this method checks if the passed in
   * option is actually a widget from it and then hijacks the context menu all together.
   */
  override getSlotMenuOptions(slot: any): ContextMenuItem[] | null {
    // Oddly, LiteGraph doesn't call back into our node with a custom menu (even though it let's us
    // define a custom menu to begin with... wtf?). So, we'll return null so the default is not
    // triggered and then we'll just show one ourselves because.. yea.
    if (slot?.widget?.name?.startsWith("lora_")) {
      const widget = slot.widget as PowerLoraLoaderWidget;
      const index = this.widgets.indexOf(widget);
      const canMoveUp = !!this.widgets[index - 1]?.name?.startsWith("lora_");
      const canMoveDown = !!this.widgets[index + 1]?.name?.startsWith("lora_");
      const menuItems: ContextMenuItem[] = [
        {
          content: `${widget.value.on ? "⚫" : "🟢"} Toggle ${widget.value.on ? "Off" : "On"}`,
          callback: () => {
            widget.value.on = !widget.value.on;
          },
        },
        {
          content: `⬆️ Move Up`,
          disabled: !canMoveUp,
          callback: () => {
            moveArrayItem(this.widgets, widget, index - 1);
          },
        },
        {
          content: `⬇️ Move Down`,
          disabled: !canMoveDown,
          callback: () => {
            moveArrayItem(this.widgets, widget, index + 1);
          },
        },
        null, // Divider
        {
          content: `🗑️ Remove`,
          callback: () => {
            removeArrayItem(this.widgets, widget);
          },
        },
      ];

      let canvas = app.canvas as LGraphCanvas;
      new LiteGraph.ContextMenu(
        menuItems,
        { title: "LORA WIDGET", event: rgthree.lastAdjustedMouseEvent! },
        canvas.getCanvasWindow(),
      );

      return null;
    }
    return this.defaultGetSlotMenuOptions(slot);
  }

  /**
   * When `refreshComboInNode` is called from ComfyUI, then we'll kick off a fresh loras fetch.
   */
  refreshComboInNode(defs: any) {
    rgthreeApi.getLoras(true);
  }

  static override setUp(comfyClass: any) {
    NODE_CLASS.registerForOverride(comfyClass, NODE_CLASS);
  }

  static override onRegisteredForOverride(comfyClass: any, ctxClass: any) {
    addConnectionLayoutSupport(NODE_CLASS, app, [
      ["Left", "Right"],
      ["Right", "Left"],
    ]);
    setTimeout(() => {
      NODE_CLASS.category = comfyClass.category;
    });
  }
}

const DEFAULT_LORA_WIDGET_DATA = {
  on: true,
  lora: null as string | null,
  strength: 1,
};

/**
 * The PowerLoaderWidget that combines several custom drawing and functionality in a single row.
 */
class PowerLoraLoaderWidget extends RgthreeBaseWidget implements IWidget {
  /** Whether the current mouse is down on any strength portion (for mouse move). */
  private isDownOnStrength = false;
  /** Whether the strength has changed with mouse move (to cancel mouse up). */
  private haveMouseMovedStrength = false;

  constructor(name: string) {
    super(name);
  }

  private _value = {
    on: true,
    lora: null as string | null,
    strength: 1,
  };

  /** The X Bounds in the widget that each were drawn at. */
  private renderData = {
    toggleX: [0, 0] as Vector2,
    loraX: [0, 0] as Vector2,
    strengthArrowLessX: [0, 0] as Vector2,
    strengthX: [0, 0] as Vector2,
    strengthArrowMoreX: [0, 0] as Vector2,
  };

  set value(v) {
    this._value = v;
    // In case widgets are messed up, we can correct course here.
    if (typeof this._value !== "object") {
      this._value = { ...DEFAULT_LORA_WIDGET_DATA };
    }
  }

  get value() {
    return this._value;
  }

  setLora(lora: string) {
    this._value.lora = lora;
  }

  /** Draws our widget with a toggle, lora selector, and number selector all in a single row. */
  draw(ctx: CanvasRenderingContext2D, node: TLGraphNode, w: number, posY: number, height: number) {
    ctx.save();
    const margin = 10;
    const innerMargin = margin * 0.33;
    const lowQuality = isLowQuality();
    const midY = posY + height * 0.5;

    // We'll move posX along as we draw things.
    let posX = margin;

    // Draw the background.
    drawRoundedRectangle(ctx, { posX, posY, height, width: node.size[0] - margin * 2 });

    const toggleRadius = height * 0.36; // This is the standard toggle height calc.
    const toggleBgWidth = height * 1.5; // We don't draw a separate bg, but this would be it.

    // Toggle Track
    if (!lowQuality) {
      ctx.beginPath();
      ctx.roundRect(posX + 4, posY + 4, toggleBgWidth - 8, height - 8, [height * 0.5]);
      ctx.globalAlpha = app.canvas.editor_alpha * 0.25;
      ctx.fillStyle = "#888";
      ctx.fill();
      ctx.globalAlpha = app.canvas.editor_alpha;
    }

    // Toggle itself
    ctx.fillStyle = this.value.on ? "#89B" : !lowQuality ? "#777" : "#333"; // "#89A" : "#333";
    const toggleX = !lowQuality && this.value.on ? posX + height : posX + height * 0.5;
    ctx.beginPath();
    ctx.arc(toggleX, posY + height * 0.5, toggleRadius, 0, Math.PI * 2);
    ctx.fill();

    // Set the rendering data...
    this.renderData.toggleX[0] = posX;
    this.renderData.toggleX[1] = posX + toggleBgWidth;
    // ... and move posX along
    posX = this.renderData.toggleX[1];
    posX += innerMargin;

    // IF low qualirty, then we're done rendering.
    if (lowQuality) {
      ctx.restore();
      return;
    }

    // If we're not toggled on, then make everything after faded.
    if (!this.value.on) {
      ctx.globalAlpha = app.canvas.editor_alpha * 0.4;
    }

    // Pre-calculate strength widths wince lora label is flexible.
    const arrowWidth = 10;
    const strengthValueWidth = 36;
    const arrowHeight = 10; //height * 0.36 * 2;
    const strengthWidth =
      innerMargin +
      arrowWidth +
      innerMargin +
      strengthValueWidth +
      innerMargin +
      arrowWidth +
      innerMargin * 2;

    // Draw lora label
    const loraWidth = node.size[0] - margin - posX - strengthWidth;
    ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const loraLabel = String(this.value.lora || "None");
    ctx.fillText(fitString(ctx, loraLabel, loraWidth), posX, midY);

    this.renderData.loraX[0] = posX;
    this.renderData.loraX[1] = posX + loraWidth;
    posX = this.renderData.loraX[1];
    posX += innerMargin;

    // Draw the strength left arrow.
    ctx.fill(
      new Path2D(
        `M ${posX} ${midY} l ${arrowWidth} ${
          arrowHeight / 2
        } l 0 -${arrowHeight} L ${posX} ${midY} z`,
      ),
    );
    this.renderData.strengthArrowLessX[0] = posX;
    this.renderData.strengthArrowLessX[1] = posX + arrowWidth;
    posX = this.renderData.strengthArrowLessX[1];
    posX += innerMargin;

    // Draw the strength text.
    ctx.textAlign = "center";
    ctx.fillText(
      fitString(ctx, (this.value.strength ?? 1).toFixed(2), strengthValueWidth),
      posX + strengthValueWidth / 2,
      midY,
    );
    this.renderData.strengthX[0] = posX;
    this.renderData.strengthX[1] = posX + strengthValueWidth;
    posX = this.renderData.strengthX[1];
    posX += innerMargin;

    // Draw the strength right arrow.
    ctx.fill(
      new Path2D(
        `M ${posX} ${midY - arrowHeight / 2} l ${arrowWidth} ${arrowHeight / 2} l -${arrowWidth} ${
          arrowHeight / 2
        } v -${arrowHeight} z`,
      ),
    );
    this.renderData.strengthArrowMoreX[0] = posX;
    this.renderData.strengthArrowMoreX[1] = posX + arrowWidth;
    posX = this.renderData.strengthArrowMoreX[1];

    ctx.globalAlpha = app.canvas.editor_alpha;
    ctx.restore();
  }

  serializeValue(serializedNode: SerializedLGraphNode, widgetIndex: number) {
    return this.value;
  }

  /** Handles the mouse down on the widget. */
  override onMouseDown(event: AdjustedMouseEvent, pos: Vector2, node: TLGraphNode) {
    const bounds = this.renderData;
    this.isDownOnStrength = false;
    this.haveMouseMovedStrength = false;
    // Clicked the toggler.
    if (pos[0] >= bounds.toggleX[0] && pos[0] <= bounds.toggleX[1]) {
      this.value.on = !this.value.on;
      this.cancelMouseDown(); // Clear the down since we handle it.

      // Clicked the lora loader.
    } else if (pos[0] >= bounds.loraX[0] && pos[0] <= bounds.loraX[1]) {
      showLoraChooser(event, (value: ContextMenuItem) => {
        if (typeof value === "string") {
          this.value.lora = value;
        }
        node.setDirtyCanvas(true, true);
      });
      this.cancelMouseDown(); // Clear the down since we handle it.

      // Clicked the strength arrow left.
    } else if (pos[0] >= bounds.strengthArrowLessX[0] && pos[0] <= bounds.strengthArrowLessX[1]) {
      let strength = (this.value.strength ?? 1) - 0.05;
      this.value.strength = Math.round(strength * 100) / 100;

      // Clicked the strength arrow right.
    } else if (pos[0] >= bounds.strengthArrowMoreX[0] && pos[0] <= bounds.strengthArrowMoreX[1]) {
      let strength = (this.value.strength ?? 1) + 0.05;
      this.value.strength = Math.round(strength * 100) / 100;
    }
    // If we're down over any of strength parts, then allow us to move the number with mouse move.
    if (pos[0] >= bounds.strengthArrowLessX[0] && pos[0] <= bounds.strengthArrowMoreX[1]) {
      this.isDownOnStrength = true;
    }
  }

  /**
   * Handles the mouse up on the widget, fired from `RgthreeBaseWidget` when we've clicked on it and
   * released.
   */
  override onMouseUp(event: AdjustedMouseEvent, pos: Vector2, node: TLGraphNode) {
    const canvas = app.canvas as LGraphCanvas;
    const bounds = this.renderData;
    // Clicked and released the strength text, show the prompt.
    if (
      !this.haveMouseMovedStrength &&
      pos[0] >= bounds.strengthX[0] &&
      pos[0] <= bounds.strengthX[1]
    ) {
      canvas.prompt(
        "Value",
        this.value.strength,
        (v: string) => {
          this.value.strength = Number(v);
        },
        event,
      );
    }
  }

  /**
   * Handles the mouse move on the widget, fired from `RgthreeBaseWidget` when we've clicked on it
   * and have moved the mouse, even if off of the widget itself (could check check
   * `isMouseDownedAndOver` if necessary).
   */
  override onMouseMove(event: AdjustedMouseEvent, pos: Vector2, node: TLGraphNode) {
    let step = 0.5;
    if (this.isDownOnStrength && event.deltaX) {
      this.haveMouseMovedStrength = true;
      this.value.strength += event.deltaX * 0.1 * step;
    }
  }
}

/** An uniformed name reference to the node class. */
const NODE_CLASS = RgthreePowerLoraLoader;

/** Register the node. */
app.registerExtension({
  name: "rgthree.PowerLoraLoader",
  async beforeRegisterNodeDef(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    if (nodeData.name === NODE_CLASS.type) {
      NODE_CLASS.nodeType = nodeType;
      NODE_CLASS.nodeData = nodeData;
      NODE_CLASS.setUp(nodeType as any);
    }
  },
});
