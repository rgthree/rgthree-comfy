// / <reference path='../node_modules/litegraph.js/src/litegraph.d.ts' />
// @ts-ignore
import {app} from '../../scripts/app.js';
// @ts-ignore
import {api} from '../../scripts/api.js';
// @ts-ignore
import { ComfyWidgets } from '../../scripts/widgets.js';
import type {IWidget, IComboWidget, LGraphNode as TLGraphNode, LiteGraph as TLiteGraph} from './typings/litegraph.js';
import type {ComfyApp, ComfyObjectInfo, ComfyGraphNode} from './typings/comfy.js'

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;

/** Wraps a node instance keeping closure without mucking the finicky types. */
class PowerPrompt {

  readonly node: ComfyGraphNode;
  readonly promptEl: HTMLTextAreaElement;
  nodeData: ComfyObjectInfo;
  embeddingWidget?: IComboWidget;
  savedWidget?: IComboWidget;
  savedValues?: string[];
  readonly boundOnFreshNodeDefs: (event: CustomEvent) => void;

  constructor(node: ComfyGraphNode, nodeData: ComfyObjectInfo) {
    this.node = node;
    this.node.properties = this.node.properties || {};

    this.nodeData = nodeData;

    this.promptEl = (node.widgets[0]! as any).inputEl;

    this.refreshCombos(nodeData);

    // We patched over api.getNodeDefs in utils.js to fire a custom event that we can not
    // listen to here to manually refresh our combos when a request comes in to fetch the
    // node data; which only happens one at startup (but before custom nodes js runs), and
    // then after clicking the "Refresh" button in the floating menu.
    this.boundOnFreshNodeDefs = this.onFreshNodeDefs.bind(this);
    api.addEventListener('fresh-node-defs', this.boundOnFreshNodeDefs);
    const oldNodeRemoved = this.node.onRemoved;
    this.node.onRemoved = () => {
      oldNodeRemoved?.call(this.node);
      api.removeEventListener('fresh-node-defs', this.boundOnFreshNodeDefs);
    }
  }

  onFreshNodeDefs(event: CustomEvent) {
    this.refreshCombos(event.detail[this.nodeData.name]);
  }

  refreshCombos(nodeData: ComfyObjectInfo) {
    this.nodeData = nodeData;
    // Add the combo for embeddings, in hidden inputs of nodeData
    for (const [key, value] of Object.entries(this.nodeData.input?.hidden || {})) {
      if (key.includes('embedding') && Array.isArray(value[0])) {
        const values = value[0];
        if (!this.embeddingWidget) {
          this.embeddingWidget = this.node.addWidget('combo', key.replace(/_/g, ' '), values[0], (selected) => {
            if (selected !== values[0]) {
              this.insertText(`embedding:${selected}`);
            }
            this.embeddingWidget!.value = values[0];
          }, {
            values,
            serialize: false, // Don't include this in prompt.
          });
        }
        this.embeddingWidget.options.values = values;
        this.embeddingWidget.value = values[0];

      } else if (key.includes('saved') && Array.isArray(value[0])) {
        const values = value[0];
        // If all we have is the "Choose" option and no prompts configured, then skip and don't show.
        if (values.length <= 1) {
          this.savedValues = [];
          if (this.savedWidget) {
            this.node.widgets.splice(this.node.widgets.indexOf(this.savedWidget as IWidget), 1);
            this.savedWidget = undefined;
          }
          continue;
        }
        if (key.startsWith('values')) {
          this.savedValues = values;
        } else {
          if (!this.savedWidget) {
            this.savedWidget = this.node.addWidget('combo', key.replace(/_/g, ' '), values[0], (selected) => {
              if (selected !== values[0]) {
                this.insertText(this.savedValues![values.indexOf(selected)]!);
              }
              this.savedWidget!.value = values[0];
            }, {
              values,
              serialize: false, // Don't include this in prompt.
            });
          }
          this.savedWidget.options.values = values;
          this.savedWidget.value = values[0];
        }
      }
    }
  }

  insertText(text: string) {
    if (this.promptEl) {
      const noSpace = [',','\n'];
      let prompt = this.promptEl.value;
      let first = prompt.substring(0, this.promptEl.selectionStart).replace(/ +$/, '');
      first = first + (noSpace.includes(first[first.length-1]!) ? '' : first.length ? ' ' : '');
      let second = prompt.substring(this.promptEl.selectionEnd).replace(/^ +/, '');
      second = (noSpace.includes(second[0]!) ? '' : second.length ? ' ' : '') + second;
      this.promptEl.value = first + text + second;
      this.promptEl.focus();
      this.promptEl.selectionStart = first.length;
      this.promptEl.selectionEnd = first.length + text.length;
    }
  }
}

app.registerExtension({
	name: 'rgthree.PowerPrompt',
	async beforeRegisterNodeDef(nodeType: typeof LGraphNode, nodeData: ComfyObjectInfo, _app: ComfyApp) {
		if (nodeData.name === 'Power Prompt (rgthree)') {

			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				onNodeCreated ? onNodeCreated.apply(this, []) : undefined;
        (this as any).powerPrompt = new PowerPrompt(this as ComfyGraphNode, nodeData);
      }

      // This won't actually work until such a thing exists in app.js#refreshComboInNodes
      // @ts-ignore
      // nodeType.prototype.onRefreshCombos = function (newNodeData: any) {
      //   (this as any).powerPrompt.refreshCombos(newNodeData);
      // }
		}
	},
});