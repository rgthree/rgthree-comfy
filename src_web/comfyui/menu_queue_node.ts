// @ts-ignore
import { app } from "../../scripts/app.js";
import type { LGraphCanvas, ContextMenuItem } from "typings/litegraph.js";
import type { ComfyNodeConstructor, ComfyObjectInfo } from "typings/comfy.js";
import { rgthree } from "./rgthree.js";

/**
 * Adds a "Queue Node" menu item to all output nodes, working with `rgthree.queueOutputNode` to
 * execute only a single node's path.
 */
app.registerExtension({
  name: "rgthree.QueueNode",
  async beforeRegisterNodeDef(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    if (nodeData.output_node == true) {
      const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
      nodeType.prototype.getExtraMenuOptions = function (
        canvas: LGraphCanvas,
        options: ContextMenuItem[],
      ) {
        getExtraMenuOptions ? getExtraMenuOptions.apply(this, arguments) : undefined;

        const menuItem: ContextMenuItem = {
          content: `Queue Node (rgthree)`,
          className: "rgthree-contextmenu-item",
          callback: () => {
            rgthree.queueOutputNode(this.id);
          },
        };
        const idx = options.findIndex(o => o?.content === "Outputs") + 1 || options.length - 1;
        options.splice(idx, 0, menuItem);
      };
    }
  },
});
