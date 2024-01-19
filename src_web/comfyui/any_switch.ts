// / <reference path="../node_modules/litegraph.js/src/litegraph.d.ts" />
// @ts-ignore
import { app } from "../../scripts/app.js";
// @ts-ignore
import { ComfyWidgets } from "../../scripts/widgets.js";
import type {
  INodeInputSlot,
  INodeOutputSlot,
  LGraphNodeConstructor,
  LLink,
  SerializedLGraphNode,
  LGraphNode as TLGraphNode,
  LiteGraph as TLiteGraph,
} from "typings/litegraph.js";
import type { ComfyApp, ComfyObjectInfo } from "typings/comfy.js";
import {
  IoDirection,
  addConnectionLayoutSupport,
  applyMixins,
  followConnectionUntilType,
  replaceNode,
} from "./utils.js";
import { RgthreeBaseNode } from "./base_node.js";

declare const LiteGraph: typeof TLiteGraph;
declare const LGraphNode: typeof TLGraphNode;

let hasShownAlertForUpdatingInt = false;

class AnySwitchforMixin extends RgthreeBaseNode {
  static comfyClass? = "";

  private scheduleStabilizePromise: Promise<void> | null = null;
  private nodeType: string | string[] | null = null;

  override onConnectionsChange(
    type: number,
    slotIndex: number,
    isConnected: boolean,
    linkInfo: LLink,
    ioSlot: INodeOutputSlot | INodeInputSlot,
  ) {
    super.onConnectionsChange?.(type, slotIndex, isConnected, linkInfo, ioSlot);
    this.scheduleStabilize();
  }

  onConnectionsChainChange() {
    this.scheduleStabilize();
  }

  scheduleStabilize(ms = 64) {
    if (!this.scheduleStabilizePromise) {
      this.scheduleStabilizePromise = new Promise((resolve) => {
        setTimeout(() => {
          this.scheduleStabilizePromise = null;
          this.stabilize();
          resolve();
        }, ms);
      });
    }
    return this.scheduleStabilizePromise;
  }

  stabilize() {
    // We prefer the inputs, then the output.
    let connectedType = followConnectionUntilType(this, IoDirection.INPUT, undefined, true);
    if (!connectedType) {
      connectedType = followConnectionUntilType(this, IoDirection.OUTPUT, undefined, true);
    }
    // TODO: What this doesn't do is broadcast to other nodes when its type changes. Reroute node
    // does, but, for now, if this was connected to another Any Switch, say, the second one wouldn't
    // change its type when the first does. The user would need to change the connections.
    this.nodeType = connectedType?.type || "*";
    for (const input of this.inputs) {
      input.type = this.nodeType as string; // So, types can indeed be arrays,,
    }
    for (const output of this.outputs) {
      output.type = this.nodeType as string; // So, types can indeed be arrays,,
      output.label =
        output.type === 'RGTHREE_CONTEXT' ? 'CONTEXT' :
        Array.isArray(this.nodeType) || this.nodeType.includes(",")
          ? connectedType?.label || String(this.nodeType)
          : String(this.nodeType);
    }
  }

  static override setUp<T extends RgthreeBaseNode>(nodeType: new(title?: any) => T) {
    AnySwitchforMixin.title = (nodeType as any).title;
    AnySwitchforMixin.type = (nodeType as any).type || (nodeType as any).title;
    AnySwitchforMixin.comfyClass = (nodeType as any).comfyClass;
    setTimeout(() => {
      AnySwitchforMixin.category = (nodeType as any).category;
    });
    applyMixins(nodeType, [RgthreeBaseNode, AnySwitchforMixin]);
    addConnectionLayoutSupport(nodeType, app, [["Left", "Right"], ["Right", "Left"]]);
  }
}

app.registerExtension({
  name: "rgthree.AnySwitch",
  async beforeRegisterNodeDef(
    nodeType: LGraphNodeConstructor,
    nodeData: ComfyObjectInfo,
    app: ComfyApp,
  ) {
    if (nodeData.name === "Any Switch (rgthree)") {
      AnySwitchforMixin.setUp(nodeType as any);
    }
  },
});
