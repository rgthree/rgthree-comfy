// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
import { RgthreeBaseNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
import {
  type LGraphNode,
  type LGraph as TLGraph,
  type LiteGraph as TLiteGraph,
  LGraphCanvas as TLGraphCanvas,
  Vector2,
  SerializedLGraphNode,
  IWidget,
  ContextMenuItem,
} from "./typings/litegraph.js";
import { addHelpMenuItem } from "./utils.js";

declare const LGraphCanvas: typeof TLGraphCanvas;
declare const LiteGraph: typeof TLiteGraph;

const PROPERTY_SORT = "sort";
const PROPERTY_MATCH_COLORS = "matchColors";
const PROPERTY_MATCH_TITLE = "matchTitle";
const PROPERTY_SHOW_NAV = "showNav";

/**
 * Fast Muter implementation that looks for groups in the workflow and adds toggles to mute them.
 */
export class FastGroupsMuter extends RgthreeBaseNode {
  static override type = NodeTypesString.FAST_GROUPS_MUTER;
  static override title = NodeTypesString.FAST_GROUPS_MUTER;

  static override exposedActions = ["Mute all", "Enable all"];

  readonly modeOn: number = LiteGraph.ALWAYS;
  readonly modeOff: number = LiteGraph.NEVER;

  private debouncerTempWidth: number = 0;
  private refreshWidgetsTimeout: number | null = null;
  tempSize: Vector2 | null = null;

  // We don't need to serizalize since we'll just be checking group data on startup anyway
  override serialize_widgets = false;

  protected helpActions = 'must and unmute';

  static "@sort" = {
    type: "combo",
    values: ["position", "alphanumeric"],
  };
  static "@matchColors" = { type: "string" };
  static "@matchTitle" = { type: "string" };
  static "@showNav" = { type: "boolean" };

  constructor(title = FastGroupsMuter.title) {
    super(title);
    this.properties[PROPERTY_SORT] = "position";
    this.properties[PROPERTY_MATCH_COLORS] = "";
    this.properties[PROPERTY_MATCH_TITLE] = "";
    this.properties[PROPERTY_SHOW_NAV] = true;
    this.addOutput("OPT_CONNECTION", "*");
  }

  override onNodeCreated(): void {
    if (!this.configuring) {
      this.refreshWidgets();
    } else {
      setTimeout(() => {
        this.refreshWidgets();
      }, 600);
    }
  }

  refreshWidgets() {
    const graph = app.graph as TLGraph;
    const sort = this.properties?.[PROPERTY_SORT] || "position";
    const groups = [...graph._groups].sort((a, b) => {
      if (sort === "alphanumeric") {
        return a.title.localeCompare(b.title);
      }
      // Sort by y, then x, clamped to 30.
      const aY = Math.floor(a._pos[1] / 30);
      const bY = Math.floor(b._pos[1] / 30);
      if (aY == bY) {
        const aX = Math.floor(a._pos[0] / 30);
        const bX = Math.floor(b._pos[0] / 30);
        return aX - bX;
      }
      return aY - bY;
    });
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
        // TODO: match name, color, etc.
        let groupColor = group.color.replace("#", "").trim().toLocaleLowerCase();
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
      this.widgets = this.widgets || [];
      const widgetName = `Enable ${group.title}`;
      let widget = this.widgets.find((w) => w.name === widgetName);
      if (!widget) {
        // When we add a widget, litegraph is going to mess up the size, so we
        // store it so we can retrieve it in computeSize. Hacky..
        this.tempSize = [...this.size];
        widget = this.addCustomWidget<IWidget<boolean>>({
          name: "RGTHREE_TOGGLE_AND_NAV",
          label: "",
          value: false,
          disabled: false,
          options: { on: "yes", off: "no" },
          draw: function (
            ctx: CanvasRenderingContext2D,
            node: LGraphNode,
            width: number,
            posY: number,
            height: number,
          ) {
            let margin = 15;
            let outline_color = LiteGraph.WIDGET_OUTLINE_COLOR;
            let background_color = LiteGraph.WIDGET_BGCOLOR;
            let text_color = LiteGraph.WIDGET_TEXT_COLOR;
            let secondary_text_color = LiteGraph.WIDGET_SECONDARY_TEXT_COLOR;
            const showNav = node.properties?.[PROPERTY_SHOW_NAV] !== false;
            const spaceForNav = showNav ? 28 : 0;

            ctx.textAlign = "left";
            ctx.strokeStyle = outline_color;
            ctx.fillStyle = background_color;
            ctx.beginPath();
            ctx.roundRect(margin, posY, width - margin * 2, height, [height * 0.5]);
            ctx.fill();
            ctx.stroke();

            // The toggle itself.
            ctx.fillStyle = this.value ? "#89A" : "#333";
            ctx.beginPath();
            ctx.arc(
              width - margin * 2 - spaceForNav,
              posY + height * 0.5,
              height * 0.36,
              0,
              Math.PI * 2,
            );
            ctx.fill();

            if (showNav) {
              // The nav button
              const midY = posY + height * 0.5;
              const rightX = width - margin;
              ctx.strokeStyle = outline_color;
              ctx.beginPath();
              ctx.moveTo(rightX - spaceForNav, posY);
              ctx.lineTo(rightX - spaceForNav, posY + height);
              ctx.stroke();
              ctx.fillStyle = "#89A";
              ctx.strokeStyle = ctx.fillStyle;
              ctx.lineJoin = "round";
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(rightX - 21, midY - height * 0.12);
              ctx.lineTo(rightX - 14, midY - height * 0.12);
              ctx.lineTo(rightX - 14, midY - height * 0.31);
              ctx.lineTo(rightX - 7, midY);
              ctx.lineTo(rightX - 14, midY + height * 0.31);
              ctx.lineTo(rightX - 14, midY + height * 0.12);
              ctx.lineTo(rightX - 21, midY + height * 0.12);
              ctx.lineTo(rightX - 21, midY - height * 0.12);
              ctx.fill();
              ctx.stroke();
            }

            ctx.textAlign = "left";
            ctx.fillStyle = this.value ? text_color : secondary_text_color;
            const label = this.label || this.name;
            if (label != null) {
              ctx.fillText(label, margin * 2, posY + height * 0.7);
            }
            ctx.textAlign = "right";
            ctx.fillText(
              this.value ? this.options.on || "true" : this.options.off || "false",
              width - margin * 2 - 10 - spaceForNav,
              posY + height * 0.7,
            );
          },
          serializeValue(serializedNode: SerializedLGraphNode, widgetIndex: number) {
            return this.value;
          },
          mouse(event: PointerEvent, pos: Vector2, node: LGraphNode) {
            if (event.type == "pointerdown") {
              if (
                node.properties?.[PROPERTY_SHOW_NAV] !== false &&
                pos[0] >= node.size[0] - 15 - 28 - 1
              ) {
                // Clicked on right half with nav arrow, go to the group.
                app.canvas.centerOnNode(group);
              } else {
                this.value = !this.value;
                setTimeout(() => {
                  this.callback?.(this.value, app.canvas, node, pos, event);
                }, 20);
              }
            }
            return true;
          },
        });
        (widget as any).doModeChange = (force?: boolean) => {
          group.recomputeInsideNodes();
          let off = force == null ? group._nodes.every((n) => n.mode === this.modeOff) : force;
          for (const node of group._nodes) {
            node.mode = (off ? this.modeOn : this.modeOff) as 1 | 2 | 3 | 4;
          }
          widget!.value = off;
        };
        widget.callback = () => {
          (widget as any).doModeChange();
        };

        this.setSize(this.computeSize());
      }
      if (!group._nodes?.length) {
        group.recomputeInsideNodes();
      }
      widget.name = widgetName;
      widget.value = !group._nodes.every((n) => n.mode === this.modeOff);
      if (this.widgets[index] !== widget) {
        const oldIndex = this.widgets.findIndex((w) => w === widget);
        this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]!);
      }
      index++;
    }

    // Everything should now be in order, so let's remove all remaining widgets.
    while ((this.widgets || [])[index]) {
      this.removeWidget(index++);
    }

    this.refreshWidgetsTimeout && clearTimeout(this.refreshWidgetsTimeout);
    this.refreshWidgetsTimeout = setTimeout(() => {
      if (!this.removed) {
        this.refreshWidgets();
      }
    }, 500);
  }

  override computeSize(out?: Vector2) {
    let size = super.computeSize(out);
    console.log("computesize", size);
    if (this.tempSize) {
      size[0] = Math.max(this.tempSize[0], size[0]);
      size[1] = Math.max(this.tempSize[1], size[1]);
      // We sometimes get repeated calls to compute size, so debounce before clearing.
      this.debouncerTempWidth && clearTimeout(this.debouncerTempWidth);
      this.debouncerTempWidth = setTimeout(() => {
        this.tempSize = null;
      }, 32);
    }
    console.log("computesize2", size);
    setTimeout(() => {
      app.graph.setDirtyCanvas(true, true);
    }, 16);
    return size;
  }

  override async handleAction(action: string) {
    if (action === "Mute all") {
      for (const widget of this.widgets) {
        (widget as any)?.doModeChange(false);
      }
    } else if (action === "Enable all") {
      for (const widget of this.widgets) {
        (widget as any)?.doModeChange(true);
      }
    }
  }

  override getExtraMenuOptions(canvas: TLGraphCanvas, menuOptions: ContextMenuItem[]): void {
    addHelpMenuItem(this, `
        <p>The ${this.type!.replace("(rgthree)", "")} is an input-less node that automatically collects all groups in your current
        workflow and allows you to quickly ${(this as FastGroupsMuter).helpActions} all nodes within the group.</p>
        <ul>
          <li>
            <p><strong>Properties.</strong> You can change the following properties (by right-clicking on the node, and select "Properties" or "Properties Panel" from the menu):</p>
            <ul>
              <li><p><code>${PROPERTY_SORT}</code> - Sort the toggles' order by alphanumeric or graph position.</p></li>
              <li><p><code>${PROPERTY_MATCH_COLORS}</code> - Only add groups that match the provided colors. Can be ComfyUI colors (red, pale_blue) or hex codes (#a4d399). Multiple can be added, comma delimited.</p></li>
              <li><p><code>${PROPERTY_MATCH_TITLE}</code> - Filter the list of toggles by title match (string match, or regular expression).</p></li>
              <li><p><code>${PROPERTY_SHOW_NAV}</code> - Add / remove a quick navigation arrow to take you to the group.</p></li>
            </ul>
          </li>
        </ul>
      `, menuOptions);
  }

  static override setUp<T extends RgthreeBaseNode>(clazz: new (title?: string) => T) {
    LiteGraph.registerNodeType((clazz as any).type, clazz);
    (clazz as any).category = (clazz as any)._category;
  }
}

app.registerExtension({
  name: "rgthree.FastGroupsMuter",
  registerCustomNodes() {
    FastGroupsMuter.setUp(FastGroupsMuter);
  },
  loadedGraphNode(node: LGraphNode) {
    if (node.type == FastGroupsMuter.title) {
      (node as FastGroupsMuter).tempSize = [...node.size];
    }
  },
});
