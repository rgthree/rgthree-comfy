// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
import { RgthreeBaseVirtualNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
import {
  type LGraphNode,
  type LGraph as TLGraph,
  type LiteGraph as TLiteGraph,
  LGraphCanvas as TLGraphCanvas,
  Vector2,
  type LGraphGroup,
} from "typings/litegraph.js";
import { SERVICE as FAST_GROUPS_SERVICE } from "./fast_groups_service.js";
import { RgthreeToggleNavWidget } from "./utils_widgets.js";
import {
  filterByColor,
  filterByTitle,
  groupHasActiveNode,
  sortBy,
  type SortType,
} from "./utils_fast.js";
import { RgthreeBaseVirtualNodeConstructor } from "typings/rgthree.js";

declare const LiteGraph: typeof TLiteGraph;

const PROPERTY_SORT = "sort";
const PROPERTY_SORT_CUSTOM_ALPHA = "customSortAlphabet";
const PROPERTY_MATCH_COLORS = "matchColors";
const PROPERTY_MATCH_TITLE = "matchTitle";
const PROPERTY_SHOW_NAV = "showNav";
const PROPERTY_RESTRICTION = "toggleRestriction";

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

  static "@matchColors" = { type: "string" };
  static "@matchTitle" = { type: "string" };
  static "@showNav" = { type: "boolean" };
  static "@sort" = {
    type: "combo",
    values: ["position", "alphanumeric", "custom alphabet"],
  };
  static "@customSortAlphabet" = { type: "string" };

  static "@toggleRestriction" = {
    type: "combo",
    values: ["default", "max one", "always one"],
  };

  constructor(title = FastGroupsMuter.title) {
    super(title);
    this.properties[PROPERTY_MATCH_COLORS] = "";
    this.properties[PROPERTY_MATCH_TITLE] = "";
    this.properties[PROPERTY_SHOW_NAV] = true;
    this.properties[PROPERTY_SORT] = "position";
    this.properties[PROPERTY_SORT_CUSTOM_ALPHA] = "";
    this.properties[PROPERTY_RESTRICTION] = "default";
  }

  override onConstructed(): boolean {
    this.addOutput("OPT_CONNECTION", "*");
    return super.onConstructed();
  }

  override configure(info: SerializedLGraphNode<LGraphNode>): void {
    // Patch a small issue (~14h) where multiple OPT_CONNECTIONS may have been created.
    // https://github.com/rgthree/rgthree-comfy/issues/206
    // TODO: This can probably be removed within a few weeks.
    if (info.outputs?.length) {
      info.outputs.length = 1;
    }
    super.configure(info);
  }

  override onAdded(graph: TLGraph): void {
    FAST_GROUPS_SERVICE.addFastGroupNode(this);
  }

  override onRemoved(): void {
    FAST_GROUPS_SERVICE.removeFastGroupNode(this);
  }

  get showNav() {
    return this.properties?.[PROPERTY_SHOW_NAV] !== false;
  }

  refreshWidgets() {
    let sort: SortType = this.properties?.[PROPERTY_SORT] || "position";
    const groups = [...FAST_GROUPS_SERVICE.getGroups(sort)];
    // The service will return pre-sorted groups for alphanumeric and position. If this node has a
    // custom sort, then we need to sort it manually.
    const alphaSorted = sortBy(groups, {
      customAlphabet: this.properties?.[PROPERTY_SORT_CUSTOM_ALPHA]?.replace(/\n/g, ""),
      sort,
    });

    // See if we're filtering by colors, and match against the built-in keywords and actuial hex
    // values.
    const colorFiltered = filterByColor(alphaSorted, {
      matchColors: this.properties?.[PROPERTY_MATCH_COLORS],
      nodeColorOption: "groupcolor",
    });

    const titleFiltered = filterByTitle(colorFiltered, {
      matchTitle: this.properties?.[PROPERTY_MATCH_TITLE]?.trim(),
    });

    // Go over the groups
    let index = 0;
    for (const group of titleFiltered) {
      this.widgets = this.widgets || [];
      const widgetName = `Enable ${group.title}`;
      const widget = this.getOrCreateToggleWidget(group, widgetName);
      if (widget.name != widgetName) {
        widget.name = widgetName;
        this.setDirtyCanvas(true, false);
      }
      if (widget.value != group._rgthreeHasAnyActiveNode) {
        widget.value = group._rgthreeHasAnyActiveNode ?? false;
        this.setDirtyCanvas(true, false);
      }
      if (this.widgets[index] !== widget) {
        const oldIndex = this.widgets.findIndex((w) => w === widget);
        this.widgets.splice(index, 0, this.widgets.splice(oldIndex, 1)[0]!);
        this.setDirtyCanvas(true, false);
      }
      index++;
    }

    // Everything should now be in order, so let's remove all remaining widgets.
    while ((this.widgets || [])[index]) {
      this.removeWidget(index++);
    }
  }

  private getOrCreateToggleWidget(group: LGraphGroup, widgetName: string): RgthreeToggleNavWidget {
    const existingWidget = this.widgets.find((w) => w.name === widgetName);
    if (existingWidget && existingWidget instanceof RgthreeToggleNavWidget) {
      return existingWidget;
    }
    // When we add a widget, litegraph is going to mess up the size, so we
    // store it so we can retrieve it in computeSize. Hacky..
    this.tempSize = [...this.size];
    const widget = this.addCustomWidget(
      new RgthreeToggleNavWidget(
        group,
        () => this.showNav,
        (force?: boolean, skipOtherNodeCheck?: boolean) => {
          group.recomputeInsideNodes();
          const hasAnyActiveNodes = groupHasActiveNode(group);
          let newValue = force != null ? force : !hasAnyActiveNodes;
          if (skipOtherNodeCheck !== true) {
            if (newValue && this.properties?.[PROPERTY_RESTRICTION]?.includes(" one")) {
              for (const widget of this.widgets) {
                widget.doModeChange?.(false, true);
              }
            } else if (!newValue && this.properties?.[PROPERTY_RESTRICTION] === "always one") {
              newValue = this.widgets.every((w) => !w.value || w === widget);
            }
          }
          for (const node of group._nodes) {
            node.mode = (newValue ? this.modeOn : this.modeOff) as 1 | 2 | 3 | 4;
          }
          widget!.value = newValue;
          app.graph.setDirtyCanvas(true, false);
        },
      ),
    );

    this.setSize(this.computeSize());
    return widget;
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
      app.graph.setDirtyCanvas(true, true);
    }, 16);
    return size;
  }

  override async handleAction(action: string) {
    if (action === "Mute all" || action === "Bypass all") {
      const alwaysOne = this.properties?.[PROPERTY_RESTRICTION] === "always one";
      for (const [index, widget] of this.widgets.entries()) {
        widget.doModeChange?.(alwaysOne && !index ? true : false, true);
      }
    } else if (action === "Enable all") {
      const onlyOne = this.properties?.[PROPERTY_RESTRICTION].includes(" one");
      for (const [index, widget] of this.widgets.entries()) {
        widget.doModeChange?.(onlyOne && index > 0 ? false : true, true);
      }
    } else if (action === "Toggle all") {
      const onlyOne = this.properties?.[PROPERTY_RESTRICTION].includes(" one");
      let foundOne = false;
      for (const [index, widget] of this.widgets.entries()) {
        // If you have only one, then we'll stop at the first.
        let newValue: boolean = onlyOne && foundOne ? false : !widget.value;
        foundOne = foundOne || newValue;
        widget.doModeChange?.(newValue, true);
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
              <code>${PROPERTY_SORT}</code> - Sort the toggles' order by "alphanumeric", graph
              "position", or "custom alphabet". <i>(default: "position")</i>
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

  static override setUp(clazz: RgthreeBaseVirtualNodeConstructor) {
    LiteGraph.registerNodeType(clazz.type, clazz);
    clazz.category = clazz._category;
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

  static override setUp(clazz: RgthreeBaseVirtualNodeConstructor) {
    LiteGraph.registerNodeType(clazz.type, clazz);
    clazz.category = clazz._category;
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
