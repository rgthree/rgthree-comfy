// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";
import type {
  SerializedLGraphNode,
  ContextMenuItem,
  IContextMenuOptions,
  ContextMenu,
  LGraphNode as TLGraphNode,
  LiteGraph as TLiteGraph,
  IWidget,
} from "typings/litegraph.js";
import type { ComfyApp, ComfyObjectInfo, ComfyWidget, ComfyGraphNode } from "typings/comfy.js";
import { RgthreeBaseNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
import { addConnectionLayoutSupport } from "./utils.js";

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;

const LAST_SEED_BUTTON_LABEL = "♻️ (Use Last Queued Seed)";

const SPECIAL_SEED_RANDOM = -1;
const SPECIAL_SEED_INCREMENT = -2;
const SPECIAL_SEED_DECREMENT = -3;
const SPECIAL_SEEDS = [SPECIAL_SEED_RANDOM, SPECIAL_SEED_INCREMENT, SPECIAL_SEED_DECREMENT];

interface SeedSerializedCtx {
  inputSeed?: number;
  seedUsed?: number;
}

/** Wraps a node instance keeping closure without mucking the finicky types. */
class SeedControl {
  readonly node: ComfyGraphNode;

  lastSeed?: number = undefined;
  serializedCtx: SeedSerializedCtx = {};
  seedWidget: ComfyWidget;
  lastSeedButton: ComfyWidget;
  lastSeedValue: ComfyWidget | null = null;

  constructor(node: ComfyGraphNode) {
    this.node = node;

    (this.node.constructor as any).exposedActions = ["Randomize Each Time", "Use Last Queued Seed"];
    const handleAction = (this.node as RgthreeBaseNode).handleAction;
    (this.node as RgthreeBaseNode).handleAction = async (action: string) => {
      handleAction && handleAction.call(this.node, action);
      if (action === "Randomize Each Time") {
        this.seedWidget.value = SPECIAL_SEED_RANDOM;
      } else if (action === "Use Last Queued Seed") {
        this.seedWidget.value = this.lastSeed != null ? this.lastSeed : this.seedWidget.value;
        this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
        this.lastSeedButton.disabled = true;
      }
    };

    // (this.node as any).widgets_values = (this.node as any).widgets_values || [];

    this.node.properties = this.node.properties || {};

    // Grab the already available widgets, and remove the built-in control_after_generate
    for (const [i, w] of this.node.widgets.entries()) {
      if (w.name === "seed") {
        this.seedWidget = w as ComfyWidget;
        this.seedWidget.value = SPECIAL_SEED_RANDOM;
      } else if (w.name === "control_after_generate") {
        this.node.widgets.splice(i, 1);
      }
    }

    // @ts-ignore
    if (!this.seedWidget) {
      throw new Error("Something's wrong; expected seed widget");
    }

    const randMax = Math.min(1125899906842624, this.seedWidget.options.max);
    // We can have a full range of seeds, including negative. But, for the randomRange we'll
    // only generate positives, since that's what folks assume.
    // const min = Math.max(-1125899906842624, this.seedWidget.options.min);
    const randMin = Math.max(0, this.seedWidget.options.min);
    const randomRange = (randMax - Math.max(0, randMin)) / (this.seedWidget.options.step / 10);

    this.node.addWidget(
      "button",
      "🎲 Randomize Each Time",
      null,
      () => {
        this.seedWidget.value = SPECIAL_SEED_RANDOM;
      },
      { serialize: false },
    ) as ComfyWidget;

    this.node.addWidget(
      "button",
      "🎲 New Fixed Random",
      null,
      () => {
        this.seedWidget.value =
          Math.floor(Math.random() * randomRange) * (this.seedWidget.options.step / 10) + randMin;
      },
      { serialize: false },
    );

    this.lastSeedButton = this.node.addWidget(
      "button",
      LAST_SEED_BUTTON_LABEL,
      null,
      () => {
        this.seedWidget.value = this.lastSeed != null ? this.lastSeed : this.seedWidget.value;
        this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
        this.lastSeedButton.disabled = true;
      },
      { width: 50, serialize: false },
    );
    this.lastSeedButton.disabled = true;

    /**
     * When we serialize the value, check if our seed widget is -1 and, if so, generate
     * a random number and set that to the input value. Also, set it in the passed graph node
     * for serialization, so it's saved in the image metadata. When re-opening the window, the
     * seed value will be pre-filled, instead of `-1`.
     */
    this.seedWidget.serializeValue = async (node: TLGraphNode, index: number) => {
      const inputSeed = this.seedWidget.value;
      // Only actually swap and set the value when we're currently queuing. Some other nodes, like
      // cg-use-everywhere, serializes the graph even when not queing, and we don't want to swap
      // widget values in these cases.
      if (!rgthree.processingQueue) {
        return inputSeed;
      }
      this.serializedCtx = {
        inputSeed: this.seedWidget.value,
      };

      // If our input seed was a special seed, then handle it.
      if (SPECIAL_SEEDS.includes(this.serializedCtx.inputSeed!)) {
        // If the last seed was not a special seed and we have increment/decrement, then do that on
        // the last seed.
        if (typeof this.lastSeed === "number" && !SPECIAL_SEEDS.includes(this.lastSeed)) {
          if (inputSeed === SPECIAL_SEED_INCREMENT) {
            this.serializedCtx.seedUsed = this.lastSeed + 1;
          } else if (inputSeed === SPECIAL_SEED_DECREMENT) {
            this.serializedCtx.seedUsed = this.lastSeed - 1;
          }
        }
        // If we don't have a seed to use, or it's special seed (like we incremented into one), then
        // we randomize.
        if (!this.serializedCtx.seedUsed || SPECIAL_SEEDS.includes(this.serializedCtx.seedUsed)) {
          this.serializedCtx.seedUsed =
            Math.floor(Math.random() * randomRange) * (this.seedWidget.options.step / 10) + randMin;
        }
      } else {
        this.serializedCtx.seedUsed = this.seedWidget.value;
      }

      const n = rgthree.getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(node);
      if (n) {
        n.widgets_values![index] = this.serializedCtx.seedUsed;
      } else {
        console.warn('No serialized node found in workflow. May be attributed to '
          + 'https://github.com/comfyanonymous/ComfyUI/issues/2193');
      }
      this.seedWidget.value = this.serializedCtx.seedUsed;
      this.lastSeed = this.serializedCtx.seedUsed!;
      // Enabled the 'Last seed' Button
      if (SPECIAL_SEEDS.includes(this.serializedCtx.inputSeed!)) {
        this.lastSeedButton.name = `♻️ ${this.serializedCtx.seedUsed}`;
        this.lastSeedButton.disabled = false;
        if (this.lastSeedValue) {
          this.lastSeedValue.value = `Last Seed: ${this.serializedCtx.seedUsed}`;
        }
      } else {
        this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
        this.lastSeedButton.disabled = true;
      }

      return this.serializedCtx.seedUsed;
    };

    /**
     * After the widget has been queued, change back to "-1" if we started as "-1".
     */
    this.seedWidget.afterQueued = () => {
      if (this.serializedCtx.inputSeed) {
        this.seedWidget.value = this.serializedCtx.inputSeed;
      }
      this.serializedCtx = {};
    };

    const oldGetExtraMenuOptions = this.node.getExtraMenuOptions;
    this.node.getExtraMenuOptions = (_: TLGraphNode, options: ContextMenuItem[]) => {
      oldGetExtraMenuOptions?.apply(this.node, [_, options]);
      options.splice(options.length - 1, 0, {
        content: "Show/Hide Last Seed Value",
        callback: (
          _value: ContextMenuItem,
          _options: IContextMenuOptions,
          _event: MouseEvent,
          _parentMenu: ContextMenu | undefined,
          _node: TLGraphNode,
        ) => {
          this.node.properties["showLastSeed"] = !this.node.properties["showLastSeed"];
          if (this.node.properties["showLastSeed"]) {
            this.addLastSeedValue();
          } else {
            this.removeLastSeedValue();
          }
        },
      });
    };
  }

  addLastSeedValue() {
    if (this.lastSeedValue) return;
    this.lastSeedValue = ComfyWidgets["STRING"](
      this.node,
      "last_seed",
      ["STRING", { multiline: true }],
      app,
    ).widget;
    this.lastSeedValue!.inputEl!.readOnly = true;
    this.lastSeedValue!.inputEl!.style.fontSize = "0.75rem";
    this.lastSeedValue!.inputEl!.style.textAlign = "center";
    this.lastSeedValue!.serializeValue = async (node: TLGraphNode, index: number) => {
      const n = rgthree.getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(node);
      if (n) {
        n.widgets_values![index] = "";
      } else {
        console.warn('No serialized node found in workflow. May be attributed to '
          + 'https://github.com/comfyanonymous/ComfyUI/issues/2193');
      }
      return "";
    };
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
  async beforeRegisterNodeDef(
    nodeType: typeof LGraphNode,
    nodeData: ComfyObjectInfo,
    _app: ComfyApp,
  ) {
    if (nodeData.name === "Seed (rgthree)") {
      const onNodeCreated = nodeType.prototype.onNodeCreated;
      nodeType.prototype.onNodeCreated = function () {
        onNodeCreated ? onNodeCreated.apply(this, []) : undefined;
        (this as any).seedControl = new SeedControl(this as ComfyGraphNode);
      };
      addConnectionLayoutSupport(nodeType, app, [["Left", "Right"], ["Right", "Left"]]);
    }
  },
});
