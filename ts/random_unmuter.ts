// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
import { BaseAnyInputConnectedNode } from "./base_any_input_connected_node.js";
import { NodeTypesString } from "./constants.js";
import { rgthree } from "./rgthree.js";
import type {LGraphNode} from './typings/litegraph.js';
import { getConnectedInputNodesAndFilterPassThroughs } from "./utils.js";

const MODE_MUTE = 2;
const MODE_ALWAYS = 0;

class RandomUnmuterNode extends BaseAnyInputConnectedNode {

  static override exposedActions = ['Mute all', 'Enable all'];

  static override type = NodeTypesString.RANDOM_UNMUTER;
  static override title = RandomUnmuterNode.type;
  readonly modeOn = MODE_ALWAYS;
  readonly modeOff = MODE_MUTE;

  tempEnabledNode: LGraphNode | null = null;
  processingQueue: boolean = false;

  onQueueBound = this.onQueue.bind(this);
  onQueueEndBound = this.onQueueEnd.bind(this);
  onGraphtoPromptBound = this.onGraphtoPrompt.bind(this);
  onGraphtoPromptEndBound = this.onGraphtoPromptEnd.bind(this);

  constructor(title = RandomUnmuterNode.title) {
    super(title);

    rgthree.addEventListener('queue', this.onQueueBound);
    rgthree.addEventListener('queue-end', this.onQueueEndBound);
    rgthree.addEventListener('graph-to-prompt', this.onGraphtoPromptBound);
    rgthree.addEventListener('graph-to-prompt-end', this.onGraphtoPromptEndBound);
  }

  override onRemoved() {
    rgthree.removeEventListener('queue', this.onQueueBound);
    rgthree.removeEventListener('queue-end', this.onQueueEndBound);
    rgthree.removeEventListener('graph-to-prompt', this.onGraphtoPromptBound);
    rgthree.removeEventListener('graph-to-prompt-end', this.onGraphtoPromptEndBound);
  }

  onQueue(event: Event) {
    this.processingQueue = true;
  }
  onQueueEnd(event: Event) {
    this.processingQueue = false;
  }
  onGraphtoPrompt(event: Event) {
    console.log('onQueue', event);
    if (!this.processingQueue) {
      return;
    }
    this.tempEnabledNode = null;
    // Check that all are muted and, if so, choose one to unmute.
    const linkedNodes = getConnectedInputNodesAndFilterPassThroughs(this);
    let allMuted = true;
    if (linkedNodes.length) {
      for (const node of linkedNodes) {
        if (node.mode !== this.modeOff) {
          allMuted = false;
          break;
        }
      }
      if (allMuted) {
        this.tempEnabledNode = linkedNodes[Math.floor(Math.random() * linkedNodes.length)] || null;
        if (this.tempEnabledNode) {
          this.tempEnabledNode.mode = this.modeOn;
        }
      }
    }
  }
  onGraphtoPromptEnd(event: Event) {
    console.log('onQueueEnd', event);
    if (this.tempEnabledNode) {
      this.tempEnabledNode.mode = this.modeOff;
      this.tempEnabledNode = null;
    }
  }

  // override async handleAction(action: string) {
  //   if (action === 'Mute all') {
  //     for (const widget of this.widgets) {
  //       this.forceWidgetOff(widget);
  //     }
  //   } else if (action === 'Enable all') {
  //     for (const widget of this.widgets) {
  //       this.forceWidgetOn(widget);
  //     }
  //   }
  // }
}

app.registerExtension({
  name: "rgthree.RandomUnmuter",
  registerCustomNodes() {
    RandomUnmuterNode.setUp(RandomUnmuterNode);
  },
  loadedGraphNode(node: LGraphNode) {
    if (node.type == RandomUnmuterNode.title) {
      (node as any)._tempWidth = node.size[0];
    }
  }
});