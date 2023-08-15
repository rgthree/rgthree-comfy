// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";
import type {LGraphNode as TLGraphNode, LiteGraph as TLiteGraph} from './typings/litegraph.js';
import type {ComfyApp, ComfyObjectInfo} from './typings/comfy.js'
import { addConnectionLayoutSupport } from "./utils.js";

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;

app.registerExtension({
	name: "rgthree.Context",
	async beforeRegisterNodeDef(nodeType: typeof LGraphNode, nodeData: ComfyObjectInfo, app: ComfyApp) {
    if (nodeData.name === "Context (rgthree)") {

      // This isn't super useful, because R->L removes the names in order to work with
      // litegraph's hardcoded L->R math.. but, ¯\_(ツ)_/¯
      addConnectionLayoutSupport(nodeType, app, [['Left', 'Right'], ['Right', 'Left']]);
    }
  },
});