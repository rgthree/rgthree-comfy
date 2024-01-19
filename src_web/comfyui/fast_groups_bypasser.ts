// @ts-ignore
import { app } from "../../scripts/app.js";
import { RgthreeBaseNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
import { FastGroupsMuter } from "./fast_groups_muter.js";
import {
  type LGraphNode,
  type LiteGraph as TLiteGraph,
} from "typings/litegraph.js";


declare const LiteGraph: typeof TLiteGraph;

/**
 * Fast Bypasser implementation that looks for groups in the workflow and adds toggles to mute them.
 */
export class FastGroupsBypasser extends FastGroupsMuter {
  static override type = NodeTypesString.FAST_GROUPS_BYPASSER;
  static override title = NodeTypesString.FAST_GROUPS_BYPASSER;

  static override exposedActions = ["Bypass all", "Enable all", "Toggle all"];

  protected override helpActions = 'bypass and enable';

  override readonly modeOn = LiteGraph.ALWAYS;
  override readonly modeOff = 4; // Used by Comfy for "bypass"

  constructor(title = FastGroupsBypasser.title) {
    super(title);
  }

  static override setUp<T extends RgthreeBaseNode>(clazz: new (title?: string) => T) {
    LiteGraph.registerNodeType((clazz as any).type, clazz);
    (clazz as any).category = (clazz as any)._category;
  }
}

app.registerExtension({
  name: "rgthree.FastGroupsBypasser",
  registerCustomNodes() {
    FastGroupsBypasser.setUp(FastGroupsBypasser);
  },
  loadedGraphNode(node: LGraphNode) {
    if (node.type == FastGroupsMuter.title) {
      (node as FastGroupsBypasser).tempSize = [...node.size];
    }
  },
});
