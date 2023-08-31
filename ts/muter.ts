// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
import { BaseNodeModeChanger } from "./base_node_mode_changer.js";
import type {LGraphNode} from './typings/litegraph.js';

const MODE_MUTE = 2;
const MODE_ALWAYS = 0;

class MuterNode extends BaseNodeModeChanger {

  static override title = "Fast Muter (rgthree)";
  override readonly modeOn = MODE_ALWAYS;
  override readonly modeOff = MODE_MUTE;

  constructor(title = MuterNode.title) {
    super(title);
  }
}

app.registerExtension({
  name: "rgthree.Muter",
  registerCustomNodes() {
    MuterNode.setUp(MuterNode);
  },
  loadedGraphNode(node: LGraphNode) {
    if (node.type == MuterNode.title) {
      (node as any)._tempWidth = node.size[0];
    }
  }
});