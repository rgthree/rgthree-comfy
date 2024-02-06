// @ts-ignore
import { app } from "../../scripts/app.js";
import type {
  LGraphCanvas as TLGraphCanvas,
  ContextMenuItem,
  LGraphNode,
  LiteGraph as TLiteGraph,
} from "typings/litegraph.js";
import type { ComfyNodeConstructor, ComfyObjectInfo } from "typings/comfy.js";
import { rgthree } from "./rgthree.js";
import { SERVICE as CONFIG_SERVICE } from "./config_service.js";

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphCanvas: typeof TLGraphCanvas;

function getOutputNodesFromSelected(canvas: TLGraphCanvas) {
  return (
    (canvas.selected_nodes &&
      Object.values(canvas.selected_nodes).filter((n) => {
        return (
          n.mode != LiteGraph.NEVER &&
          ((n.constructor as any).nodeData as ComfyObjectInfo)?.output_node
        );
      })) ||
    []
  );
}

function showQueueNodesMenuIfOutputNodesAreSelected(
  existingOptions: ContextMenuItem[],
  node?: LGraphNode,
) {
  if (CONFIG_SERVICE.getConfigValue("features.menu_queue_selected_nodes") != false) {
    const canvas = app.canvas as TLGraphCanvas;
    const outputNodes = getOutputNodesFromSelected(canvas);
    const menuItem = {
      content: `Queue Selected Output Nodes (rgthree) &nbsp;`,
      className: "rgthree-contextmenu-item",
      callback: () => {
        rgthree.queueOutputNodes(outputNodes.map((n) => n.id));
      },
      disabled: !outputNodes.length,
    };

    let idx = existingOptions.findIndex((o) => o?.content === "Outputs") + 1;
    idx = idx || existingOptions.findIndex((o) => o?.content === "Align") + 1;
    idx = idx || 3;
    existingOptions.splice(idx, 0, menuItem);
  }
  return existingOptions;
}

/**
 * Adds a "Queue Node" menu item to all output nodes, working with `rgthree.queueOutputNode` to
 * execute only a single node's path.
 */
app.registerExtension({
  name: "rgthree.QueueNode",
  async beforeRegisterNodeDef(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
    nodeType.prototype.getExtraMenuOptions = function (
      canvas: TLGraphCanvas,
      options: ContextMenuItem[],
    ) {
      getExtraMenuOptions ? getExtraMenuOptions.apply(this, arguments) : undefined;
      showQueueNodesMenuIfOutputNodesAreSelected(options, this);
    };
  },

  async setup() {
    console.log("rgthree-menu-setup");

    const getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
    LGraphCanvas.prototype.getCanvasMenuOptions = function (...args: any[]) {
      const options = getCanvasMenuOptions.apply(this, [...args] as any);
      showQueueNodesMenuIfOutputNodesAreSelected(options);
      return options;
    };
  },
});
