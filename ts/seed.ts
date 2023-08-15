// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import {app} from "../../scripts/app.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";
import type {SerializedLGraphNode, ContextMenuItem, IContextMenuOptions, ContextMenu, LGraphNode as TLGraphNode, LiteGraph as TLiteGraph, IWidget} from './typings/litegraph.js';
import type {ComfyApp, ComfyObjectInfo, ComfyWidget, ComfyGraphNode} from './typings/comfy.js'

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;

const LAST_SEED_BUTTON_LABEL = '♻️ (Use Last Queued Seed)';

interface SeedSerializedCtx {
  wasRandom?: boolean;
  seedUsed?: number;
}

/** Wraps a node instance keeping closure without mucking the finicky types. */
class SeedControl {

  readonly node: ComfyGraphNode;

  lastSeed = -1;
  serializedCtx: SeedSerializedCtx = {};
  seedWidget: ComfyWidget;
  lastSeedButton: ComfyWidget;
  lastSeedValue: ComfyWidget|null = null;

  constructor(node: ComfyGraphNode) {
    this.node = node;
    this.node.properties = this.node.properties || {};

    // Grab the already available widgets, and remove the built-in control_after_generate
    for (const [i, w] of this.node.widgets.entries()) {
      if (w.name === 'seed') {
        this.seedWidget = w as ComfyWidget;
      } else if (w.name === 'control_after_generate') {
        this.node.widgets.splice(i, 1);
      }
    }

    // @ts-ignore
    if (!this.seedWidget) {
      throw new Error('Something\'s wrong; expected seed widget');
    }

    const max = Math.min(1125899906842624, this.seedWidget.options.max);
    const min = Math.max(-1125899906842624, this.seedWidget.options.min);
    const range = (max - min) / (this.seedWidget.options.step / 10);

    this.node.addWidget('button', '🎲 Randomize Each Time', null, () => {
      this.seedWidget.value = -1;
    }, {serialize: false}) as ComfyWidget;

    this.node.addWidget('button', '🎲 New Fixed Random', null, () => {
      this.seedWidget.value = Math.floor(Math.random() * range) * (this.seedWidget.options.step / 10) + min;
    }, {serialize: false});

    this.lastSeedButton = this.node.addWidget("button", LAST_SEED_BUTTON_LABEL, null, () => {
      this.seedWidget.value = this.lastSeed;
      this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
      this.lastSeedButton.disabled = true;
    }, {width: 50, serialize: false});
    this.lastSeedButton.disabled = true;


    /**
     * When we serialize the value, check if our seed widget is -1 and, if so, generate
     * a random number and set that to the input value. Also, set it in the passed graph node
     * for serialization, so it's saved in the image metadata. When re-opening the window, the
     * seed value will be pre-filled, instead of `-1`.
     */
    this.seedWidget.serializeValue = async (node: SerializedLGraphNode, index: number) => {
      const currentSeed = this.seedWidget.value;
      this.serializedCtx = {
        wasRandom: currentSeed == -1,
      }

      if (this.serializedCtx.wasRandom) {
        this.serializedCtx.seedUsed = Math.floor(Math.random() * range) * (this.seedWidget.options.step / 10) + min;
      } else {
        this.serializedCtx.seedUsed = this.seedWidget.value;
      }

      node.widgets_values![index] = this.serializedCtx.seedUsed;
      this.seedWidget.value = this.serializedCtx.seedUsed;
      // Enabled the 'Last seed' Button
      if (this.serializedCtx.wasRandom) {
        this.lastSeed = this.serializedCtx.seedUsed!;
        this.lastSeedButton.name = `♻️ ${this.serializedCtx.seedUsed}`
        this.lastSeedButton.disabled = false;
        if (this.lastSeedValue) {
          this.lastSeedValue.value = `Last Seed: ${this.serializedCtx.seedUsed}`;
        }
      } else {
        this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
        this.lastSeedButton.disabled = true;
      }

      return this.serializedCtx.seedUsed;
    }

    /**
     * After the widget has been queued, change back to "-1" if we started as "-1".
     */
    this.seedWidget.afterQueued = () => {
      if (this.serializedCtx.wasRandom) {
        this.seedWidget.value = -1;
      }
      this.serializedCtx = {};
    }


		this.node.getExtraMenuOptions = (_: TLGraphNode, options: ContextMenuItem[]) => {
      options.splice(options.length - 1, 0,
        {
          content: "Show/Hide Last Seed Value",
          callback: (_value: ContextMenuItem, _options: IContextMenuOptions, _event: MouseEvent, _parentMenu: ContextMenu | undefined, _node: TLGraphNode) => {
            this.node.properties['showLastSeed'] = !this.node.properties['showLastSeed'];
            if (this.node.properties['showLastSeed']) {
              this.addLastSeedValue();
            } else {
              this.removeLastSeedValue();
            }
          }
        }
      );
    }

  }

  addLastSeedValue() {
    if (this.lastSeedValue) return;
    this.lastSeedValue = ComfyWidgets["STRING"](this.node, "last_seed", ["STRING", { multiline: true }], app).widget;
    this.lastSeedValue!.inputEl!.readOnly = true;
    this.lastSeedValue!.inputEl!.style.fontSize = '0.75rem';
    this.lastSeedValue!.inputEl!.style.textAlign = 'center';
    this.lastSeedValue!.serializeValue = async (node: SerializedLGraphNode, index: number) => {
      node.widgets_values![index] = '';
      return '';
    }
    this.node.computeSize();
  }

  removeLastSeedValue() {
    if (!this.lastSeedValue) return;
    this.lastSeedValue!.inputEl!.remove();
    this.node.widgets.splice(this.node.widgets.indexOf(this.lastSeedValue as IWidget), 1);
    this.lastSeedValue = null;
    this.node.computeSize();
  }
}

app.registerExtension({
	name: "rgthree.Seed",
	async beforeRegisterNodeDef(nodeType: typeof LGraphNode, nodeData: ComfyObjectInfo, _app: ComfyApp) {
		if (nodeData.name === "Seed (rgthree)") {

			const onNodeCreated = nodeType.prototype.onNodeCreated;
			nodeType.prototype.onNodeCreated = function () {
				onNodeCreated ? onNodeCreated.apply(this, []) : undefined;
        (this as any).seedControl = new SeedControl(this as ComfyGraphNode);
      }
		}
	},
});