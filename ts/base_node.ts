// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
import { NodeMode } from "./typings/comfy.js";
import type {LGraphNode as TLGraphNode, LiteGraph as TLiteGraph} from './typings/litegraph.js';

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;


export class RgthreeBaseNode extends LGraphNode {

  static override title = "__NEED_NAME__";
  // `category` seems to get reset at register, so we'll
  // re-reset it after the register call. ¯\_(ツ)_/¯
  static category = 'rgthree';
  static _category = 'rgthree';

  isVirtualNode = true;

  constructor(title = RgthreeBaseNode.title) {
    super(title);
    if (title == '__NEED_NAME__') {
      throw new Error('RgthreeBaseNode needs overrides.');
    }
    this.properties = this.properties || {};
  }

  mode_: NodeMode;

  /** When a mode change, we want all connected nodes to match. */
  onModeChange() {
    // Override
  }

  // @ts-ignore - Changing the property to an accessor here seems to work, but ts compiler complains.
  override set mode(mode: NodeMode) {
    if (this.mode_ != mode) {
      this.mode_ = mode;
      this.onModeChange();
    }

  }
  override get mode() {
    return this.mode_;
  }

}