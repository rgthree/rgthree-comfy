// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";
import type {
  ContextMenuItem,
  IContextMenuOptions,
  ContextMenu,
  LGraphNode as TLGraphNode,
  LiteGraph as TLiteGraph,
  IWidget,
  LGraphCanvas,
} from "typings/litegraph.js";
import type { ComfyObjectInfo, ComfyWidget, ComfyNodeConstructor } from "typings/comfy.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";
import { addConnectionLayoutSupport } from "./utils.js";
import { NodeTypesString } from "./constants.js";

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

class RgthreeSeed extends RgthreeBaseServerNode {
  static override title = NodeTypesString.SEED;
  static override type = NodeTypesString.SEED;
  static comfyClass = NodeTypesString.SEED;

  override serialize_widgets = true;

  private logger; // Instantiated in constructor.

  static override exposedActions = ["Randomize Each Time", "Use Last Queued Seed"];

  lastSeed?: number = undefined;
  serializedCtx: SeedSerializedCtx = {};
  seedWidget!: IWidget;
  lastSeedButton!: ComfyWidget;
  lastSeedValue: ComfyWidget | null = null;

  randMax = 1125899906842624;
  // We can have a full range of seeds, including negative. But, for the randomRange we'll
  // only generate positives, since that's what folks assume.
  // const min = Math.max(-1125899906842624, this.seedWidget.options.min);
  randMin = 0;
  randomRange = 1125899906842624;

  private handleSeedWidgetSerializationBound = this.handleSeedWidgetSerialization.bind(this);
  private handleResetSeedWidgetBound = this.handleResetSeedWidget.bind(this);

  constructor(title = RgthreeSeed.title) {
    super(title);

    this.logger = rgthree.newLogSession(`[Seed]`);

    rgthree.addEventListener('graph-to-prompt', this.handleSeedWidgetSerializationBound);
    // Use this rgthree state event rather than widget.afterQueue because a try/catch may mean we
    // never get to it.
    rgthree.addEventListener('comfy-api-queue-prompt-end', this.handleResetSeedWidgetBound);
  }

  override onRemoved() {
    rgthree.removeEventListener('graph-to-prompt', this.handleSeedWidgetSerializationBound);
    rgthree.removeEventListener('comfy-api-queue-prompt-end', this.handleResetSeedWidgetBound);
  }

  override async handleAction(action: string) {
    if (action === "Randomize Each Time") {
      this.seedWidget.value = SPECIAL_SEED_RANDOM;
    } else if (action === "Use Last Queued Seed") {
      this.seedWidget.value = this.lastSeed != null ? this.lastSeed : this.seedWidget.value;
      this.lastSeedButton.name = LAST_SEED_BUTTON_LABEL;
      this.lastSeedButton.disabled = true;
    }
  }

  override onNodeCreated() {
    super.onNodeCreated?.();
    // Grab the already available widgets, and remove the built-in control_after_generate
    for (const [i, w] of this.widgets.entries()) {
      if (w.name === "seed") {
        this.seedWidget = w;// as ComfyWidget;
        this.seedWidget.value = SPECIAL_SEED_RANDOM;
      } else if (w.name === "control_after_generate") {
        this.widgets.splice(i, 1);
      }
    }

    // Update random values in case seed comes down with different options.
    let step = this.seedWidget.options.step || 1;
    this.randMax = Math.min(1125899906842624, this.seedWidget.options.max);
    // We can have a full range of seeds, including negative. But, for the randomRange we'll
    // only generate positives, since that's what folks assume.
    this.randMin = Math.max(0, this.seedWidget.options.min);
    this.randomRange = (this.randMax - Math.max(0, this.randMin)) / (step / 10);

    this.addWidget(
      "button",
      "🎲 Randomize Each Time",
      null,
      () => {
        this.seedWidget.value = SPECIAL_SEED_RANDOM;
      },
      { serialize: false },
    ) as ComfyWidget;

    this.addWidget(
      "button",
      "🎲 New Fixed Random",
      null,
      () => {
        this.seedWidget.value =
          Math.floor(Math.random() * this.randomRange) * (step / 10) + this.randMin;
      },
      { serialize: false },
    );

    this.lastSeedButton = this.addWidget(
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

  }

  override getExtraMenuOptions(canvas: LGraphCanvas, options: ContextMenuItem[]): void {
    super.getExtraMenuOptions?.apply(this, [...arguments] as any);
    options.splice(options.length - 1, 0, {
      content: "Show/Hide Last Seed Value",
      callback: (
        _value: ContextMenuItem,
        _options: IContextMenuOptions,
        _event: MouseEvent,
        _parentMenu: ContextMenu | undefined,
        _node: TLGraphNode,
      ) => {
        this.properties["showLastSeed"] = !this.properties["showLastSeed"];
        if (this.properties["showLastSeed"]) {
          this.addLastSeedValue();
        } else {
          this.removeLastSeedValue();
        }
      },
    });
  }

  addLastSeedValue() {
    if (this.lastSeedValue) return;
    this.lastSeedValue = ComfyWidgets["STRING"](
      this,
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
    this.computeSize();
  }

  removeLastSeedValue() {
    if (!this.lastSeedValue) return;
    this.lastSeedValue!.inputEl!.remove();
    this.widgets.splice(this.widgets.indexOf(this.lastSeedValue as IWidget), 1);
    this.lastSeedValue = null;
    this.computeSize();
  }

  /**
   * Handles the serialization of the seed widget for establishing the seed in the widget itself
   * for the workflow saving, and also for the api format sent to the server.
   *
   * This should check if we have a special seed and, if so, replace it with a "real" seed, then
   * change back to the original (handled below).
   */
  handleSeedWidgetSerialization() {
    const inputSeed = this.seedWidget.value;

    // Unfortunately, it's possible comfy and/or other extensions (namely, cg-use-everywhere) call
    // methods that end up triggering the widget serialization even when we're not trying to
    // execute a workflow. We don't want to do any work in those cases. The base `rgthree` instance
    // keeps track if we are processing a queue for sending to the server. If we're not, then we
    // can stop.
    if (!rgthree.processingQueue) {
      // This msg is too noisy since extensions call serialize graph every half second...
      // const [n, v] = this.logger.infoParts(
      //   "Not handling seed widget serialization b/c called when not handling a queue.",
      // );
      // console[n]?.(...v);
      return inputSeed;
    }
    // Also, it's possible that these other extensions end up calling through when we're in the
    // middle of a large batch. We need to stop this or else the widget will re-set thinking it's
    // actual value is the state of the real seed, and then refuce to re-set back to a randomize.
    // We check this by seeing if the `serializedCtx` has data that we expect to be reset when we
    // re-enter the next time.
    if (this.serializedCtx?.inputSeed) {
      const [n, v] = this.logger.debugParts(
        "Not handling seed widget serialization b/c we have not cleared the existing context; "
        + "Assuming this run was called outside of a prompt (like from cg-use-everywhere "
        + "analyzation)",
      );
      console[n]?.(...v);
      return inputSeed;
    }
    // Don't do work if we're muted/bypassed.
    if (this.mode === LiteGraph.NEVER || this.mode === 4) {
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
          Math.floor(Math.random() * this.randomRange) * ((this.seedWidget.options.step || 1) / 10) + this.randMin;
      }
    } else {
      this.serializedCtx.seedUsed = this.seedWidget.value;
    }

    const n = rgthree.getNodeFromInitialGraphToPromptSerializedWorkflowBecauseComfyUIBrokeStuff(this);
    const index = this.widgets.indexOf(this.seedWidget);
    if (n) {
      n.widgets_values![index] = this.serializedCtx.seedUsed;
    } else {
      const [n, v] = this.logger.warnParts(
        "No serialized node found in workflow. May be attributed to "
        + "https://github.com/comfyanonymous/ComfyUI/issues/2193",
      );
      console[n]?.(...v);
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
  }

  /**
   * Handles resetting the seed widget when it's been sent to the server, if we have context data
   * to reset.
   */
  handleResetSeedWidget() {
    if (this.serializedCtx.inputSeed) {
      this.seedWidget.value = this.serializedCtx.inputSeed;
    }
    this.serializedCtx = {};
  }

  static override setUp(comfyClass: any) {
    RgthreeBaseServerNode.registerForOverride(comfyClass, RgthreeSeed);
  }

  static override onRegisteredForOverride(comfyClass: any, ctxClass: any) {
    addConnectionLayoutSupport(RgthreeSeed, app, [
      ["Left", "Right"],
      ["Right", "Left"],
    ]);
    setTimeout(() => {
      RgthreeSeed.category = comfyClass.category;
    });
  }

}


app.registerExtension({
  name: "rgthree.Seed",
  async beforeRegisterNodeDef(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    if (nodeData.name === RgthreeSeed.type) {
      RgthreeSeed.nodeType = nodeType;
      RgthreeSeed.nodeData = nodeData;
      RgthreeSeed.setUp(nodeType as any);
    }
  },
});
