import { RgthreeBaseVirtualNodeConstructor } from "typings/rgthree.js";
// @ts-ignore
import { app } from "../../scripts/app.js";
import { NodeTypesString } from "./constants.js";
import { BaseFastGroupsModeChanger } from "./fast_groups_muter.js";
import {
  type LiteGraph as TLiteGraph,
} from "typings/litegraph.js";


declare const LiteGraph: typeof TLiteGraph;

/**
 * Fast Bypasser implementation that looks for groups in the workflow and adds toggles to mute them.
 */
export class FastGroupsBypasser extends BaseFastGroupsModeChanger {
  static override type = NodeTypesString.FAST_GROUPS_BYPASSER;
  static override title = NodeTypesString.FAST_GROUPS_BYPASSER;
  override comfyClass = NodeTypesString.FAST_GROUPS_BYPASSER;

  static override exposedActions = ["Bypass all", "Enable all", "Toggle all"];

  protected override helpActions = 'bypass and enable';

  override readonly modeOn = LiteGraph.ALWAYS;
  override readonly modeOff = 4; // Used by Comfy for "bypass"

  constructor(title = FastGroupsBypasser.title) {
    super(title);
    this.onConstructed();
  }

  static override setUp(clazz: RgthreeBaseVirtualNodeConstructor) {
    LiteGraph.registerNodeType(clazz.type, clazz);
    clazz.category = clazz._category;
  }
}

app.registerExtension({
  name: "rgthree.FastGroupsBypasser",
  registerCustomNodes() {
    FastGroupsBypasser.setUp(FastGroupsBypasser);
  },
  loadedGraphNode(node: FastGroupsBypasser) {
    if (node.type == FastGroupsBypasser.title) {
      node.tempSize = [...node.size];
    }
  },
});

