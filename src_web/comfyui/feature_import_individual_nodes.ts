import { tryToGetWorkflowDataFromEvent } from "rgthree/common/utils_workflow.js";
import { app } from "scripts/app.js";
import type { ComfyNode, ComfyNodeConstructor, ComfyObjectInfo } from "typings/comfy.js";
import { SERVICE as CONFIG_SERVICE } from "./services/config_service.js";

/**
 * Registers the GroupHeaderToggles which places a mute and/or bypass icons in groups headers for
 * quick, single-click ability to mute/bypass.
 */
app.registerExtension({
  name: "rgthree.ImportIndividualNodes",
  async beforeRegisterNodeDef(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    const onDragOver = nodeType.prototype.onDragOver;
    nodeType.prototype.onDragOver = function (e: DragEvent) {
      let handled = onDragOver?.apply?.(this, [...arguments] as any);
      if (handled != null) {
        return handled;
      }
      return importIndividualNodesInnerOnDragOver(this, e);
    };

    const onDragDrop = nodeType.prototype.onDragDrop;
    nodeType.prototype.onDragDrop = async function (e: DragEvent) {
      const alreadyHandled = await onDragDrop?.apply?.(this, [...arguments] as any);
      if (alreadyHandled) {
        return alreadyHandled;
      }
      return importIndividualNodesInnerOnDragDrop(this, e);
    };
  },
});

export function importIndividualNodesInnerOnDragOver(node: ComfyNode, e: DragEvent): boolean {
  return (
    (node.widgets?.length && !!CONFIG_SERVICE.getFeatureValue("import_individual_nodes.enabled")) ||
    false
  );
}

export async function importIndividualNodesInnerOnDragDrop(node: ComfyNode, e: DragEvent) {
  if (!node.widgets?.length || !CONFIG_SERVICE.getFeatureValue("import_individual_nodes.enabled")) {
    return false;
  }

  let handled = false;
  const { workflow, prompt } = await tryToGetWorkflowDataFromEvent(e);
  if (!handled && workflow) {
    const exact = (workflow.nodes || []).find((n) => n.id === node.id && n.type === node.type);
    if (
      exact?.widgets_values?.length &&
      confirm(
        "Found a node match from embedded workflow (same id & type) in this workflow. Would you like to set the widget values?",
      )
    ) {
      node.configure({
        // Title is overridden if it's not supplied; set it to the current then.
        title: node.title,
        widgets_values: [...(exact?.widgets_values || [])]
      } as any);
      handled = true;
    }
  }
  if (!handled && workflow) {
    handled = !confirm(
      "No exact match found in workflow. Would you like to replace the whole workflow?",
    );
  }
  return handled;
}
