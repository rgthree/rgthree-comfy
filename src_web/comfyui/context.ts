// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
import type {
  INodeInputSlot,
  INodeOutputSlot,
  LGraph,
  LLink,
  LGraphCanvas as TLGraphCanvas,
  LiteGraph as TLiteGraph,
  LGraphNode as TLGraphNode,
} from "typings/litegraph.js";
import type { ComfyApp, ComfyNodeConstructor, ComfyObjectInfo } from "typings/comfy.js";
// @ts-ignore
import { app } from "../../scripts/app.js";
import {
  IoDirection,
  addConnectionLayoutSupport,
  addMenuItem,
  applyMixins,
  matchLocalSlotsToServer,
  replaceNode,
} from "./utils.js";
import { RgthreeBaseNode, RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";

declare const LGraphNode: typeof TLGraphNode;
declare const LiteGraph: typeof TLiteGraph;
declare const LGraphCanvas: typeof TLGraphCanvas;

/**
 * Takes a non-context node and determins for its input or output slot, if there is a valid
 * connection for an opposite context output or input slot.
 */
function findMatchingIndexByTypeOrName(otherNode: TLGraphNode, otherSlot: INodeInputSlot|INodeOutputSlot, ctxSlots: INodeInputSlot[]|INodeOutputSlot[]) {
  const otherNodeType = (otherNode.type || '').toUpperCase();
  const otherNodeName = (otherNode.title || '').toUpperCase();
  let otherSlotType = otherSlot.type as string;
  if (Array.isArray(otherSlotType) || otherSlotType.includes(',')) {
    otherSlotType = 'COMBO';
  }
  const otherSlotName = otherSlot.name.toUpperCase().replace('OPT_', '').replace('_NAME', '');
  let ctxSlotIndex = -1;
  if (["CONDITIONING", "INT", "STRING", "FLOAT", "COMBO"].includes(otherSlotType)) {
    ctxSlotIndex = ctxSlots.findIndex((ctxSlot) => {
      const ctxSlotName = ctxSlot.name.toUpperCase().replace('OPT_', '').replace('_NAME', '');
      let ctxSlotType = ctxSlot.type as string;
      if (Array.isArray(ctxSlotType) || ctxSlotType.includes(',')) {
        ctxSlotType = 'COMBO';
      }
      if (ctxSlotType !== otherSlotType) {
        return false;
      }
      // Straightforward matches.
      if(ctxSlotName === otherSlotName
            || (ctxSlotName === "SEED" && otherSlotName.includes("SEED"))
            || (ctxSlotName === "STEP_REFINER" && otherSlotName.includes("AT_STEP"))
            || (ctxSlotName === "STEP_REFINER" && otherSlotName.includes("REFINER_STEP"))) {
        return true;
      }
      // If postive other node, try to match conditining and text.
      if ((otherNodeType.includes('POSITIVE') || otherNodeName.includes('POSITIVE')) &&
          (
            (ctxSlotName === 'POSITIVE' && otherSlotType === 'CONDITIONING')
            || (ctxSlotName === 'TEXT_POS_G' && otherSlotName.includes("TEXT_G"))
            || (ctxSlotName === 'TEXT_POS_L' && otherSlotName.includes("TEXT_L"))
          )
          ) {
        return true;
      }
      if ((otherNodeType.includes('NEGATIVE') || otherNodeName.includes('NEGATIVE')) &&
          (
            (ctxSlotName === 'NEGATIVE' && otherSlotType === 'CONDITIONING')
            || (ctxSlotName === 'TEXT_NEG_G' && otherSlotName.includes("TEXT_G"))
            || (ctxSlotName === 'TEXT_NEG_L' && otherSlotName.includes("TEXT_L"))
          )
          ) {
        return true;
      }
      return false;
    });
  } else {
    ctxSlotIndex = ctxSlots.map((s) => s.type).indexOf(otherSlotType);
  }
  return ctxSlotIndex;
}


/**
 * A Base Context node for other context based nodes to extend.
 */
class BaseContextNode extends RgthreeBaseServerNode {
  constructor(title: string) {
    super(title);
  }

  // LiteGraph adds more spacing than we want when calculating a nodes' `_collapsed_width`, so we'll
  // override it with a setter and re-set it measured exactly as we want.
  ___collapsed_width: number = 0;

  //@ts-ignore - TS Doesn't like us overriding a property with accessors but, too bad.
  override get _collapsed_width() {
    return this.___collapsed_width;
  }

  override set _collapsed_width(width: number) {
    const canvas = app.canvas as TLGraphCanvas;
    const ctx = canvas.canvas.getContext('2d')!;
    const oldFont = ctx.font;
    ctx.font = canvas.title_text_font;
    let title = this.title.trim();
    this.___collapsed_width = 30 + (title ? 10 + ctx.measureText(title).width : 0);
    ctx.font = oldFont;
  }

  override connectByType<T = any>(
    slot: string | number,
    sourceNode: TLGraphNode,
    sourceSlotType: string,
    optsIn: string,
  ): T | null {
    let canConnect =
      super.connectByType &&
      super.connectByType.call(this, slot, sourceNode, sourceSlotType, optsIn);
    if (!super.connectByType) {
      canConnect = LGraphNode.prototype.connectByType.call(
        this,
        slot,
        sourceNode,
        sourceSlotType,
        optsIn,
      );
    }
    if (!canConnect && slot === 0) {
      const ctrlKey = rgthree.ctrlKey;
      // Okay, we've dragged a context and it can't connect.. let's connect all the other nodes.
      // Unfortunately, we don't know which are null now, so we'll just connect any that are
      // not already connected.
      for (const [index, input] of (sourceNode.inputs || []).entries()) {
        if (input.link && !ctrlKey) {
          continue;
        }
        const thisOutputSlot = findMatchingIndexByTypeOrName(sourceNode, input, this.outputs);
        if (thisOutputSlot > -1) {
          this.connect(thisOutputSlot, sourceNode, index);
        }
      }
    }
    return null;
  }

  override connectByTypeOutput<T = any>(slot: string | number, sourceNode: TLGraphNode, sourceSlotType: string, optsIn: string): T | null {
    let canConnect =
      super.connectByTypeOutput &&
      super.connectByTypeOutput.call(this, slot, sourceNode, sourceSlotType, optsIn);
    if (!super.connectByType) {
      canConnect = LGraphNode.prototype.connectByTypeOutput.call(
        this,
        slot,
        sourceNode,
        sourceSlotType,
        optsIn,
      );
    }
    if (!canConnect && slot === 0) {
      const ctrlKey = rgthree.ctrlKey;
      // Okay, we've dragged a context and it can't connect.. let's connect all the other nodes.
      // Unfortunately, we don't know which are null now, so we'll just connect any that are
      // not already connected.
      for (const [index, output] of (sourceNode.outputs || []).entries()) {
        if (output.links?.length && !ctrlKey) {
          continue;
        }
        const thisInputSlot = findMatchingIndexByTypeOrName(sourceNode, output, this.inputs);
        if (thisInputSlot > -1) {
          sourceNode.connect(index, this, thisInputSlot);
        }
      }
    }
    return null;
  }

  static override setUp(comfyClass: any, ctxClass: any) {
    RgthreeBaseServerNode.registerForOverride(comfyClass, ctxClass);
  }

  static override onRegisteredForOverride(comfyClass: any, ctxClass: any) {
    addConnectionLayoutSupport(ctxClass, app, [
      ["Left", "Right"],
      ["Right", "Left"],
    ]);
    setTimeout(() => {
      ctxClass.category = comfyClass.category;
    });
  }
}

/**
 * The original Context node.
 */
class ContextNode extends BaseContextNode {
  static override title = "Context (rgthree)";
  static override type = "Context (rgthree)";
  static comfyClass = "Context (rgthree)";

  constructor(title = ContextNode.title) {
    super(title);
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextNode);
  }

  static override onRegisteredForOverride(comfyClass: any, ctxClass: any) {
    BaseContextNode.onRegisteredForOverride(comfyClass, ctxClass);
    addMenuItem(ContextNode, app, {
      name: "Convert To Context Big",
      callback: (node) => {
        replaceNode(node, ContextBigNode.type);
      },
    });
  }
}

/**
 * The Context Big node.
 */
class ContextBigNode extends BaseContextNode {
  static override title = "Context Big (rgthree)";
  static override type = "Context Big (rgthree)";
  static comfyClass = "Context Big (rgthree)";

  constructor(title = ContextBigNode.title) {
    super(title);
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextBigNode);
  }

  static override onRegisteredForOverride(comfyClass: any, ctxClass: any) {
    BaseContextNode.onRegisteredForOverride(comfyClass, ctxClass);
    addMenuItem(ContextBigNode, app, {
      name: "Convert To Context (Original)",
      callback: (node) => {
        replaceNode(node, ContextNode.type);
      },
    });
  }
}

/**
 * The Context Switch (original) node.
 */
class ContextSwitchNode extends BaseContextNode {
  static override title = "Context Switch (rgthree)";
  static override type = "Context Switch (rgthree)";
  static comfyClass = "Context Switch (rgthree)";

  constructor(title = ContextSwitchNode.title) {
    super(title);
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextSwitchNode);
  }

  static override onRegisteredForOverride(comfyClass: any, ctxClass: any) {
    BaseContextNode.onRegisteredForOverride(comfyClass, ctxClass);
    addMenuItem(ContextSwitchNode, app, {
      name: "Convert To Context Switch Big",
      callback: (node) => {
        replaceNode(node, ContextSwitchBigNode.type);
      },
    });
  }
}

/**
 * The Context Switch Big node.
 */
class ContextSwitchBigNode extends BaseContextNode {
  static override title = "Context Switch Big (rgthree)";
  static override type = "Context Switch Big (rgthree)";
  static comfyClass = "Context Switch Big (rgthree)";

  constructor(title = ContextSwitchBigNode.title) {
    super(title);
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextSwitchBigNode);
  }

  static override onRegisteredForOverride(comfyClass: any, ctxClass: any) {
    BaseContextNode.onRegisteredForOverride(comfyClass, ctxClass);
    addMenuItem(ContextSwitchBigNode, app, {
      name: "Convert To Context Switch",
      callback: (node) => {
        replaceNode(node, ContextSwitchNode.type);
      },
    });
  }
}

/**
 * The Context Merge (original) node.
 */
class ContextMergeNode extends BaseContextNode {
  static override title = "Context Merge (rgthree)";
  static override type = "Context Merge (rgthree)";
  static comfyClass = "Context Merge (rgthree)";

  constructor(title = ContextMergeNode.title) {
    super(title);
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextMergeNode);
  }

  static override onRegisteredForOverride(comfyClass: any, ctxClass: any) {
    BaseContextNode.onRegisteredForOverride(comfyClass, ctxClass);
    addMenuItem(ContextMergeNode, app, {
      name: "Convert To Context Merge Big",
      callback: (node) => {
        replaceNode(node, ContextMergeBigNode.type);
      },
    });
  }
}

/**
 * The Context Switch Big node.
 */
class ContextMergeBigNode extends BaseContextNode {
  static override title = "Context Merge Big (rgthree)";
  static override type = "Context Merge Big (rgthree)";
  static comfyClass = "Context Merge Big (rgthree)";

  constructor(title = ContextMergeBigNode.title) {
    super(title);
  }

  static override setUp(comfyClass: any) {
    BaseContextNode.setUp(comfyClass, ContextMergeBigNode);
  }

  static override onRegisteredForOverride(comfyClass: any, ctxClass: any) {
    BaseContextNode.onRegisteredForOverride(comfyClass, ctxClass);
    addMenuItem(ContextMergeBigNode, app, {
      name: "Convert To Context Switch",
      callback: (node) => {
        replaceNode(node, ContextMergeNode.type);
      },
    });
  }
}

const contextNodes = [ContextNode, ContextBigNode, ContextSwitchNode, ContextSwitchBigNode, ContextMergeNode, ContextMergeBigNode];
const contextTypeToServerDef: { [type: string]: ComfyObjectInfo } = {};

function fixBadConfigs(node: ContextNode) {
  // Dumb mistake, but let's fix our mispelling. This will probably need to stay in perpetuity to
  // keep any old workflows operating.
  const wrongName = node.outputs.find((o, i) => o.name === 'CLIP_HEIGTH');
  if (wrongName) {
    wrongName.name = 'CLIP_HEIGHT';
  }
}

app.registerExtension({
  name: "rgthree.Context",
  async beforeRegisterNodeDef(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    // Loop over out context nodes and see if any match the server data.
    if (nodeData.name === ContextNode.type) {
    }

    for (const ctxClass of contextNodes) {
      if (nodeData.name === ctxClass.type) {
        ctxClass.nodeData = nodeData;
        ctxClass.nodeType = nodeType;
        contextTypeToServerDef[ctxClass.type] = nodeData;
        ctxClass.setUp(nodeType as any);
        break;
      }
    }
  },

  async nodeCreated(node: TLGraphNode) {
    const type = node.type || (node.constructor as any).type;
    const serverDef = type && contextTypeToServerDef[type];
    if (serverDef) {
      fixBadConfigs(node as ContextNode);
      matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
      // Switches don't need to change inputs, only context outputs
      if (!type!.includes("Switch") && !type!.includes("Merge")) {
        matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
      }
      // }, 100);
    }
  },

  /**
   * When we're loaded from the server, check if we're using an out of date version and update our
   * inputs / outputs to match.
   */
  async loadedGraphNode(node: TLGraphNode) {
    const type = node.type || (node.constructor as any).type;
    const serverDef = type && contextTypeToServerDef[type];
    if (serverDef) {
      fixBadConfigs(node as ContextNode);
      matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
      // Switches don't need to change inputs, only context outputs
      if (!type!.includes("Switch") && !type!.includes("Merge")) {
        matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
      }
    }
  },
});
