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

// Sentinel sort value engaged automatically the first time a user drags a row.
const SORT_MANUAL = "manual";

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
  static "@manualOrder" = {type: "array"};

  override properties!: RgthreeBaseVirtualNode["properties"] & {
    [PROPERTY_MATCH_COLORS]: string;
    [PROPERTY_MATCH_TITLE]: string;
    [PROPERTY_SHOW_NAV]: boolean;
    [PROPERTY_SHOW_ALL_GRAPHS]: boolean;
    [PROPERTY_SORT]: string;
    [PROPERTY_SORT_CUSTOM_ALPHA]: string;
    [PROPERTY_RESTRICTION]: string;
    [PROPERTY_MANUAL_ORDER]: string[];
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
    this.properties[PROPERTY_RESTRICTION] = "default";
    this.properties[PROPERTY_MANUAL_ORDER] = [];
  }

  // Transient drag state, written by the dragging row widget's hit-area handlers and read by
  // draw() to render the moving row + drop indicator. Not serialized.
  dragWidget: FastGroupsToggleRowWidget | null = null;
  dragDropIndex: number = -1;

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

  refreshWidgets() {
    const canvas = app.canvas as TLGraphCanvas;
    let sort = this.properties?.[PROPERTY_SORT] || "position";
    let customAlphabet: string[] | null = null;
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

    // Manual drag order. Reapplied on every refresh cycle so the service's polling
    // doesn't revert a user's drag. Groups absent from the saved order (e.g. newly
    // created) keep their incoming order and fall to the end.
    if (sort === SORT_MANUAL) {
      const order: string[] = this.properties?.[PROPERTY_MANUAL_ORDER] || [];
      const rank = new Map<string, number>();
      order.forEach((title, i) => rank.set(title, i));
      groups.sort((a, b) => {
        const ai = rank.has(a.title) ? rank.get(a.title)! : Number.MAX_SAFE_INTEGER;
        const bi = rank.has(b.title) ? rank.get(b.title)! : Number.MAX_SAFE_INTEGER;
        if (ai === bi) {
          return 0; // preserve incoming order for unranked / equal
        }
        return ai - bi;
      });
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

  /**
   * Returns the row widgets in display order. Non-row widgets (none expected) are ignored so
   * drag math stays correct.
   */
  getRowWidgets(): FastGroupsToggleRowWidget[] {
    return (this.widgets || []).filter(
      (w): w is FastGroupsToggleRowWidget => w instanceof FastGroupsToggleRowWidget,
    );
  }

  /**
   * Moves the row widget at `from` to index `to`, persists the resulting order, and engages the
   * "manual" sort mode. Called by a row widget when the user finishes a drag-to-reorder.
   */
  commitManualOrder(from: number, to: number) {
    const rows = this.getRowWidgets();
    to = Math.max(0, Math.min(rows.length - 1, to));
    if (from < 0 || from >= rows.length || from === to) {
      this.setDirtyCanvas(true, false);
      return;
    }

    // Reorder a copy of the row widgets, then write the new sequence back into this.widgets,
    // preserving the slots of any non-row widgets (none expected, but safe).
    rows.splice(to, 0, rows.splice(from, 1)[0]!);
    let r = 0;
    for (let i = 0; i < this.widgets.length; i++) {
      if (this.widgets[i] instanceof FastGroupsToggleRowWidget) {
        this.widgets[i] = rows[r++]!;
      }
    }

    // Engage manual sort and persist the order (group titles) with the workflow.
    this.properties[PROPERTY_SORT] = SORT_MANUAL;
    this.properties[PROPERTY_MANUAL_ORDER] = rows.map((w) => w.group.title);
    this.setDirtyCanvas(true, true);
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
            </p>
            <p>
              <strong>Manual drag ordering:</strong> drag any row by its label (the left part of
              the row, away from the toggle and nav arrow) and drop it in a new position. The first
              drag automatically switches <code>${PROPERTY_SORT}</code> to "manual", and the order
              is saved with your workflow. Newly-added groups appear at the end until you place
              them.
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

  // Drag-to-reorder state, local to this widget while it is the one being dragged.
  private dragging = false;
  private dragStartY = 0;
  private dragStartIndex = -1;

  constructor(group: LGraphGroup, node: BaseFastGroupsModeChanger) {
    super("RGTHREE_TOGGLE_AND_NAV");
    this.group = group;
    this.node = node;
    // Hit areas dispatched by RgthreeBaseWidget.mouse(). Bounds are recomputed in draw() so
    // they track the node's current width. Each is [xStart, width] (full row height).
    this.hitAreas = {
      // The label/grip region on the left: start a drag-to-reorder here.
      drag: {bounds: [0, 0], onDown: this.onDragDown, onMove: this.onDragMove, onUp: this.onDragUp},
      // The toggle in the middle-right: flip this group on click.
      toggle: {bounds: [0, 0], onClick: this.onToggleClick},
      // The nav arrow on the far right: jump to the group.
      nav: {bounds: [0, 0], onClick: this.onNavClick},
    };
  }

  doModeChange(force?: boolean, skipOtherNodeCheck?: boolean) {
    this.group.recomputeInsideNodes();
    const hasAnyActiveNodes = getGroupNodes(this.group).some((n) => n.mode === LiteGraph.ALWAYS);
    let newValue = force != null ? force : !hasAnyActiveNodes;
    if (skipOtherNodeCheck !== true) {
      // TODO: This work should probably live in BaseFastGroupsModeChanger instead of the widgets.
      if (newValue && this.node.properties?.[PROPERTY_RESTRICTION]?.includes(" one")) {
        for (const widget of this.node.widgets) {
          if (widget instanceof FastGroupsToggleRowWidget) {
            widget.doModeChange(false, true);
          }
        }
      } else if (!newValue && this.node.properties?.[PROPERTY_RESTRICTION] === "always one") {
        newValue = this.node.widgets.every((w) => !w.value || w === this);
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
    const fastNode = node as unknown as BaseFastGroupsModeChanger;
    const isDragging = fastNode.dragWidget === this;

    // While dragging this row, dim it slightly to signal it's being moved.
    if (isDragging) {
      ctx.save();
      ctx.globalAlpha = 0.4;
    }

    const widgetData = drawNodeWidget(ctx, {size: [width, height], pos: [15, posY]});

    const showNav = node.properties?.[PROPERTY_SHOW_NAV] !== false;

    // Recompute hit-area X bounds for the current width. Bounds are [xStart, width].
    // Layout (right to left): nav arrow (~28px) | toggle + on/off label (~90px) | label/drag.
    const navWidth = 28 + 1;
    const navStart = width - 15 - navWidth;
    const toggleWidth = 90;
    const toggleStart = navStart - toggleWidth;
    this.hitAreas.nav!.bounds = showNav ? [navStart, navWidth] : [width, 0];
    this.hitAreas.toggle!.bounds = [toggleStart, showNav ? toggleWidth : toggleWidth + navWidth];
    this.hitAreas.drag!.bounds = [15, Math.max(0, toggleStart - 15)];

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
      const labelX = widgetData.margin + 10 + 10; // +10 to clear the grip handle
      if (label != null) {
        ctx.fillText(
          fitString(ctx, label, maxLabelWidth - 10),
          labelX,
          posY + height * 0.7,
        );
      }

      // Drag grip: three small dots at the far left, hinting the row is draggable.
      const gripX = widgetData.margin + 6;
      const gripMidY = posY + height * 0.5;
      ctx.fillStyle = widgetData.colorTextSecondary;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(gripX, gripMidY + i * 4, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (isDragging) {
      ctx.restore();
    }

    // Drop indicator: when this row is the current drop target during a drag, draw a line
    // at its top edge so the user sees where the dragged row will land.
    const fastNode2 = node as unknown as BaseFastGroupsModeChanger;
    if (
      fastNode2.dragWidget &&
      fastNode2.dragWidget !== this &&
      fastNode2.dragDropIndex > -1
    ) {
      const rows = (node.widgets || []).filter(
        (w) => w instanceof FastGroupsToggleRowWidget,
      );
      if (rows[fastNode2.dragDropIndex] === this) {
        ctx.save();
        ctx.strokeStyle = "#89A";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(widgetData.margin, posY - 1);
        ctx.lineTo(widgetData.width - widgetData.margin, posY - 1);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  override serializeValue(node: LGraphNode, index: number) {
    return this.value;
  }

  /** Start a drag-to-reorder. Returning true claims the pointer so move/up are delivered. */
  private onDragDown = (event: CanvasMouseEvent, pos: Vector2, node: LGraphNode): boolean => {
    const rows = this.node.getRowWidgets();
    this.dragStartIndex = rows.indexOf(this);
    if (this.dragStartIndex < 0) {
      return false;
    }
    this.dragging = true;
    this.dragStartY = pos[1];
    this.node.dragWidget = this;
    this.node.dragDropIndex = this.dragStartIndex;
    this.node.setDirtyCanvas(true, false);
    return true;
  };

  /** While dragging, translate vertical movement into a target drop index. */
  private onDragMove = (event: CanvasMouseEvent, pos: Vector2, node: LGraphNode): void => {
    if (!this.dragging) {
      return;
    }
    const rows = this.node.getRowWidgets();
    const slot = LiteGraph.NODE_WIDGET_HEIGHT + 4;
    // pos[1] is node-local Y (relative to this widget's top), so the delta from where the drag
    // began, divided by the per-row height, is how many slots we've moved.
    const movedSlots = Math.round((pos[1] - this.dragStartY) / slot);
    let idx = this.dragStartIndex + movedSlots;
    idx = Math.max(0, Math.min(rows.length - 1, idx));
    if (idx !== this.node.dragDropIndex) {
      this.node.dragDropIndex = idx;
      this.node.setDirtyCanvas(true, false);
    }
  };

  /** Finish the drag: commit the new order (which engages "manual" sort and persists it). */
  private onDragUp = (event: CanvasMouseEvent, pos: Vector2, node: LGraphNode): boolean => {
    if (!this.dragging) {
      return false;
    }
    const target = this.node.dragDropIndex;
    const from = this.dragStartIndex;
    this.dragging = false;
    this.dragStartIndex = -1;
    this.node.dragWidget = null;
    this.node.dragDropIndex = -1;
    this.node.commitManualOrder(from, target);
    return true;
  };

  private onToggleClick = (event: CanvasMouseEvent, pos: Vector2, node: LGraphNode): boolean => {
    this.toggle();
    return true;
  };

  private onNavClick = (event: CanvasMouseEvent, pos: Vector2, node: LGraphNode): boolean => {
    if (node.properties?.[PROPERTY_SHOW_NAV] === false) {
      return false;
    }
    const canvas = app.canvas as TLGraphCanvas;
    const lowQuality = (canvas.ds?.scale || 1) <= 0.5;
    if (lowQuality) {
      return false;
    }
    // Center on the group and zoom to fit it.
    canvas.centerOnNode(this.group);
    const zoomCurrent = canvas.ds?.scale || 1;
    const zoomX = canvas.canvas.width / this.group._size[0] - 0.02;
    const zoomY = canvas.canvas.height / this.group._size[1] - 0.02;
    canvas.setZoom(Math.min(zoomCurrent, zoomX, zoomY), [
      canvas.canvas.width / 2,
      canvas.canvas.height / 2,
    ]);
    canvas.setDirty(true, true);
    return true;
  };
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
