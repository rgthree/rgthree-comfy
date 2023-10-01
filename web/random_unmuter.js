import { app } from "../../scripts/app.js";
import { BaseAnyInputConnectedNode } from "./base_any_input_connected_node.js";
import { NodeTypesString } from "./constants.js";
import { rgthree } from "./rgthree.js";
import { getConnectedInputNodesAndFilterPassThroughs } from "./utils.js";
const MODE_MUTE = 2;
const MODE_ALWAYS = 0;
class RandomUnmuterNode extends BaseAnyInputConnectedNode {
    constructor(title = RandomUnmuterNode.title) {
        super(title);
        this.modeOn = MODE_ALWAYS;
        this.modeOff = MODE_MUTE;
        this.tempEnabledNode = null;
        this.processingQueue = false;
        this.onQueueBound = this.onQueue.bind(this);
        this.onQueueEndBound = this.onQueueEnd.bind(this);
        this.onGraphtoPromptBound = this.onGraphtoPrompt.bind(this);
        this.onGraphtoPromptEndBound = this.onGraphtoPromptEnd.bind(this);
        rgthree.addEventListener('queue', this.onQueueBound);
        rgthree.addEventListener('queue-end', this.onQueueEndBound);
        rgthree.addEventListener('graph-to-prompt', this.onGraphtoPromptBound);
        rgthree.addEventListener('graph-to-prompt-end', this.onGraphtoPromptEndBound);
    }
    onRemoved() {
        rgthree.removeEventListener('queue', this.onQueueBound);
        rgthree.removeEventListener('queue-end', this.onQueueEndBound);
        rgthree.removeEventListener('graph-to-prompt', this.onGraphtoPromptBound);
        rgthree.removeEventListener('graph-to-prompt-end', this.onGraphtoPromptEndBound);
    }
    onQueue(event) {
        this.processingQueue = true;
    }
    onQueueEnd(event) {
        this.processingQueue = false;
    }
    onGraphtoPrompt(event) {
        console.log('onQueue', event);
        if (!this.processingQueue) {
            return;
        }
        this.tempEnabledNode = null;
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
    onGraphtoPromptEnd(event) {
        console.log('onQueueEnd', event);
        if (this.tempEnabledNode) {
            this.tempEnabledNode.mode = this.modeOff;
            this.tempEnabledNode = null;
        }
    }
}
RandomUnmuterNode.exposedActions = ['Mute all', 'Enable all'];
RandomUnmuterNode.type = NodeTypesString.RANDOM_UNMUTER;
RandomUnmuterNode.title = RandomUnmuterNode.type;
app.registerExtension({
    name: "rgthree.RandomUnmuter",
    registerCustomNodes() {
        RandomUnmuterNode.setUp(RandomUnmuterNode);
    },
    loadedGraphNode(node) {
        if (node.type == RandomUnmuterNode.title) {
            node._tempWidth = node.size[0];
        }
    }
});
