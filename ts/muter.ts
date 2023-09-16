// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
import { BaseNodeModeChanger } from "./base_node_mode_changer.js";
import { NodeTypesString } from "./constants.js";
import type {LGraphNode} from './typings/litegraph.js';

const MODE_MUTE = 2;
const MODE_ALWAYS = 0;

class MuterNode extends BaseNodeModeChanger {

  static override exposedActions = ['Mute all', 'Enable all'];

  static override type = NodeTypesString.FAST_MUTER;
  static override title = NodeTypesString.FAST_MUTER;
  override readonly modeOn = MODE_ALWAYS;
  override readonly modeOff = MODE_MUTE;

  constructor(title = MuterNode.title) {
    super(title);
  }

  override async handleAction(action: string) {
    if (action === 'Mute all') {
      for (const widget of this.widgets) {
        this.forceWidgetOff(widget);
      }
    } else if (action === 'Enable all') {
      for (const widget of this.widgets) {
        this.forceWidgetOn(widget);
      }
    }
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