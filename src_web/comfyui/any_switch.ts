import type { INodeInputSlot, INodeOutputSlot, LLink } from "typings/litegraph.js";
import type { ComfyApp, ComfyNodeConstructor, ComfyObjectInfo } from "typings/comfy.js";

// @ts-ignore
import { app } from "../../scripts/app.js";
import { IoDirection, addConnectionLayoutSupport, followConnectionUntilType } from "./utils.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";

class RgthreeAnySwitch extends RgthreeBaseServerNode {
  static override title = NodeTypesString.ANY_SWITCH;
  static override type = NodeTypesString.ANY_SWITCH;
  static comfyClass = NodeTypesString.ANY_SWITCH;

  private scheduleStabilizePromise: Promise<void> | null = null;
  private nodeType: string | string[] | null = null;

  constructor(title = RgthreeAnySwitch.title) {
    super(title);
  }

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
        output.type === "RGTHREE_CONTEXT"
          ? "CONTEXT"
          : Array.isArray(this.nodeType) || this.nodeType.includes(",")
          ? connectedType?.label || String(this.nodeType)
          : String(this.nodeType);
    }
  }

  static override setUp(comfyClass: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    RgthreeBaseServerNode.registerForOverride(comfyClass, nodeData, RgthreeAnySwitch);
    addConnectionLayoutSupport(RgthreeAnySwitch, app, [
      ["Left", "Right"],
      ["Right", "Left"],
    ]);
  }
}

app.registerExtension({
  name: "rgthree.AnySwitch",
  async beforeRegisterNodeDef(
    nodeType: ComfyNodeConstructor,
    nodeData: ComfyObjectInfo,
    app: ComfyApp,
  ) {
    if (nodeData.name === "Any Switch (rgthree)") {
      RgthreeAnySwitch.setUp(nodeType, nodeData);
    }
  },
});
