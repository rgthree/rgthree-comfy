import { LGraph, SerializedLGraphNode } from "typings/litegraph.js";
// @ts-ignore
import { app } from "../../scripts/app.js";
import { RgthreeBaseNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
import { FastGroupsMuter } from "./fast_groups_muter.js";
import {
  type LGraphNode,
  type LiteGraph as TLiteGraph,
  LGraphCanvas as TLGraphCanvas,
} from "typings/litegraph.js";
import { RgthreeToggleNavWidget } from "./utils_widgets.js";
import { filterByColor, filterByTitle, sortBy, type SortType } from "./utils_fast.js";

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphCanvas: typeof TLGraphCanvas;

const PROPERTY_SORT = "sort";
const PROPERTY_SORT_CUSTOM_ALPHA = "customSortAlphabet";
const PROPERTY_MATCH_COLORS = "matchColors";
const PROPERTY_MATCH_TITLE = "matchTitle";
const PROPERTY_RESTRICTION = "toggleRestriction";

/**
 * Fast Muter implementation that looks for nodes in the workflow and adds toggles to mute them.
 */
export class FastNodeMuter extends FastGroupsMuter {
  static override type = NodeTypesString.FAST_NODE_MUTER;
  static override title = NodeTypesString.FAST_NODE_MUTER;

  override readonly modeOn = LiteGraph.ALWAYS;
  override readonly modeOff = LiteGraph.NEVER;

  constructor(title = FastNodeMuter.title) {
    super(title);
  }

  static override setUp<T extends RgthreeBaseNode>(clazz: new (title?: string) => T) {
    LiteGraph.registerNodeType((clazz as any).type, clazz);
    (clazz as any).category = (clazz as any)._category;
  }

  override refreshWidgets() {
    const graph: LGraph = app.graph;
    let sort: SortType = this.properties?.[PROPERTY_SORT] || "position";
    const nodes: LGraphNode[] = [...(graph._nodes ?? [])].filter((n) => !n.isVirtualNode);
    // The service will return pre-sorted groups for alphanumeric and position. If this node has a
    // custom sort, then we need to sort it manually.
    const alphaSorted = sortBy(nodes, {
      customAlphabet: this.properties?.[PROPERTY_SORT_CUSTOM_ALPHA]?.replace(/\n/g, ""),
      sort,
    });

    // See if we're filtering by colors, and match against the built-in keywords and actuial hex
    // values.
    const colorFiltered = filterByColor(alphaSorted, {
      matchColors: this.properties?.[PROPERTY_MATCH_COLORS],
      nodeColorOption: "color",
    });

    const titleFiltered = filterByTitle(colorFiltered, {
      matchTitle: this.properties?.[PROPERTY_MATCH_TITLE]?.trim(),
    });

    // Go over the nodes
    let index = 0;
    for (const node of titleFiltered) {
      this.widgets = this.widgets || [];
      const nodeTitle = nodeWithIndex(nodes, node);
      const widgetName = `Enable ${nodeTitle}`;
      let widget = this.getOrCreateWidget(node, widgetName);
      if (widget.name != widgetName) {
        widget.name = widgetName;
        this.setDirtyCanvas(true, false);
      }
      const nodeActive = node.mode === LiteGraph.ALWAYS;
      if (widget.value != nodeActive) {
        widget.value = nodeActive;
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

  private getOrCreateWidget(node: LGraphNode, widgetName: string): RgthreeToggleNavWidget {
    const existingWidget = this.widgets.find((w) => w.name === widgetName);
    if (existingWidget && existingWidget instanceof RgthreeToggleNavWidget) {
      return existingWidget;
    }
    // When we add a widget, litegraph is going to mess up the size, so we
    // store it so we can retrieve it in computeSize. Hacky..
    this.tempSize = [...this.size];
    const widget = this.addCustomWidget(
      new RgthreeToggleNavWidget(
        node,
        () => this.showNav,
        (force?: boolean, skipOtherNodeCheck?: boolean) => {
          const hasAnyActiveNodes = node.mode === LiteGraph.ALWAYS;
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
          node.mode = (newValue ? this.modeOn : this.modeOff) as 1 | 2 | 3 | 4;
          widget!.value = newValue;
          app.graph.setDirtyCanvas(true, false);
        },
      ),
    );

    this.setSize(this.computeSize());
    return widget;
  }
}

app.registerExtension({
  name: "rgthree.FastNodeMuter",
  registerCustomNodes() {
    FastNodeMuter.setUp(FastNodeMuter);
  },
  loadedGraphNode(node: LGraphNode) {
    if (node.type == FastNodeMuter.title) {
      (node as FastNodeMuter).tempSize = [...node.size];
    }
  },
});

function nodeWithIndex(nodes: LGraphNode[], node: LGraphNode): string {
  const { title } = node;
  const sameNameNodes = nodes.filter((n) => n.title === title);
  if (sameNameNodes.length === 1) {
    return title;
  }
  return `${title} ${sameNameNodes.indexOf(node) + 1}/${sameNameNodes.length}`;
}
