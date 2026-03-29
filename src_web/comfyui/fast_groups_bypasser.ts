import type {Size} from "@comfyorg/frontend";

import {app} from "scripts/app.js";
import {NodeTypesString} from "./constants.js";
import {BaseFastGroupsModeChanger} from "./fast_groups_muter.js";

/**
 * Fast Bypasser implementation that looks for groups in the workflow and adds toggles to bypass them.
 * Includes an option to completely hide bypassed groups from the canvas.
 */
export class FastGroupsBypasser extends BaseFastGroupsModeChanger {
  static override type = NodeTypesString.FAST_GROUPS_BYPASSER;
  static override title = NodeTypesString.FAST_GROUPS_BYPASSER;
  override comfyClass = NodeTypesString.FAST_GROUPS_BYPASSER;

  static override exposedActions = ["Bypass all", "Enable all", "Toggle all"];

  protected override helpActions = "bypass and enable";

  override readonly modeOn = LiteGraph.ALWAYS;
  override readonly modeOff = 4; // Used by Comfy for "bypass"

  static "@hideBypassedGroups" = {type: "boolean"};

  constructor(title = FastGroupsBypasser.title) {
    super(title);
    this.properties["hideBypassedGroups"] = false;
    this.onConstructed();
  }
}

app.registerExtension({
  name: "rgthree.FastGroupsBypasser",
  registerCustomNodes() {
    FastGroupsBypasser.setUp();
  },
  loadedGraphNode(node: FastGroupsBypasser) {
    if (node.type == FastGroupsBypasser.title) {
      node.tempSize = [...node.size] as Size;
    }
  },
});
