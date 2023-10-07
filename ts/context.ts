// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
import type {
  INodeInputSlot,
  INodeOutputSlot,
  LGraph,
  LLink,
  LiteGraph as TLiteGraph,
  LGraphNode as TLGraphNode,
} from "./typings/litegraph.js";
import type { ComfyApp, ComfyNodeConstructor, ComfyObjectInfo } from "./typings/comfy.js";
// @ts-ignore
import { app } from "../../scripts/app.js";
import {
  IoDirection,
  addConnectionLayoutSupport,
  addMenuItem,
  applyMixins,
  matchLocalSlotsToServer,
  replaceNode,
  wait,
} from "./utils.js";
import { RgthreeBaseNode, RgthreeBaseServerNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";

declare const LGraphNode: typeof TLGraphNode;
declare const LiteGraph: typeof TLiteGraph;

/**
 * A Base Context node for other context based nodes to extend.
 */
class BaseContextNode extends RgthreeBaseServerNode {
  constructor(title: string) {
    super(title);
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
        const inputType = input.type as string;
        const inputName = input.name.toUpperCase();
        let thisOutputSlot = -1;
        if (["CONDITIONING", "INT"].includes(inputType)) {
          thisOutputSlot = this.outputs.findIndex(
            (o) =>
              o.type === inputType &&
              (o.name.toUpperCase() === inputName ||
                (o.name.toUpperCase() === "SEED" && inputName.includes("SEED")) ||
                (o.name.toUpperCase() === "STEP_REFINER" && inputName.includes("AT_STEP"))),
          );
        } else {
          thisOutputSlot = this.outputs.map((s) => s.type).indexOf(input.type);
        }
        if (thisOutputSlot > -1) {
          thisOutputSlot;
          this.connect(thisOutputSlot, sourceNode, index);
        }
      }
    }
    return null;
  }

  static override setUp(comfyClass: any, ctxClass: any) {
    RgthreeBaseServerNode.registerForOverride(comfyClass, ctxClass);
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
    addMenuItem(ContextSwitchBigNode, app, {
      name: "Convert To Context Switch",
      callback: (node) => {
        replaceNode(node, ContextSwitchNode.type);
      },
    });
  }
}

const contextNodes = [ContextNode, ContextBigNode, ContextSwitchNode, ContextSwitchBigNode];
const contextTypeToServerDef: { [type: string]: ComfyObjectInfo } = {};

app.registerExtension({
  name: "rgthree.Context",
  async beforeRegisterNodeDef(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    // Loop over out context nodes and see if any match the server data.
    if (nodeData.name === ContextNode.type) {
    }

    for (const ctxClass of contextNodes) {
      if (nodeData.name === ctxClass.type) {
        ctxClass.nodeData = nodeData;
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
      // Because we need to wait for ComfyUI to take our forceInput widgets and make them actual
      // inputs first. Could probably be removed if github.com/comfyanonymous/ComfyUI/issues/1404
      // is fixed to skip forced widget generation.
      // setTimeout(() => {
      matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
      // Switches don't need to change inputs, only context outputs
      if (!type!.includes("Switch")) {
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
      matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
      // Switches don't need to change inputs, only context outputs
      if (!type!.includes("Switch")) {
        matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
      }
    }
  },
});
