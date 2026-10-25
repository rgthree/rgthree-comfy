import type {
  LGraphNode,
  LGraph as TLGraph,
  LGraphCanvas as TLGraphCanvas,
  Vector2,
  Size,
  LGraphGroup,
  CanvasMouseEvent,
  Point,
} from "@comfyorg/frontend";

import {app} from "scripts/app.js";
import {RgthreeBaseVirtualNode} from "./base_node.js";
import {NodeTypesString} from "./constants.js";
import {SERVICE as FAST_GROUPS_SERVICE} from "./services/fast_groups_service.js";
import {drawNodeWidget, fitString} from "./utils_canvas.js";
import {RgthreeBaseWidget} from "./utils_widgets.js";
import { changeModeOfNodes, getGroupNodes } from "./utils.js";

const PROPERTY_SORT = "sort";
const PROPERTY_SORT_CUSTOM_ALPHA = "customSortAlphabet";
const PROPERTY_MATCH_COLORS = "matchColors";
const PROPERTY_MATCH_TITLE = "matchTitle";
const PROPERTY_SHOW_NAV = "showNav";
const PROPERTY_SHOW_ALL_GRAPHS = "showAllGraphs";
const PROPERTY_RESTRICTION = "toggleRestriction";
const PROPERTY_MANUAL_ORDER = "manualOrder";

/** How far (px, screen space) the pointer must travel vertically before a press becomes a drag. */
const DRAG_THRESHOLD_PX = 5;

/** Parses the saved manual order (a JSON array of group titles). Never throws. */
function parseManualOrder(raw: unknown): string[] {
  try {
    const arr = JSON.parse(String(raw || "[]"));
    return Array.isArray(arr) ? arr.map((t) => String(t)) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Re-fills the slots held by the currently visible groups with their new order, leaving groups that
 * are hidden (by matchTitle / matchColors / etc.) exactly where they were in the saved order.
 */
function mergeManualOrder(oldOrder: string[], visibleNewOrder: string[]): string[] {
  const visible = new Set(visibleNewOrder);
  const queue = [...visibleNewOrder];
  const merged = oldOrder.map((title) => (visible.has(title) ? queue.shift()! : title));
  return merged.concat(queue);
}

/**
 * Fast Muter implementation that looks for groups in the workflow and adds toggles to mute them.
 */
export abstract class BaseFastGroupsModeChanger extends RgthreeBaseVirtualNode {
  static override type = NodeTypesString.FAST_GROUPS_MUTER;
  static override title = NodeTypesString.FAST_GROUPS_MUTER;

  static override exposedActions = ["Mute all", "Enable all", "Toggle all"];

  readonly modeOn: number = LiteGraph.ALWAYS;
  readonly modeOff: number = LiteGraph.NEVER;

  private debouncerTempWidth: number = 0;
  tempSize: Vector2 | null = null;

  /** True while the user is dragging a row; refreshWidgets() pauses so it doesn't fight the drag. */
  draggingRows: boolean = false;

  // We don't need to serizalize since we'll just be checking group data on startup anyway
  override serialize_widgets = false;

  protected helpActions = "mute and unmute";

  static "@matchColors" = {type: "string"};
  static "@matchTitle" = {type: "string"};
  static "@showNav" = {type: "boolean"};
  static "@showAllGraphs" = {type: "boolean"};
  static "@sort" = {
    type: "combo",
    values: ["position", "alphanumeric", "custom alphabet", "manual"],
  };
  static "@customSortAlphabet" = {type: "string"};
  static "@manualOrder" = {type: "string"};

  override properties!: RgthreeBaseVirtualNode["properties"] & {
    [PROPERTY_MATCH_COLORS]: string;
    [PROPERTY_MATCH_TITLE]: string;
    [PROPERTY_SHOW_NAV]: boolean;
    [PROPERTY_SHOW_ALL_GRAPHS]: boolean;
    [PROPERTY_SORT]: string;
    [PROPERTY_SORT_CUSTOM_ALPHA]: string;
    [PROPERTY_MANUAL_ORDER]: string;
    [PROPERTY_RESTRICTION]: string;
  };

  static "@toggleRestriction" = {
    type: "combo",
    values: ["default", "max one", "always one"],
  };

  constructor(title = FastGroupsMuter.title) {
    super(title);
    this.properties[PROPERTY_MATCH_COLORS] = "";
    this.properties[PROPERTY_MATCH_TITLE] = "";
    this.properties[PROPERTY_SHOW_NAV] = true;
    this.properties[PROPERTY_SHOW_ALL_GRAPHS] = true;
    this.properties[PROPERTY_SORT] = "position";
    this.properties[PROPERTY_SORT_CUSTOM_ALPHA] = "";
    this.properties[PROPERTY_MANUAL_ORDER] = "";
    this.properties[PROPERTY_RESTRICTION] = "default";
  }

  override onConstructed(): boolean {
    this.addOutput("OPT_CONNECTION", "*");
    return super.onConstructed();
  }

  override onAdded(graph: TLGraph): void {
    FAST_GROUPS_SERVICE.addFastGroupNode(this);
  }

  override onRemoved(): void {
    FAST_GROUPS_SERVICE.removeFastGroupNode(this);
  }

  /**
   * Moves a row to the slot under the given node-local Y coordinate (used while drag-sorting).
   */
  moveRowTo(widget: FastGroupsToggleRowWidget, localY: number) {
    const rows = this.widgets;
    const from = rows.indexOf(widget);
    if (from < 0) {
      return;
    }
    // Find the last row whose top edge is at or above the pointer.
    let to = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any;
      const top = row.last_y ?? row.y;
      if (typeof top === "number" && localY >= top) {
        to = i;
      }
    }
    if (to !== from) {
      rows.splice(to, 0, rows.splice(from, 1)[0]!);
      this.setDirtyCanvas(true, false);
    }
  }

  /**
   * Saves the rows' current on-screen order as this node's manual order, and switches to it.
   */
  commitManualOrder() {
    const visible = this.widgets
      .map((w) => (w as any).group?.title as string | undefined)
      .filter((t): t is string => !!t);
    const old = parseManualOrder(this.properties?.[PROPERTY_MANUAL_ORDER]);
    this.properties[PROPERTY_MANUAL_ORDER] = JSON.stringify(mergeManualOrder(old, visible));
    this.properties[PROPERTY_SORT] = "manual";
    this.draggingRows = false;
    this.setDirtyCanvas(true, false);
  }

  refreshWidgets() {
    if (this.draggingRows) {
      return;
    }
    const canvas = app.canvas as TLGraphCanvas;
    let sort = this.properties?.[PROPERTY_SORT] || "position";
    let customAlphabet: string[] | null = null;
    let manualRank: Map<string, number> | null = null;
    if (sort === "manual") {
      // The service only knows how to sort by position / alphanumeric; start from position and then
      // re-order by the saved manual order below. Groups not in the saved order come last, in
      // position order (Array.prototype.sort is stable).
      sort = "position";
      manualRank = new Map(
        parseManualOrder(this.properties?.[PROPERTY_MANUAL_ORDER]).map((t, i) => [t, i] as [string, number]),
      );
    }
    if (sort === "custom alphabet") {
      const customAlphaStr = this.properties?.[PROPERTY_SORT_CUSTOM_ALPHA]?.replace(/\n/g, "");
      if (customAlphaStr && customAlphaStr.trim()) {
        customAlphabet = customAlphaStr.includes(",")
          ? customAlphaStr.toLocaleLowerCase().split(",")
          : customAlphaStr.toLocaleLowerCase().trim().split("");
      }
      if (!customAlphabet?.length) {
        sort = "alphanumeric";
        customAlphabet = null;
      }
    }

    const groups = [...FAST_GROUPS_SERVICE.getGroups(sort)];
    // The service will return pre-sorted groups for alphanumeric and position. If this node has a
    // custom sort, then we need to sort it manually.
    if (customAlphabet?.length) {
      groups.sort((a, b) => {
        let aIndex = -1;
        let bIndex = -1;
        // Loop and find indexes. As we're finding multiple, a single for loop is more efficient.
        for (const [index, alpha] of customAlphabet!.entries()) {
          aIndex =
            aIndex < 0 ? (a.title.toLocaleLowerCase().startsWith(alpha) ? index : -1) : aIndex;
          bIndex =
            bIndex < 0 ? (b.title.toLocaleLowerCase().startsWith(alpha) ? index : -1) : bIndex;
          if (aIndex > -1 && bIndex > -1) {
            break;
          }
        }
        // Now compare.
        if (aIndex > -1 && bIndex > -1) {
          const ret = aIndex - bIndex;
          if (ret === 0) {
            return a.title.localeCompare(b.title);
          }
          return ret;
        } else if (aIndex > -1) {
          return -1;
        } else if (bIndex > -1) {
          return 1;
        }
        return a.title.localeCompare(b.title);
      });
    }

    if (manualRank) {
      const rank = manualRank;
      groups.sort((a, b) => (rank.get(a.title) ?? Infinity) - (rank.get(b.title) ?? Infinity) || 0);
    }

    // See if we're filtering by colors, and match against the built-in keywords and actuial hex
    // values.
    let filterColors = (
      (this.properties?.[PROPERTY_MATCH_COLORS] as string)?.split(",") || []
    ).filter((c) => c.trim());
    if (filterColors.length) {
      filterColors = filterColors.map((color) => {
        color = color.trim().toLocaleLowerCase();
        if (LGraphCanvas.node_colors[color]) {
          color = LGraphCanvas.node_colors[color]!.groupcolor;
        }
        color = color.replace("#", "").toLocaleLowerCase();
        if (color.length === 3) {
          color = color.replace(/(.)(.)(.)/, "$1$1$2$2$3$3");
        }
        return `#${color}`;
      });
    }

    // Go over the groups
    let index = 0;
    for (const group of groups) {
      if (filterColors.length) {
        let groupColor = group.color?.replace("#", "").trim().toLocaleLowerCase();
        if (!groupColor) {
          continue;
        }
        if (groupColor.length === 3) {
          groupColor = groupColor.replace(/(.)(.)(.)/, "$1$1$2$2$3$3");
        }
        groupColor = `#${groupColor}`;
        if (!filterColors.includes(groupColor)) {
          continue;
        }
      }
      if (this.properties?.[PROPERTY_MATCH_TITLE]?.trim()) {
        try {
          if (!new RegExp(this.properties[PROPERTY_MATCH_TITLE], "i").exec(group.title)) {
            continue;
          }
        } catch (e) {
          console.error(e);
          continue;
        }
      }
      const showAllGraphs = this.properties?.[PROPERTY_SHOW_ALL_GRAPHS];
      if (!showAllGraphs && group.graph !== app.canvas.getCurrentGraph()) {
        continue;
      }
      let isDirty = false;
      const widgetLabel = `Enable ${group.title}`;
      let widget = this.widgets.find((w) => w.label === widgetLabel) as FastGroupsToggleRowWidget;
      if (!widget) {
        // When we add a widget, litegraph is going to mess up the size, so we
        // store it so we can retrieve it in computeSize. Hacky..
        this.tempSize = [...this.size] as Size;
        widget = this.addCustomWidget(
          new FastGroupsToggleRowWidget(group, this),
        ) as FastGroupsToggleRowWidget;
        this.setSize(this.computeSize());
        isDirty = true;
      }
      if (widget.label != widgetLabel) {
        widget.label = widgetLabel;
        isDirty = true;
      }
      if (
        group.rgthree_hasAnyActiveNode != null &&
        widget.toggled != group.rgthree_hasAnyActiveNode
      ) {
        widget.toggled = group.rgthree_hasAnyActiveNode;
        isDirty = true;
      }
      if (this.widgets[index] !== widget) {
        const oldIndex = this.widgets.findIndex((w) => w === widget);
        this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]!);
        isDirty = true;
      }
      if (isDirty) {
        this.setDirtyCanvas(true, false);
      }
      index++;
    }

    // Everything should now be in order, so let's remove all remaining widgets.
    while ((this.widgets || [])[index]) {
      this.removeWidget(index++);
    }
  }

  override computeSize(out?: Vector2) {
    let size = super.computeSize(out);
    if (this.tempSize) {
      size[0] = Math.max(this.tempSize[0], size[0]);
      size[1] = Math.max(this.tempSize[1], size[1]);
      // We sometimes get repeated calls to compute size, so debounce before clearing.
      this.debouncerTempWidth && clearTimeout(this.debouncerTempWidth);
      this.debouncerTempWidth = setTimeout(() => {
        this.tempSize = null;
      }, 32);
    }
    setTimeout(() => {
      this.graph?.setDirtyCanvas(true, true);
    }, 16);
    return size;
  }

  override async handleAction(action: string) {
    if (action === "Mute all" || action === "Bypass all") {
      const alwaysOne = this.properties?.[PROPERTY_RESTRICTION] === "always one";
      for (const [index, widget] of this.widgets.entries()) {
        (widget as any)?.doModeChange(alwaysOne && !index ? true : false, true);
      }
    } else if (action === "Enable all") {
      const onlyOne = this.properties?.[PROPERTY_RESTRICTION].includes(" one");
      for (const [index, widget] of this.widgets.entries()) {
        (widget as any)?.doModeChange(onlyOne && index > 0 ? false : true, true);
      }
    } else if (action === "Toggle all") {
      const onlyOne = this.properties?.[PROPERTY_RESTRICTION].includes(" one");
      let foundOne = false;
      for (const [index, widget] of this.widgets.entries()) {
        // If you have only one, then we'll stop at the first.
        let newValue: boolean = onlyOne && foundOne ? false : !widget.value;
        foundOne = foundOne || newValue;
        (widget as any)?.doModeChange(newValue, true);
      }
      // And if you have always one, then we'll flip the last
      if (!foundOne && this.properties?.[PROPERTY_RESTRICTION] === "always one") {
        (this.widgets[this.widgets.length - 1] as any)?.doModeChange(true, true);
      }
    }
  }

  override getHelp() {
    return `
      <p>The ${this.type!.replace(
        "(rgthree)",
        "",
      )} is an input-less node that automatically collects all groups in your current
      workflow and allows you to quickly ${this.helpActions} all nodes within the group.</p>
      <ul>
        <li>
          <p>
            <strong>Properties.</strong> You can change the following properties (by right-clicking
            on the node, and select "Properties" or "Properties Panel" from the menu):
          </p>
          <ul>
            <li><p>
              <code>${PROPERTY_MATCH_COLORS}</code> - Only add groups that match the provided
              colors. Can be ComfyUI colors (red, pale_blue) or hex codes (#a4d399). Multiple can be
              added, comma delimited.
            </p></li>
            <li><p>
              <code>${PROPERTY_MATCH_TITLE}</code> - Filter the list of toggles by title match
              (string match, or regular expression).
            </p></li>
            <li><p>
              <code>${PROPERTY_SHOW_NAV}</code> - Add / remove a quick navigation arrow to take you
              to the group. <i>(default: true)</i>
            </p></li>
            <li><p>
              <code>${PROPERTY_SHOW_ALL_GRAPHS}</code> - Show groups from all [sub]graphs in the
              workflow. <i>(default: true)</i>
            </p></li>
            <li><p>
              <code>${PROPERTY_SORT}</code> - Sort the toggles' order by "alphanumeric", graph
              "position", "custom alphabet", or "manual". <i>(default: "position")</i>
            </p></li>
            <li><p>
              <code>manual</code> sort - Click and drag a toggle row up or down to reorder it. The
              first drag switches <code>${PROPERTY_SORT}</code> to "manual" automatically, and the
              order is saved with the workflow in the <code>${PROPERTY_MANUAL_ORDER}</code> property
              (a JSON list of group titles; clear it to reset). Groups that are not in the saved
              order appear last.
            </p></li>
            <li>
              <p>
                <code>${PROPERTY_SORT_CUSTOM_ALPHA}</code> - When the
                <code>${PROPERTY_SORT}</code> property is "custom alphabet" you can define the
                alphabet to use here, which will match the <i>beginning</i> of each group name and
                sort against it. If group titles do not match any custom alphabet entry, then they
                will be put after groups that do, ordered alphanumerically.
              </p>
              <p>
                This can be a list of single characters, like "zyxw..." or comma delimited strings
                for more control, like "sdxl,pro,sd,n,p".
              </p>
              <p>
                Note, when two group title match the same custom alphabet entry, the <i>normal
                alphanumeric alphabet</i> breaks the tie. For instance, a custom alphabet of
                "e,s,d" will order groups names like "SDXL, SEGS, Detailer" eventhough the custom
                alphabet has an "e" before "d" (where one may expect "SE" to be before "SD").
              </p>
              <p>
                To have "SEGS" appear before "SDXL" you can use longer strings. For instance, the
                custom alphabet value of "se,s,f" would work here.
              </p>
            </li>
            <li><p>
              <code>${PROPERTY_RESTRICTION}</code> - Optionally, attempt to restrict the number of
              widgets that can be enabled to a maximum of one, or always one.
              </p>
              <p><em><strong>Note:</strong> If using "max one" or "always one" then this is only
              enforced when clicking a toggle on this node; if nodes within groups are changed
              outside of the initial toggle click, then these restriction will not be enforced, and
              could result in a state where more than one toggle is enabled. This could also happen
              if nodes are overlapped with multiple groups.
            </p></li>

          </ul>
        </li>
      </ul>`;
  }
}

/**
 * Fast Bypasser implementation that looks for groups in the workflow and adds toggles to mute them.
 */
export class FastGroupsMuter extends BaseFastGroupsModeChanger {
  static override type = NodeTypesString.FAST_GROUPS_MUTER;
  static override title = NodeTypesString.FAST_GROUPS_MUTER;
  override comfyClass = NodeTypesString.FAST_GROUPS_MUTER;

  static override exposedActions = ["Bypass all", "Enable all", "Toggle all"];

  protected override helpActions = "mute and unmute";

  override readonly modeOn: number = LiteGraph.ALWAYS;
  override readonly modeOff: number = LiteGraph.NEVER;

  constructor(title = FastGroupsMuter.title) {
    super(title);
    this.onConstructed();
  }
}

/**
 * The PowerLoraLoaderHeaderWidget that renders a toggle all switch, as well as some title info
 * (more necessary for the double model & clip strengths to label them).
 */
class FastGroupsToggleRowWidget extends RgthreeBaseWidget<{toggled: boolean}> {
  override value = {toggled: false};
  override options = {on: "yes", off: "no"};
  override readonly type = "custom";

  label: string = "";
  group: LGraphGroup;
  node: BaseFastGroupsModeChanger;

  constructor(group: LGraphGroup, node: BaseFastGroupsModeChanger) {
    super("RGTHREE_TOGGLE_AND_NAV");
    this.group = group;
    this.node = node;
  }

  doModeChange(force?: boolean, skipOtherNodeCheck?: boolean) {
    this.group.recomputeInsideNodes();
    const hasAnyActiveNodes = getGroupNodes(this.group).some((n) => n.mode === LiteGraph.ALWAYS);
    let newValue = force != null ? force : !hasAnyActiveNodes;
    if (skipOtherNodeCheck !== true) {
      // TODO: This work should probably live in BaseFastGroupsModeChanger instead of the widgets.
      if (newValue && this.node.properties?.[PROPERTY_RESTRICTION]?.includes(" one")) {
        for (const widget of this.node.widgets) {
          if ("doModeChange" in widget && typeof widget.doModeChange === "function") {
            widget.doModeChange(false, true);
          }
        }
      } else if (!newValue && this.node.properties?.[PROPERTY_RESTRICTION] === "always one") {
        newValue = this.node.widgets.every((w) => w === this || !("toggled" in w && w.toggled));
      }
    }
    changeModeOfNodes(getGroupNodes(this.group), (newValue ? this.node.modeOn : this.node.modeOff));
    this.group.rgthree_hasAnyActiveNode = newValue;
    this.toggled = newValue;
    this.group.graph?.setDirtyCanvas(true, false);
  }

  get toggled() {
    return this.value.toggled;
  }
  set toggled(value: boolean) {
    this.value.toggled = value;
  }

  toggle(value?: boolean) {
    value = value == null ? !this.toggled : value;
    if (value !== this.toggled) {
      this.value.toggled = value;
      this.doModeChange();
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    node: FastGroupsMuter,
    width: number,
    posY: number,
    height: number,
  ) {
    const widgetData = drawNodeWidget(ctx, {size: [width, height], pos: [15, posY]});

    const showNav = node.properties?.[PROPERTY_SHOW_NAV] !== false;

    // Render from right to left, since the text on left will take available space.
    // `currentX` markes the current x position moving backwards.
    let currentX = widgetData.width - widgetData.margin;

    // The nav arrow
    if (!widgetData.lowQuality && showNav) {
      currentX -= 7; // Arrow space margin
      const midY = widgetData.posY + widgetData.height * 0.5;
      ctx.fillStyle = ctx.strokeStyle = "#89A";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      const arrow = new Path2D(`M${currentX} ${midY} l -7 6 v -3 h -7 v -6 h 7 v -3 z`);
      ctx.fill(arrow);
      ctx.stroke(arrow);
      currentX -= 14;

      currentX -= 7;
      ctx.strokeStyle = widgetData.colorOutline;
      ctx.stroke(new Path2D(`M ${currentX} ${widgetData.posY} v ${widgetData.height}`));
    } else if (widgetData.lowQuality && showNav) {
      currentX -= 28;
    }

    // The toggle itself.
    currentX -= 7;
    ctx.fillStyle = this.toggled ? "#89A" : "#333";
    ctx.beginPath();
    const toggleRadius = height * 0.36;
    ctx.arc(currentX - toggleRadius, posY + height * 0.5, toggleRadius, 0, Math.PI * 2);
    ctx.fill();
    currentX -= toggleRadius * 2;

    if (!widgetData.lowQuality) {
      currentX -= 4;
      ctx.textAlign = "right";
      ctx.fillStyle = this.toggled ? widgetData.colorText : widgetData.colorTextSecondary;
      const label = this.label;
      const toggleLabelOn = this.options.on || "true";
      const toggleLabelOff = this.options.off || "false";
      ctx.fillText(this.toggled ? toggleLabelOn : toggleLabelOff, currentX, posY + height * 0.7);
      currentX -= Math.max(
        ctx.measureText(toggleLabelOn).width,
        ctx.measureText(toggleLabelOff).width,
      );

      currentX -= 7;
      ctx.textAlign = "left";
      let maxLabelWidth = widgetData.width - widgetData.margin - 10 - (widgetData.width - currentX);
      if (label != null) {
        ctx.fillText(
          fitString(ctx, label, maxLabelWidth),
          widgetData.margin + 10,
          posY + height * 0.7,
        );
      }
    }
  }

  override serializeValue(node: LGraphNode, index: number) {
    return this.value;
  }

  override mouse(event: CanvasMouseEvent, pos: Vector2, node: LGraphNode): boolean {
    if (event.type == "pointerdown") {
      if (node.properties?.[PROPERTY_SHOW_NAV] !== false && pos[0] >= node.size[0] - 15 - 28 - 1) {
        const canvas = app.canvas as TLGraphCanvas;
        const lowQuality = (canvas.ds?.scale || 1) <= 0.5;
        if (!lowQuality) {
          // Clicked on right half with nav arrow, go to the group, center on group and set
          // zoom to see it all.
          canvas.centerOnNode(this.group);
          const zoomCurrent = canvas.ds?.scale || 1;
          const zoomX = canvas.canvas.width / this.group._size[0] - 0.02;
          const zoomY = canvas.canvas.height / this.group._size[1] - 0.02;
          canvas.setZoom(Math.min(zoomCurrent, zoomX, zoomY), [
            canvas.canvas.width / 2,
            canvas.canvas.height / 2,
          ]);
          canvas.setDirty(true, true);
        }
      } else {
        this.beginPress(event);
      }
    }
    return true;
  }

  /**
   * A press on the row body is either a click (toggle on release) or a vertical drag (reorder).
   *
   * LiteGraph only reliably hands us the initial pointerdown, so we listen for the rest of the
   * gesture on the document ourselves.
   */
  private beginPress(downEvent: CanvasMouseEvent) {
    const canvas = app.canvas as TLGraphCanvas;
    const startY = downEvent.clientY;
    let dragging = false;

    const onMove = (e: PointerEvent) => {
      if (!dragging) {
        if (Math.abs(e.clientY - startY) < DRAG_THRESHOLD_PX) {
          return;
        }
        dragging = true;
        this.node.draggingRows = true;
        // Make sure the canvas doesn't also start dragging the whole node.
        (canvas as any).node_dragged = null;
      }
      const [, graphY] = canvas.convertEventToCanvasOffset(e);
      this.node.moveRowTo(this, graphY - this.node.pos[1]);
    };

    const finish = (commit: boolean) => {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onCancel, true);
      if (dragging) {
        this.node.commitManualOrder();
      } else if (commit) {
        this.toggle();
      }
      this.node.draggingRows = false;
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onCancel, true);
  }
}

app.registerExtension({
  name: "rgthree.FastGroupsMuter",
  registerCustomNodes() {
    FastGroupsMuter.setUp();
  },
  loadedGraphNode(node: LGraphNode) {
    if (node.type == FastGroupsMuter.title) {
      (node as FastGroupsMuter).tempSize = [...node.size] as Point;
    }
  },
});
