// / <reference path='../node_modules/litegraph.js/src/litegraph.d.ts' />
// @ts-ignore
import {app} from '../../scripts/app.js';
import type {LGraphNode as TLGraphNode, LiteGraph as TLiteGraph} from 'typings/litegraph.js';
import type {ComfyApp, ComfyObjectInfo, ComfyGraphNode} from 'typings/comfy.js'
import {addConnectionLayoutSupport} from './utils.js';
import { PowerPrompt } from './base_power_prompt.js';

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;

let nodeData: ComfyObjectInfo | null = null;
app.registerExtension({
	name: 'rgthree.PowerPrompt',
	async beforeRegisterNodeDef(nodeType: typeof LGraphNode, passedNodeData: ComfyObjectInfo, _app: ComfyApp) {
		if (passedNodeData.name.includes('Power Prompt') && passedNodeData.name.includes('rgthree')) {
      nodeData = passedNodeData;
			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				onNodeCreated ? onNodeCreated.apply(this, []) : undefined;
        (this as any).powerPrompt = new PowerPrompt(this as ComfyGraphNode, passedNodeData);
      }
      addConnectionLayoutSupport(nodeType, app, [['Left', 'Right'], ['Right', 'Left']]);
		}
	},
  async loadedGraphNode(node: TLGraphNode) {
		if (node.type === 'Power Prompt (rgthree)') {
      setTimeout(() => {
        // If the first output is STRING, then it's the text output from the initial launch.
        // Let's port it to the new
        if (node.outputs[0]!.type === 'STRING') {
          if (node.outputs[0]!.links) {
            node.outputs[3]!.links = node.outputs[3]!.links || [];
            for (const link of node.outputs[0]!.links) {
              node.outputs[3]!.links.push(link);
              app.graph.links[link].origin_slot = 3;
            }
            node.outputs[0]!.links = null;
          }
          node.outputs[0]!.type = nodeData!.output![0] as string;
          node.outputs[0]!.name = nodeData!.output_name![0] || node.outputs[0]!.type as string;
          node.outputs[0]!.color_on = undefined;
          node.outputs[0]!.color_off = undefined;
        }
      }, 50)
    }
  }
});
