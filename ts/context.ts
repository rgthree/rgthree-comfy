// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
import type {
  INodeInputSlot,
  INodeOutputSlot,
  LGraph,
  LLink,
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
import { RgthreeBaseNode } from "./base_node.js";
import { rgthree } from "./rgthree.js";

declare const LGraphNode: typeof TLGraphNode;

/**
 * A Base Context node for other context based nodes to extend.
 */
class BaseContextNode extends RgthreeBaseNode {
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

  static override setUp<T extends BaseContextNode>(clazz: any, selfClazz?: any) {
    selfClazz.title = clazz.title;
    selfClazz.comfyClass = clazz.comfyClass;
    setTimeout(() => {
      selfClazz.category = clazz.category;
    });

    applyMixins(clazz, [RgthreeBaseNode, BaseContextNode, selfClazz]);

    // This isn't super useful, because R->L removes the names in order to work with
    // litegraph's hardcoded L->R math.. but, ¯\_(ツ)_/¯
    addConnectionLayoutSupport(clazz, app, [
      ["Left", "Right"],
      ["Right", "Left"],
    ]);
  }
}

class ContextNode extends BaseContextNode {
  static override title = "Context (rgthree)";
  static override type = "Context (rgthree)";
  static comfyClass = "Context (rgthree)";

  constructor(title = ContextNode.title) {
    super(title);
  }

  static override setUp(clazz: any) {
    BaseContextNode.setUp(clazz, ContextNode);

    addMenuItem(clazz, app, {
      name: "Convert To Context Big",
      callback: (node) => {
        replaceNode(node, ContextBigNode.type);
      },
    });
  }
}

class ContextBigNode extends BaseContextNode {
  static override type = "Context Big (rgthree)";
  static comfyClass = "Context Big (rgthree)";

  static override setUp(clazz: any) {
    BaseContextNode.setUp(clazz, ContextBigNode);
    addMenuItem(clazz, app, {
      name: "Convert To Context (Original)",
      callback: (node) => {
        replaceNode(node, ContextNode.type);
      },
    });
  }
}

class ContextSwitchNode extends BaseContextNode {
  static override type = "Context Switch (rgthree)";
  static comfyClass = "Context Switch (rgthree)";

  static override setUp(clazz: any) {
    BaseContextNode.setUp(clazz, ContextSwitchNode);
    addMenuItem(clazz, app, {
      name: "Convert To Context Switch Big",
      callback: (node) => {
        replaceNode(node, ContextSwitchBigNode.type);
      },
    });
  }
}

class ContextSwitchBigNode extends BaseContextNode {
  static override type = "Context Switch Big (rgthree)";
  static comfyClass = "Context Switch Big (rgthree)";

  static override setUp(clazz: any) {
    BaseContextNode.setUp(clazz, ContextSwitchBigNode);
    addMenuItem(clazz, app, {
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
  async beforeRegisterNodeDef(
    nodeType: ComfyNodeConstructor,
    nodeData: ComfyObjectInfo,
    app: ComfyApp,
  ) {
    let override = false;
    for (const clazz of contextNodes) {
      if (nodeData.name === clazz.type) {
        contextTypeToServerDef[clazz.type] = nodeData;
        clazz.setUp(nodeType as any);
        override = true;
        break;
      }
    }
  },

  async nodeCreated(node: TLGraphNode) {
    const type = node.type || (node.constructor as any).type;
    const serverDef = type && contextTypeToServerDef[type]
    if (serverDef) {
      // Because we need to wait for ComfyUI to take our forceInput widgets and make them actual
      // inputs first. Could probably be removed if github.com/comfyanonymous/ComfyUI/issues/1404
      // is fixed to skip forced widget generation.
      setTimeout(() => {
        matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
        // Switches don't need to change inputs, only context outputs
        if (!type!.includes("Switch")) {
          matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
        }
      }, 100);
    }
  },

  /**
   * When we're loaded from the server, check if we're using an out of date version and update our
   * inputs / outputs to match. This also fixes a bug where we can't put forceInputs in the right spot.
   */
  async loadedGraphNode(node: TLGraphNode) {
    const type = node.type || (node.constructor as any).type;
    const serverDef = type && contextTypeToServerDef[type]
    if (serverDef) {
      matchLocalSlotsToServer(node, IoDirection.OUTPUT, serverDef);
      // Switches don't need to change inputs, only context outputs
      if (!type!.includes("Switch")) {
        matchLocalSlotsToServer(node, IoDirection.INPUT, serverDef);
      }
    }
  },
});
