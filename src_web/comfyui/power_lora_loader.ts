import type {
  ComfyNodeDef,
  LGraphNode as TLGraphNode,
  LGraphCanvas,
  Point,
  IContextMenuValue,
  IFoundSlot,
  CanvasMouseEvent,
  ISerialisedNode,
  ICustomWidget,
  CanvasPointerEvent,
} from "@comfyorg/frontend";
import type {ComfyApiFormat} from "typings/comfy.js";
import type {RgthreeModelInfo} from "typings/rgthree.js";

import {app} from "scripts/app.js";
import {RgthreeBaseServerNode} from "./base_node.js";
import {rgthree} from "./rgthree.js";
import {addConnectionLayoutSupport} from "./utils.js";
import {NodeTypesString} from "./constants.js";
import {
  drawInfoIcon,
  drawNumberWidgetPart,
  drawRoundedRectangle,
  drawTogglePart,
  fitString,
  isLowQuality,
} from "./utils_canvas.js";
import {
  RgthreeBaseHitAreas,
  RgthreeBaseWidget,
  RgthreeBetterButtonWidget,
  RgthreeDividerWidget,
} from "./utils_widgets.js";
import {rgthreeApi} from "rgthree/common/rgthree_api.js";
import {SERVICE as CONFIG_SERVICE} from "./services/config_service.js";
import {showLoraChooser} from "./utils_menu.js";
import {moveArrayItem, removeArrayItem} from "rgthree/common/shared_utils.js";
import {RgthreeLoraInfoDialog} from "./dialog_info.js";
import {LORA_INFO_SERVICE} from "rgthree/common/model_info_service.js";
import {resolveLoraPath, type LoraPathResult} from "rgthree/common/lora_path_utils.js";
// import { RgthreePowerLoraChooserDialog } from "./dialog_power_lora_chooser.js";

const PROP_LABEL_SHOW_STRENGTHS = "Show Strengths";
const PROP_LABEL_SHOW_STRENGTHS_STATIC = `@${PROP_LABEL_SHOW_STRENGTHS}`;
const PROP_LABEL_LORA_MATCH = "Match";
const PROP_LABEL_LORA_MATCH_STATIC = `@${PROP_LABEL_LORA_MATCH}`;
const PROP_VALUE_SHOW_STRENGTHS_SINGLE = "Single Strength";
const PROP_VALUE_SHOW_STRENGTHS_SEPARATE = "Separate Model & Clip";

const MSG_ID_LORA_PATHS = "power-lora-loader-paths";

/** The result of verifying the lora paths of one or more Power Lora Loader nodes. */
type LoraPathsSummary = {
  /** Loras whose path differed by separator, case, or extension from a lora on the server. */
  fixable: LoraPathResult[];
  /** Loras found under a different folder than the one saved in the workflow. */
  relocated: LoraPathResult[];
  /** Loras where more than one file on the server could be the match. */
  ambiguous: LoraPathResult[];
  /** Loras not found on the server at all. */
  missing: LoraPathResult[];
};

function newLoraPathsSummary(): LoraPathsSummary {
  return {fixable: [], relocated: [], ambiguous: [], missing: []};
}

function mergeLoraPathsSummaries(summaries: LoraPathsSummary[]): LoraPathsSummary {
  const merged = newLoraPathsSummary();
  for (const s of summaries) {
    merged.fixable.push(...s.fixable);
    merged.relocated.push(...s.relocated);
    merged.ambiguous.push(...s.ambiguous);
    merged.missing.push(...s.missing);
  }
  return merged;
}

function escapeHtml(str: string) {
  return str.replace(
    /[&<>"']/g,
    (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]!,
  );
}

/** Builds a short, human readable list of lora names, truncating after a few. */
function loraNamesList(results: LoraPathResult[], max = 3) {
  const names = [...new Set(results.map((r) => r.original))];
  let list = names
    .slice(0, max)
    .map((n) => `<code>${escapeHtml(n)}</code>`)
    .join(", ");
  if (names.length > max) {
    list += ` and ${names.length - max} more`;
  }
  return list;
}

function plural(num: number, singular: string, pluralStr = `${singular}s`) {
  return `${num} ${num === 1 ? singular : pluralStr}`;
}

/**
 * Shows a message at the top of the screen describing a lora paths summary. When there are
 * fixable paths and `onFix` is supplied, a "Fix paths" action is shown.
 */
function showLoraPathsMessage(summary: LoraPathsSummary, onFix?: () => void, numFixed = 0) {
  const numFixable = summary.fixable.length + summary.relocated.length;
  const lines: string[] = [];
  if (numFixed) {
    lines.push(`Corrected ${plural(numFixed, "lora path")}.`);
  }
  if (numFixable) {
    lines.push(
      `${plural(numFixable, "lora path")} can be corrected` +
        (summary.relocated.length
          ? ` (${summary.relocated.length} found in a different folder)`
          : "") +
        ".",
    );
  }
  if (summary.ambiguous.length) {
    lines.push(
      `${plural(summary.ambiguous.length, "lora")} matched more than one file and need choosing: ` +
        `${loraNamesList(summary.ambiguous)}.`,
    );
  }
  if (summary.missing.length) {
    lines.push(
      `${plural(summary.missing.length, "lora")} could not be found: ` +
        `${loraNamesList(summary.missing)}.`,
    );
  }

  const actions: {label: string; callback: (e: MouseEvent) => void}[] = [];
  if (numFixable && onFix) {
    actions.push({
      label: "Fix paths",
      callback: (e) => {
        e.preventDefault();
        e.stopPropagation();
        onFix();
      },
    });
  }
  actions.push({
    label: "Dismiss",
    callback: (e) => {
      e.preventDefault();
      e.stopPropagation();
      rgthree.hideMessage(MSG_ID_LORA_PATHS);
    },
  });

  rgthree.showMessage({
    id: MSG_ID_LORA_PATHS,
    type: summary.missing.length || summary.ambiguous.length ? "warn" : "info",
    message: `<b>Power Lora Loader</b>: ${lines.join(" ")}`,
    actions,
  });
}

/** Lets ComfyUI know the workflow changed when we modify widget values outside of the canvas. */
function markWorkflowChanged() {
  app.graph?.setDirtyCanvas(true, true);
  try {
    (app as any).extensionManager?.workflow?.activeWorkflow?.changeTracker?.checkState?.();
  } catch (e) {
    // Not critical; ComfyUI will pick up the change on the next interaction.
  }
}

/**
 * The Power Lora Loader is a super-simply Lora Loader node that can load multiple Loras at once
 * in an ultra-condensed node allowing fast toggling, and advanced strength setting.
 */
class RgthreePowerLoraLoader extends RgthreeBaseServerNode {
  static override title = NodeTypesString.POWER_LORA_LOADER;
  static override type = NodeTypesString.POWER_LORA_LOADER;
  static comfyClass = NodeTypesString.POWER_LORA_LOADER;

  override serialize_widgets = true;

  private logger = rgthree.newLogSession(`[Power Lora Stack]`);

  static [PROP_LABEL_SHOW_STRENGTHS_STATIC] = {
    type: "combo",
    values: [PROP_VALUE_SHOW_STRENGTHS_SINGLE, PROP_VALUE_SHOW_STRENGTHS_SEPARATE],
  };

  static [PROP_LABEL_LORA_MATCH_STATIC] = {
    type: "string",
  };

  /** Counts the number of lora widgets. This is used to give unique names.  */
  private loraWidgetsCounter = 0;

  /** Keep track of the spacer, new lora widgets will go before it when it exists. */
  private widgetButtonSpacer: ICustomWidget | null = null;

  constructor(title = NODE_CLASS.title) {
    super(title);

    this.properties[PROP_LABEL_SHOW_STRENGTHS] = PROP_VALUE_SHOW_STRENGTHS_SINGLE;
    this.properties[PROP_LABEL_LORA_MATCH] = "";

    // Prefetch loras list.
    rgthreeApi.getLoras();

    // [🤮] If ComfyUI is loading from API JSON it doesn't pass us the actual information at all
    // (like, in a `configure` call) and tries to set the widget data on its own. Unfortunately,
    // since Power Lora Loader has dynamic widgets, this fails on ComfyUI's side. We can do so after
    // the fact but, unfortuntely, we need to do it after a timeout since we don't have any
    // information at this point to be able to tell what data we need (like, even the node id, let
    // alone the actual data).
    if (rgthree.loadingApiJson) {
      const fullApiJson = rgthree.loadingApiJson;
      setTimeout(() => {
        this.configureFromApiJson(fullApiJson);
      }, 16);
    }
  }

  private configureFromApiJson(fullApiJson: ComfyApiFormat) {
    if (this.id == null) {
      const [n, v] = this.logger.errorParts("Cannot load from API JSON without node id.");
      console[n]?.(...v);
      return;
    }
    const nodeData =
      fullApiJson[this.id] || fullApiJson[String(this.id)] || fullApiJson[Number(this.id)];
    if (nodeData == null) {
      const [n, v] = this.logger.errorParts(`No node found in API JSON for node id ${this.id}.`);
      console[n]?.(...v);
      return;
    }
    this.configure({
      widgets_values: Object.values(nodeData.inputs).filter(
        (input) => typeof (input as any)?.["lora"] === "string",
      ),
    });
  }

  /**
   * Handles configuration from a saved workflow by first removing our default widgets that were
   * added in `onNodeCreated`, letting `super.configure` and do nothing, then create our lora
   * widgets and, finally, add back in our default widgets.
   */
  override configure(
    info: ISerialisedNode | {widgets_values: ISerialisedNode["widgets_values"]},
  ): void {
    while (this.widgets?.length) this.removeWidget(0);
    this.widgetButtonSpacer = null;
    // Since we may be calling into configure manually for just widgets_values setting (like, from
    // API JSON) we want to only call the parent class's configure with a real ISerialisedNode data.
    if ((info as ISerialisedNode).id != null) {
      super.configure(info as ISerialisedNode);
    }

    (this as any)._tempWidth = this.size[0];
    (this as any)._tempHeight = this.size[1];
    for (const widgetValue of info.widgets_values || []) {
      if ((widgetValue as PowerLoraLoaderWidgetValue)?.lora !== undefined) {
        const widget = this.addNewLoraWidget();
        widget.value = {...(widgetValue as PowerLoraLoaderWidgetValue)};
      }
    }
    this.addNonLoraWidgets();
    this.size[0] = (this as any)._tempWidth;
    this.size[1] = Math.max((this as any)._tempHeight, this.computeSize()[1]);
    // Check (but don't change) the lora paths so missing or mismatched ones are flagged right
    // away, like when a workflow is loaded from another machine.
    this.verifyLoraPaths();
  }

  /** Returns the lora widgets on this node. */
  getLoraWidgets() {
    return (this.widgets || []).filter((w) =>
      w.name?.startsWith("lora_"),
    ) as PowerLoraLoaderWidget[];
  }

  /**
   * Checks each lora's saved path against the loras the server has, flagging any that are missing
   * or mismatched (like from a workflow saved on an OS with a different path separator).
   *
   * @param fix If true, update loras that can be confidently matched to the server's path.
   * @param refresh If true, refetch the loras list from the server first.
   */
  async verifyLoraPaths(fix = false, refresh = false): Promise<LoraPathsSummary> {
    const summary = newLoraPathsSummary();
    let available: string[];
    try {
      available = (await rgthreeApi.getLoras(refresh)).map((l) => l.file);
    } catch (e) {
      const [n, v] = this.logger.errorParts("Could not fetch loras list to verify paths.", e);
      console[n]?.(...v);
      return summary;
    }
    let changed = false;
    for (const widget of this.getLoraWidgets()) {
      const lora = widget.value?.lora;
      if (!lora || lora === "None") {
        widget.pathResult = null;
        continue;
      }
      let result = resolveLoraPath(lora, available);
      if (result.status === "fixed") summary.fixable.push(result);
      if (result.status === "relocated") summary.relocated.push(result);
      if (result.status === "ambiguous") summary.ambiguous.push(result);
      if (result.status === "missing") summary.missing.push(result);
      if (fix && result.resolved && (result.status === "fixed" || result.status === "relocated")) {
        widget.setLora(result.resolved);
        changed = true;
        result = resolveLoraPath(result.resolved, available);
      }
      widget.pathResult = result;
    }
    if (changed) {
      markWorkflowChanged();
    }
    this.setDirtyCanvas(true, true);
    return summary;
  }

  /** Verifies and fixes this node's lora paths, then shows the user what happened. */
  async verifyAndFixLoraPaths() {
    const summary = await this.verifyLoraPaths(true, true);
    const numFixed = summary.fixable.length + summary.relocated.length;
    if (summary.missing.length || summary.ambiguous.length) {
      showLoraPathsMessage({...summary, fixable: [], relocated: []}, undefined, numFixed);
    } else {
      rgthree.hideMessage(MSG_ID_LORA_PATHS);
      rgthree.showMessage({
        id: `${MSG_ID_LORA_PATHS}-fixed`,
        type: "success",
        message: numFixed
          ? `Corrected ${plural(numFixed, "lora path")}; all loras found.`
          : "All loras found.",
        timeout: 4000,
      });
    }
  }

  /**
   * Adds the non-lora widgets. If we'll be configured then we remove them and add them back, so
   * this is really only for newly created nodes in the current session.
   */
  override onNodeCreated() {
    super.onNodeCreated?.();
    this.addNonLoraWidgets();
    const computed = this.computeSize();
    this.size = this.size || [0, 0];
    this.size[0] = Math.max(this.size[0], computed[0]);
    this.size[1] = Math.max(this.size[1], computed[1]);
    this.setDirtyCanvas(true, true);
  }

  /** Adds a new lora widget in the proper slot. */
  private addNewLoraWidget(lora?: string) {
    this.loraWidgetsCounter++;
    const widget = this.addCustomWidget(
      new PowerLoraLoaderWidget("lora_" + this.loraWidgetsCounter),
    ) as PowerLoraLoaderWidget;
    if (lora) widget.setLora(lora);
    if (this.widgetButtonSpacer) {
      moveArrayItem(this.widgets, widget, this.widgets.indexOf(this.widgetButtonSpacer));
    }

    return widget;
  }

  /** Adds the non-lora widgets around any lora ones that may be there from configuration. */
  private addNonLoraWidgets() {
    moveArrayItem(
      this.widgets,
      this.addCustomWidget(new RgthreeDividerWidget({marginTop: 4, marginBottom: 0, thickness: 0})),
      0,
    );
    moveArrayItem(this.widgets, this.addCustomWidget(new PowerLoraLoaderHeaderWidget()), 1);

    this.widgetButtonSpacer = this.addCustomWidget(
      new RgthreeDividerWidget({marginTop: 4, marginBottom: 0, thickness: 0}),
    ) as RgthreeDividerWidget;

    this.addCustomWidget(
      new RgthreeBetterButtonWidget(
        "➕ Add Lora",
        (event: CanvasMouseEvent, pos: Point, node: TLGraphNode) => {
          this.showLoraChooser(event, (value: string) => {
            if (value.includes("Power Lora Chooser")) {
              // new RgthreePowerLoraChooserDialog().show();
            } else if (value !== "NONE") {
              this.addNewLoraWidget(value);
              const computed = this.computeSize();
              const tempHeight = (this as any)._tempHeight ?? 15;
              this.size[1] = Math.max(tempHeight, computed[1]);
              this.setDirtyCanvas(true, true);
            }
            // }, null, ["⚡️ Power Lora Chooser", ...loras]);
          });
          return true;
        },
      ),
    );
  }

  async showLoraChooser(event: CanvasMouseEvent, onChoose: (value: string) => void) {
    const lorasDetails = await rgthreeApi.getLoras();
    let loras = lorasDetails.map((l) => l.file);
    let prefix = "";
    if (this.properties[PROP_LABEL_LORA_MATCH]) {
      const rgx = new RegExp(this.properties[PROP_LABEL_LORA_MATCH] as string);
      loras = loras.filter((l) => l.match(rgx));
      if (loras[0]) {
        prefix = loras[0];
        for (const lora of loras) {
          let similar = "";
          let i = 0;
          while (prefix[i] && prefix[i] === lora[i]) {
            similar += prefix[i++];
          }
          prefix = similar;
          if (!prefix) break;
        }
        if (prefix) {
          loras = loras.map((l) => l.replace(prefix!, ""));
        }
      }
    }
    showLoraChooser(
      event as MouseEvent,
      (value: IContextMenuValue | string) => {
        if (typeof value === "string") {
          onChoose(prefix + value);
        }
        this.setDirtyCanvas(true, true);
      },
      null,
      [...loras],
    );
  }

  /**
   * Hacks the `getSlotInPosition` call made from LiteGraph so we can show a custom context menu
   * for widgets.
   *
   * Normally this method, called from LiteGraph's processContextMenu, will only get Inputs or
   * Outputs. But that's not good enough because we we also want to provide a custom menu when
   * clicking a widget for this node... so we are left to HACK once again!
   *
   * To achieve this:
   *  - Here, in LiteGraph's processContextMenu it asks the clicked node to tell it which input or
   *    output the user clicked on in `getSlotInPosition`
   *  - We check, and if we didn't, then we see if we clicked a widget and, if so, pass back some
   *    data that looks like we clicked an output to fool LiteGraph like a silly child.
   *  - As LiteGraph continues in its `processContextMenu`, it will then immediately call
   *    the clicked node's `getSlotMenuOptions` when `getSlotInPosition` returns data.
   *  - So, just below, we can then give LiteGraph the ContextMenu options we have.
   *
   * The only issue is that LiteGraph also checks `input/output.type` to set the ContextMenu title,
   * so we need to supply that property (and set it to what we want our title). Otherwise, this
   * should be pretty clean.
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
        return {widget: lastWidget, output: {type: "LORA WIDGET"}};
      }
    }
    return slot;
  }

  /**
   * Working with the overridden `getSlotInPosition` above, this method checks if the passed in
   * option is actually a widget from it and then hijacks the context menu all together.
   */
  override getSlotMenuOptions(slot: IFoundSlot) {
    // Oddly, LiteGraph doesn't call back into our node with a custom menu (even though it let's us
    // define a custom menu to begin with... wtf?). So, we'll return null so the default is not
    // triggered and then we'll just show one ourselves because.. yea.
    if (slot?.widget?.name?.startsWith("lora_")) {
      const widget = slot.widget as PowerLoraLoaderWidget;
      const index = this.widgets.indexOf(widget);
      const canMoveUp = !!this.widgets[index - 1]?.name?.startsWith("lora_");
      const canMoveDown = !!this.widgets[index + 1]?.name?.startsWith("lora_");
      const menuItems: (IContextMenuValue | null)[] = [];
      // If the lora's saved path matched more than one file on the server, let the user pick.
      if (widget.pathResult?.status === "ambiguous") {
        menuItems.push(
          {
            content: `⚠️ Choose Matching Lora`,
            has_submenu: true,
            submenu: {
              options: widget.pathResult.candidates,
              callback: (value: any) => {
                widget.setLora(String(value));
                this.verifyLoraPaths();
                markWorkflowChanged();
              },
            },
          } as IContextMenuValue,
          null,
        );
      }
      menuItems.push(
        {
          content: `ℹ️ Show Info`,
          callback: () => {
            widget.showLoraInfoDialog();
          },
        },
        null, // Divider
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
        {
          content: `🗑️ Remove`,
          callback: () => {
            removeArrayItem(this.widgets, widget);
          },
        },
      );
      new LiteGraph.ContextMenu(menuItems, {
        title: "LORA WIDGET",
        event: rgthree.lastCanvasMouseEvent!,
      });

      // [🤮] ComfyUI doesn't have a possible return type as falsy, even though the impl skips the
      // menu when the return is falsy. Casting as any.
      return undefined as any;
    }
    return this.defaultGetSlotMenuOptions(slot);
  }

  /**
   * When `refreshComboInNode` is called from ComfyUI, then we'll kick off a fresh loras fetch.
   */
  override refreshComboInNode(defs: any) {
    this.verifyLoraPaths(false, true);
  }

  override getExtraMenuOptions(
    canvas: LGraphCanvas,
    options: (IContextMenuValue<unknown> | null)[],
  ) {
    super.getExtraMenuOptions(canvas, options);
    options.splice(
      0,
      0,
      {
        content: "🔍 Verify & Fix Lora Paths",
        disabled: !this.hasLoraWidgets(),
        callback: () => {
          this.verifyAndFixLoraPaths();
        },
      },
      null,
    );
    return [];
  }

  /**
   * Returns true if there are any Lora Widgets. Useful for widgets to ask as they render.
   */
  hasLoraWidgets() {
    return !!this.widgets?.find((w) => w.name?.startsWith("lora_"));
  }

  /**
   * This will return true when all lora widgets are on, false when all are off, or null if it's
   * mixed.
   */
  allLorasState() {
    let allOn = true;
    let allOff = true;
    for (const widget of this.widgets) {
      if (widget.name?.startsWith("lora_")) {
        const on = (widget.value as any)?.on;
        allOn = allOn && on === true;
        allOff = allOff && on === false;
        if (!allOn && !allOff) {
          return null;
        }
      }
    }
    return allOn && this.widgets?.length ? true : false;
  }

  /**
   * Toggles all the loras on or off.
   */
  toggleAllLoras() {
    const allOn = this.allLorasState();
    const toggledTo = !allOn ? true : false;
    for (const widget of this.widgets) {
      if (widget.name?.startsWith("lora_") && (widget.value as any)?.on != null) {
        (widget.value as any).on = toggledTo;
      }
    }
  }

  static override setUp(comfyClass: typeof LGraphNode, nodeData: ComfyNodeDef) {
    RgthreeBaseServerNode.registerForOverride(comfyClass, nodeData, NODE_CLASS);
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

  override getHelp() {
    return `
      <p>
        The ${this.type!.replace("(rgthree)", "")} is a powerful node that condenses 100s of pixels
        of functionality in a single, dynamic node that allows you to add loras, change strengths,
        and quickly toggle on/off all without taking up half your screen.
      </p>
      <ul>
        <li><p>
          Add as many Lora's as you would like by clicking the "+ Add Lora" button.
          There's no real limit!
        </p></li>
        <li><p>
          Right-click on a Lora widget for special options to move the lora up or down
          (no image affect, only presentational), toggle it on/off, or delete the row all together.
        </p></li>
        <li>
          <p>
            <strong>Properties.</strong> You can change the following properties (by right-clicking
            on the node, and select "Properties" or "Properties Panel" from the menu):
          </p>
          <ul>
            <li><p>
              <code>${PROP_LABEL_SHOW_STRENGTHS}</code> - Change between showing a single, simple
              strength (which will be used for both model and clip), or a more advanced view with
              both model and clip strengths being modifiable.
            </p></li>
          </ul>
        </li>
      </ul>`;
  }
}

/**
 * The PowerLoraLoaderHeaderWidget that renders a toggle all switch, as well as some title info
 * (more necessary for the double model & clip strengths to label them).
 */
class PowerLoraLoaderHeaderWidget extends RgthreeBaseWidget<{type: string}> {
  override value = {type: "PowerLoraLoaderHeaderWidget"};
  override readonly type = "custom";

  protected override hitAreas: RgthreeBaseHitAreas<"toggle"> = {
    toggle: {bounds: [0, 0] as Point, onDown: this.onToggleDown},
  };

  private showModelAndClip: boolean | null = null;

  constructor(name: string = "PowerLoraLoaderHeaderWidget") {
    super(name);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    node: RgthreePowerLoraLoader,
    w: number,
    posY: number,
    height: number,
  ) {
    if (!node.hasLoraWidgets()) {
      return;
    }
    // Since draw is the loop that runs, this is where we'll check the property state (rather than
    // expect the node to tell us it's state etc).
    this.showModelAndClip =
      node.properties[PROP_LABEL_SHOW_STRENGTHS] === PROP_VALUE_SHOW_STRENGTHS_SEPARATE;
    const margin = 10;
    const innerMargin = margin * 0.33;
    const lowQuality = isLowQuality();
    const allLoraState = node.allLorasState();

    // Move slightly down. We don't have a border and this feels a bit nicer.
    posY += 2;
    const midY = posY + height * 0.5;
    let posX = 10;
    ctx.save();
    this.hitAreas.toggle.bounds = drawTogglePart(ctx, {posX, posY, height, value: allLoraState});

    if (!lowQuality) {
      posX += this.hitAreas.toggle.bounds[1] + innerMargin;

      ctx.globalAlpha = app.canvas.editor_alpha * 0.55;
      ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("Toggle All", posX, midY);

      let rposX = node.size[0] - margin - innerMargin - innerMargin;
      ctx.textAlign = "center";
      ctx.fillText(
        this.showModelAndClip ? "Clip" : "Strength",
        rposX - drawNumberWidgetPart.WIDTH_TOTAL / 2,
        midY,
      );
      if (this.showModelAndClip) {
        rposX = rposX - drawNumberWidgetPart.WIDTH_TOTAL - innerMargin * 2;
        ctx.fillText("Model", rposX - drawNumberWidgetPart.WIDTH_TOTAL / 2, midY);
      }
    }
    ctx.restore();
  }

  /**
   * Handles a pointer down on the toggle's defined hit area.
   */
  onToggleDown(event: CanvasMouseEvent, pos: Point, node: TLGraphNode) {
    (node as RgthreePowerLoraLoader).toggleAllLoras();
    this.cancelMouseDown();
    return true;
  }
}

const DEFAULT_LORA_WIDGET_DATA: PowerLoraLoaderWidgetValue = {
  on: true,
  lora: null as string | null,
  strength: 1,
  strengthTwo: null as number | null,
};

type PowerLoraLoaderWidgetValue = {
  on: boolean;
  lora: string | null;
  strength: number;
  strengthTwo: number | null;
};

/**
 * The PowerLoaderWidget that combines several custom drawing and functionality in a single row.
 */
class PowerLoraLoaderWidget extends RgthreeBaseWidget<PowerLoraLoaderWidgetValue> {
  override readonly type = "custom";

  /** Whether the strength has changed with mouse move (to cancel mouse up). */
  private haveMouseMovedStrength = false;
  private loraInfoPromise: Promise<RgthreeModelInfo | null> | null = null;
  private loraInfo: RgthreeModelInfo | null = null;

  private showModelAndClip: boolean | null = null;

  /** The result of the last path verification for this lora, set by the node. */
  pathResult: LoraPathResult | null = null;

  protected override hitAreas: RgthreeBaseHitAreas<
    | "toggle"
    | "lora"
    | "info"
    | "strengthDec"
    | "strengthVal"
    | "strengthInc"
    | "strengthAny"
    | "strengthTwoDec"
    | "strengthTwoVal"
    | "strengthTwoInc"
    | "strengthTwoAny"
  > = {
    toggle: {bounds: [0, 0] as Point, onDown: this.onToggleDown},
    lora: {bounds: [0, 0] as Point, onClick: this.onLoraClick},
    info: {bounds: [0, 0] as Point, onDown: this.onInfoDown},

    strengthDec: {bounds: [0, 0] as Point, onClick: this.onStrengthDecDown},
    strengthVal: {bounds: [0, 0] as Point, onClick: this.onStrengthValUp},
    strengthInc: {bounds: [0, 0] as Point, onClick: this.onStrengthIncDown},
    strengthAny: {bounds: [0, 0] as Point, onMove: this.onStrengthAnyMove},

    strengthTwoDec: {bounds: [0, 0] as Point, onClick: this.onStrengthTwoDecDown},
    strengthTwoVal: {bounds: [0, 0] as Point, onClick: this.onStrengthTwoValUp},
    strengthTwoInc: {bounds: [0, 0] as Point, onClick: this.onStrengthTwoIncDown},
    strengthTwoAny: {bounds: [0, 0] as Point, onMove: this.onStrengthTwoAnyMove},
  };

  constructor(name: string) {
    super(name);
  }

  private _value = {
    on: true,
    lora: null as string | null,
    strength: 1,
    strengthTwo: null as number | null,
  };

  set value(v) {
    this._value = v;
    // In case widgets are messed up, we can correct course here.
    if (typeof this._value !== "object") {
      this._value = {...DEFAULT_LORA_WIDGET_DATA};
      if (this.showModelAndClip) {
        this._value.strengthTwo = this._value.strength;
      }
    }
    this.getLoraInfo();
  }

  get value() {
    return this._value;
  }

  setLora(lora: string) {
    this._value.lora = lora;
    this.pathResult = null;
    this.resetLoraInfo();
  }

  /** Draws our widget with a toggle, lora selector, and number selector all in a single row. */
  draw(ctx: CanvasRenderingContext2D, node: TLGraphNode, w: number, posY: number, height: number) {
    // Since draw is the loop that runs, this is where we'll check the property state (rather than
    // expect the node to tell us it's state etc).
    let currentShowModelAndClip =
      node.properties[PROP_LABEL_SHOW_STRENGTHS] === PROP_VALUE_SHOW_STRENGTHS_SEPARATE;
    if (this.showModelAndClip !== currentShowModelAndClip) {
      let oldShowModelAndClip = this.showModelAndClip;
      this.showModelAndClip = currentShowModelAndClip;
      if (this.showModelAndClip) {
        // If we're setting show both AND we're not null, then re-set to the current strength.
        if (oldShowModelAndClip != null) {
          this.value.strengthTwo = this.value.strength ?? 1;
        }
      } else {
        this.value.strengthTwo = null;
        this.hitAreas.strengthTwoDec.bounds = [0, -1];
        this.hitAreas.strengthTwoVal.bounds = [0, -1];
        this.hitAreas.strengthTwoInc.bounds = [0, -1];
        this.hitAreas.strengthTwoAny.bounds = [0, -1];
      }
    }

    ctx.save();
    const margin = 10;
    const innerMargin = margin * 0.33;
    const lowQuality = isLowQuality();
    const midY = posY + height * 0.5;

    // We'll move posX along as we draw things.
    let posX = margin;

    // Draw the background.
    drawRoundedRectangle(ctx, {pos: [posX, posY], size: [node.size[0] - margin * 2, height]});

    // Draw the toggle
    this.hitAreas.toggle.bounds = drawTogglePart(ctx, {posX, posY, height, value: this.value.on});
    posX += this.hitAreas.toggle.bounds[1] + innerMargin;

    // If low quality, then we're done rendering.
    if (lowQuality) {
      ctx.restore();
      return;
    }

    // If we're not toggled on, then make everything after faded.
    if (!this.value.on) {
      ctx.globalAlpha = app.canvas.editor_alpha * 0.4;
    }

    ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;

    // Now, we draw the strength number part on the right, so we know the width of it to draw the
    // lora label as flexible.
    let rposX = node.size[0] - margin - innerMargin - innerMargin;

    const strengthValue = this.showModelAndClip
      ? (this.value.strengthTwo ?? 1)
      : (this.value.strength ?? 1);

    let textColor: string | undefined = undefined;
    if (this.loraInfo?.strengthMax != null && strengthValue > this.loraInfo?.strengthMax) {
      textColor = "#c66";
    } else if (this.loraInfo?.strengthMin != null && strengthValue < this.loraInfo?.strengthMin) {
      textColor = "#c66";
    }

    const [leftArrow, text, rightArrow] = drawNumberWidgetPart(ctx, {
      posX: node.size[0] - margin - innerMargin - innerMargin,
      posY,
      height,
      value: strengthValue,
      direction: -1,
      textColor,
    });

    this.hitAreas.strengthDec.bounds = leftArrow;
    this.hitAreas.strengthVal.bounds = text;
    this.hitAreas.strengthInc.bounds = rightArrow;
    this.hitAreas.strengthAny.bounds = [leftArrow[0], rightArrow[0] + rightArrow[1] - leftArrow[0]];

    rposX = leftArrow[0] - innerMargin;

    if (this.showModelAndClip) {
      rposX -= innerMargin;
      // If we're showing both, then the rightmost we just drew is our "strengthTwo", so reset and
      // then draw our model ("strength" one) to the left.
      this.hitAreas.strengthTwoDec.bounds = this.hitAreas.strengthDec.bounds;
      this.hitAreas.strengthTwoVal.bounds = this.hitAreas.strengthVal.bounds;
      this.hitAreas.strengthTwoInc.bounds = this.hitAreas.strengthInc.bounds;
      this.hitAreas.strengthTwoAny.bounds = this.hitAreas.strengthAny.bounds;

      let textColor: string | undefined = undefined;
      if (this.loraInfo?.strengthMax != null && this.value.strength > this.loraInfo?.strengthMax) {
        textColor = "#c66";
      } else if (
        this.loraInfo?.strengthMin != null &&
        this.value.strength < this.loraInfo?.strengthMin
      ) {
        textColor = "#c66";
      }
      const [leftArrow, text, rightArrow] = drawNumberWidgetPart(ctx, {
        posX: rposX,
        posY,
        height,
        value: this.value.strength ?? 1,
        direction: -1,
        textColor,
      });
      this.hitAreas.strengthDec.bounds = leftArrow;
      this.hitAreas.strengthVal.bounds = text;
      this.hitAreas.strengthInc.bounds = rightArrow;
      this.hitAreas.strengthAny.bounds = [
        leftArrow[0],
        rightArrow[0] + rightArrow[1] - leftArrow[0],
      ];
      rposX = leftArrow[0] - innerMargin;
    }

    const infoIconSize = height * 0.66;
    const infoWidth = infoIconSize + innerMargin + innerMargin;
    // Draw an info emoji; if checks if it's enabled (to quickly turn it on or off)
    if (CONFIG_SERVICE.getConfigValue("nodes.power_lora_loader.show_info_badge")) {
      rposX -= innerMargin;
      drawInfoIcon(
        ctx,
        rposX - infoIconSize,
        posY + (height - infoIconSize) / 2,
        infoIconSize,
        this.loraInfo?.raw?.civitai ? "FILLED" : this.loraInfo?.hasInfoFile ? "OUTLINED" : "GRAYED",
      );
      // ctx.fillText('ℹ', posX, midY);
      (this.hitAreas as any).info.bounds = [rposX - infoIconSize, infoWidth];
      rposX = rposX - infoIconSize - innerMargin;
    } else {
      (this.hitAreas as any).info.bounds = [0, 0];
    }

    // Draw lora label
    const loraWidth = rposX - posX;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let loraLabel = String(this.value?.lora || "None");
    // Flag loras that aren't on the server ("missing") in red, and those that are there under a
    // different path, or can't be determined, in amber, until fixed.
    const pathStatus = this.pathResult?.status;
    if (pathStatus && pathStatus !== "ok") {
      ctx.fillStyle = pathStatus === "missing" ? "#c66" : "#ca6";
      loraLabel = `⚠ ${loraLabel}`;
    }
    ctx.fillText(fitString(ctx, loraLabel, loraWidth), posX, midY);
    ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;

    this.hitAreas.lora.bounds = [posX, loraWidth];
    posX += loraWidth + innerMargin;

    ctx.globalAlpha = app.canvas.editor_alpha;
    ctx.restore();
  }

  override serializeValue(
    node: TLGraphNode,
    index: number,
  ): PowerLoraLoaderWidgetValue | Promise<PowerLoraLoaderWidgetValue> {
    const v = {...this.value};
    // Never send the second value to the backend if we're not showing it, otherwise, let's just
    // make sure it's not null.
    if (!this.showModelAndClip) {
      delete (v as any).strengthTwo;
    } else {
      this.value.strengthTwo = this.value.strengthTwo ?? 1;
      v.strengthTwo = this.value.strengthTwo;
    }
    return v;
  }

  onToggleDown(event: CanvasMouseEvent, pos: Point, node: TLGraphNode) {
    this.value.on = !this.value.on;
    this.cancelMouseDown(); // Clear the down since we handle it.
    return true;
  }

  onInfoDown(event: CanvasMouseEvent, pos: Point, node: TLGraphNode) {
    this.showLoraInfoDialog();
  }

  onLoraClick(event: CanvasMouseEvent, pos: Point, node: RgthreePowerLoraLoader) {
    node.showLoraChooser(event, (value: string) => {
      this.value.lora = value;
      // Chosen from the server's list, so it's known to exist.
      this.pathResult = null;
      this.resetLoraInfo();
    });
    this.cancelMouseDown();
  }

  onStrengthDecDown(event: CanvasMouseEvent, pos: Point, node: TLGraphNode) {
    this.stepStrength(-1, false);
  }
  onStrengthIncDown(event: CanvasMouseEvent, pos: Point, node: TLGraphNode) {
    this.stepStrength(1, false);
  }
  onStrengthTwoDecDown(event: CanvasMouseEvent, pos: Point, node: TLGraphNode) {
    this.stepStrength(-1, true);
  }
  onStrengthTwoIncDown(event: CanvasMouseEvent, pos: Point, node: TLGraphNode) {
    this.stepStrength(1, true);
  }

  onStrengthAnyMove(event: CanvasMouseEvent, pos: Point, node: TLGraphNode) {
    this.doOnStrengthAnyMove(event, false);
  }

  onStrengthTwoAnyMove(event: CanvasMouseEvent, pos: Point, node: TLGraphNode) {
    this.doOnStrengthAnyMove(event, true);
  }

  private doOnStrengthAnyMove(event: CanvasMouseEvent, isTwo = false) {
    if (event.deltaX) {
      let prop: "strengthTwo" | "strength" = isTwo ? "strengthTwo" : "strength";
      this.haveMouseMovedStrength = true;
      this.value[prop] = (this.value[prop] ?? 1) + event.deltaX * 0.05;
    }
  }

  onStrengthValUp(event: CanvasPointerEvent, pos: Point, node: TLGraphNode) {
    this.doOnStrengthValUp(event, false);
  }

  onStrengthTwoValUp(event: CanvasPointerEvent, pos: Point, node: TLGraphNode) {
    this.doOnStrengthValUp(event, true);
  }

  private doOnStrengthValUp(event: CanvasPointerEvent, isTwo = false) {
    if (this.haveMouseMovedStrength) return;
    let prop: "strengthTwo" | "strength" = isTwo ? "strengthTwo" : "strength";
    const canvas = app.canvas as LGraphCanvas;
    canvas.prompt("Value", this.value[prop]!, (v: string) => (this.value[prop] = Number(v)), event);
  }

  override onMouseUp(event: CanvasPointerEvent, pos: Point, node: TLGraphNode): boolean | void {
    super.onMouseUp(event, pos, node);
    this.haveMouseMovedStrength = false;
  }

  showLoraInfoDialog() {
    if (!this.value.lora || this.value.lora === "None") {
      return;
    }
    const infoDialog = new RgthreeLoraInfoDialog(this.value.lora).show();
    infoDialog.addEventListener("close", ((e: CustomEvent<{dirty: boolean}>) => {
      if (e.detail.dirty) {
        this.getLoraInfo(true);
      }
    }) as EventListener);
  }

  private stepStrength(direction: -1 | 1, isTwo = false) {
    let step = 0.05;
    let prop: "strengthTwo" | "strength" = isTwo ? "strengthTwo" : "strength";
    let strength = (this.value[prop] ?? 1) + step * direction;
    this.value[prop] = Math.round(strength * 100) / 100;
  }

  /** Clears the lora info for a previous lora value and fetches it for the current one. */
  private resetLoraInfo() {
    this.loraInfo = null;
    this.loraInfoPromise = null;
    this.getLoraInfo();
  }

  private getLoraInfo(force = false) {
    if (!this.loraInfoPromise || force == true) {
      let promise;
      if (this.value.lora && this.value.lora != "None") {
        promise = LORA_INFO_SERVICE.getInfo(this.value.lora, force, true);
      } else {
        promise = Promise.resolve(null);
      }
      this.loraInfoPromise = promise.then((v) => (this.loraInfo = v));
    }
    return this.loraInfoPromise;
  }
}

/** An uniformed name reference to the node class. */
const NODE_CLASS = RgthreePowerLoraLoader;

/** Register the node. */
app.registerExtension({
  name: "rgthree.PowerLoraLoader",
  async beforeRegisterNodeDef(nodeType: typeof LGraphNode, nodeData: ComfyNodeDef) {
    if (nodeData.name === NODE_CLASS.type) {
      NODE_CLASS.setUp(nodeType, nodeData);
    }
  },

  /**
   * After a workflow loads, check all Power Lora Loader nodes' lora paths and, if any are
   * mismatched (like a workflow from another OS) or missing, let the user know before they queue.
   */
  async afterConfigureGraph() {
    if (!CONFIG_SERVICE.getConfigValue("nodes.power_lora_loader.verify_paths_on_load")) {
      return;
    }
    const nodes = getAllPowerLoraLoaderNodes();
    if (!nodes.length) {
      return;
    }
    const summary = mergeLoraPathsSummaries(
      await Promise.all(nodes.map((n) => n.verifyLoraPaths())),
    );
    const numIssues =
      summary.fixable.length +
      summary.relocated.length +
      summary.ambiguous.length +
      summary.missing.length;
    if (!numIssues) {
      return;
    }
    showLoraPathsMessage(summary, async () => {
      const fixed = mergeLoraPathsSummaries(
        await Promise.all(getAllPowerLoraLoaderNodes().map((n) => n.verifyLoraPaths(true))),
      );
      const numFixed = fixed.fixable.length + fixed.relocated.length;
      if (fixed.missing.length || fixed.ambiguous.length) {
        showLoraPathsMessage({...fixed, fixable: [], relocated: []}, undefined, numFixed);
      } else {
        rgthree.hideMessage(MSG_ID_LORA_PATHS);
        rgthree.showMessage({
          id: `${MSG_ID_LORA_PATHS}-fixed`,
          type: "success",
          message: `Corrected ${plural(numFixed, "lora path")}; all loras found.`,
          timeout: 4000,
        });
      }
    });
  },
});

/** Returns all Power Lora Loader nodes in the current workflow, including inside subgraphs. */
function getAllPowerLoraLoaderNodes(): RgthreePowerLoraLoader[] {
  const graphs: any[] = [app.graph];
  const subgraphs = (app.graph as any)?.subgraphs;
  if (subgraphs?.values) {
    graphs.push(...subgraphs.values());
  }
  const nodes: RgthreePowerLoraLoader[] = [];
  for (const graph of graphs) {
    for (const node of graph?.nodes ?? graph?._nodes ?? []) {
      if (node?.type === NODE_CLASS.type && typeof node.verifyLoraPaths === "function") {
        nodes.push(node as RgthreePowerLoraLoader);
      }
    }
  }
  return nodes;
}
