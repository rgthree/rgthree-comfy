// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
import { BaseNodeModeChanger } from "./base_node_mode_changer.js";
import type {LGraphNode} from './typings/litegraph.js';

const MODE_BYPASS = 4;
const MODE_ALWAYS = 0;

class BypasserNode extends BaseNodeModeChanger {

  static override title = "Fast Bypasser (rgthree)";
  override readonly modeOn = MODE_ALWAYS;
  override readonly modeOff = MODE_BYPASS;

  constructor(title = BypasserNode.title) {
    super(title);
  }
}

app.registerExtension({
  name: "rgthree.Bypasser",
  registerCustomNodes() {
    BypasserNode.setUp(BypasserNode);
  },
  loadedGraphNode(node: LGraphNode) {
    if (node.type == BypasserNode.title) {
      (node as any)._tempWidth = node.size[0];
    }
  }
});