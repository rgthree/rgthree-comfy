// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";
import type {
  SerializedLGraphNode,
  LGraphNode as TLGraphNode,
  LiteGraph as TLiteGraph,
} from "typings/litegraph.js";
import type { ComfyApp, ComfyObjectInfo } from "typings/comfy.js";
import { addConnectionLayoutSupport, replaceNode } from "./utils.js";
import { rgthree } from "./rgthree.js";

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;

let hasShownAlertForUpdatingInt = false;

app.registerExtension({
  name: "rgthree.DisplayAny",
  async beforeRegisterNodeDef(
    nodeType: typeof LGraphNode,
    nodeData: ComfyObjectInfo,
    app: ComfyApp,
  ) {
    if (nodeData.name === "Display Any (rgthree)" || nodeData.name === "Display Int (rgthree)") {
      (nodeType as any).title_mode = LiteGraph.NO_TITLE;

      const onNodeCreated = nodeType.prototype.onNodeCreated;
      nodeType.prototype.onNodeCreated = function () {
        onNodeCreated ? onNodeCreated.apply(this, []) : undefined;

        (this as any).showValueWidget = ComfyWidgets["STRING"](
          this,
          "output",
          ["STRING", { multiline: true }],
          app,
        ).widget;
        (this as any).showValueWidget.inputEl!.readOnly = true;
        (this as any).showValueWidget.serializeValue = async (
          node: TLGraphNode,
          index: number,
        ) => {
          const n = rgthree.getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(node);
          if (n) {
            // Since we need a round trip to get the value, the serizalized value means nothing, and
            // saving it to the metadata would just be confusing. So, we clear it here.
            n.widgets_values![index] = "";
          } else {
            console.warn('No serialized node found in workflow. May be attributed to '
              + 'https://github.com/comfyanonymous/ComfyUI/issues/2193');
          }
          return "";
        };
      };

      addConnectionLayoutSupport(nodeType, app, [["Left"], ["Right"]]);

      const onExecuted = nodeType.prototype.onExecuted;
      nodeType.prototype.onExecuted = function (message) {
        onExecuted?.apply(this, [message]);
        (this as any).showValueWidget.value = message.text[0];
      };
    }
  },

  // This ports Display Int to DisplayAny, but ComfyUI still shows an error.
  // If https://github.com/comfyanonymous/ComfyUI/issues/1527 is fixed, this could work.
  // async loadedGraphNode(node: TLGraphNode) {
  //   if (node.type === "Display Int (rgthree)") {
  //     replaceNode(node, "Display Any (rgthree)", new Map([["input", "source"]]));
  //     if (!hasShownAlertForUpdatingInt) {
  //       hasShownAlertForUpdatingInt = true;
  //       setTimeout(() => {
  //         alert(
  //           "Don't worry, your 'Display Int' nodes have been updated to the new " +
  //             "'Display Any' nodes! You can ignore the error message underneath (for that node)." +
  //             "\n\nThanks.\n- rgthree",
  //         );
  //       }, 128);
  //     }
  //   }
  // },
});
