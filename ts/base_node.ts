// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
import { NodeMode } from "./typings/comfy.js";
import type {IWidget, LGraphNode as TLGraphNode} from './typings/litegraph.js';

declare const LGraphNode: typeof TLGraphNode;

/**
 * A base node with standard methods, extending the LGraphNode.
 */
export class RgthreeBaseNode extends LGraphNode {

  /**
   * Action strings that can be exposed and triggered from other nodes, like Fast Actions Button.
   */
  static exposedActions: string[] = [];

  static override title = "__NEED_NAME__";
  // `category` seems to get reset at register, so we'll
  // re-reset it after the register call. ¯\_(ツ)_/¯
  static category = 'rgthree';
  static _category = 'rgthree';

  isVirtualNode = true;

  /** A temporary width value that can be used to ensure compute size operates correctly. */
  _tempWidth = 0;

  /** Private Mode member so we can override the setter/getter and call an `onModeChange`. */
  private mode_: NodeMode;


  constructor(title = RgthreeBaseNode.title) {
    super(title);
    if (title == '__NEED_NAME__') {
      throw new Error('RgthreeBaseNode needs overrides.');
    }
    this.properties = this.properties || {};
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

  /** When a mode change, we want all connected nodes to match. */
  onModeChange() {
    // Override
  }

  /**
   * Given a string, do something. At the least, handle any `exposedActions` that may be called and
   * passed into from other nodes, like Fast Actions Button
   */
  async handleAction(action: string) {
    action; // No-op. Should be overridden but OK if not.
  }

  /**
   * Guess this doesn't exist in Litegraph...
   */
  removeWidget(widgetOrSlot?: IWidget | number) {
    if (typeof widgetOrSlot === 'number') {
      this.widgets.splice(widgetOrSlot, 1);
    } else if (widgetOrSlot) {
      const index = this.widgets.indexOf(widgetOrSlot);
      if (index > -1) {
        this.widgets.splice(index, 1);
      }
    }
  }

}