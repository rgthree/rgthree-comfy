// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
import { BaseNodeDispatcher } from "./base_node_dispatcher.js";
import type {IWidget, LGraphNode, LGraphNode as TLGraphNode} from './typings/litegraph.js';

const MODE_MUTE = 2;
const MODE_ALWAYS = 0;

class MuterNode extends BaseNodeDispatcher {

  static override title = "Fast Muter (rgthree)";

  constructor(title = MuterNode.title) {
    super(title);
  }

  override setWidget(widget: IWidget, linkedNode: TLGraphNode) {
    const muted = linkedNode.mode === MODE_MUTE;
    widget.name = `Enable ${linkedNode.title}`;
    widget.options = {
      'on': 'yes',
      'off': 'no'
    }
    widget.value = !muted;
    widget.callback = () => {
      const muted = linkedNode.mode === MODE_MUTE;
      linkedNode.mode = muted ? MODE_ALWAYS : MODE_MUTE;
      widget!.value = muted;
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