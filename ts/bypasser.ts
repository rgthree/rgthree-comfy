// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
import { BaseNodeDispatcher } from "./base_node_dispatcher.js";
import type {IWidget, LGraphNode} from './typings/litegraph.js';

const MODE_BYPASS = 4;
const MODE_ALWAYS = 0;

class BypasserNode extends BaseNodeDispatcher {

  static override title = "Fast Bypasser (rgthree)";

  constructor(title = BypasserNode.title) {
    super(title);
  }

  override setWidget(widget: IWidget, linkedNode: LGraphNode) {
    const bypassed = linkedNode.mode === MODE_BYPASS;
    widget.name = `Enable ${linkedNode.title}`;
    widget.options = {
      'on': 'yes',
      'off': 'no'
    }
    widget.value = !bypassed;
    widget.callback = () => {
      const bypassed = linkedNode.mode === MODE_BYPASS;
      linkedNode.mode = bypassed ? MODE_ALWAYS : MODE_BYPASS;
      widget!.value = bypassed;
    }
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