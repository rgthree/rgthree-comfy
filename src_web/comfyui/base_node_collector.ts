import type { LLink, INodeOutputSlot, LGraphNode } from "typings/litegraph.js";
// @ts-ignore
import { app } from "../../scripts/app.js";
import { rgthree } from "./rgthree.js";
import { BaseAnyInputConnectedNode } from "./base_any_input_connected_node.js";
import { PassThroughFollowing, getConnectedInputNodes, getConnectedInputNodesAndFilterPassThroughs, getConnectedOutputNodes, getOriginNodeByLink, shouldPassThrough } from "./utils.js";

/**
 * Base collector node that monitors changing inputs and outputs.
 */
export class BaseCollectorNode extends BaseAnyInputConnectedNode {

  /**
   * We only want to show nodes through re_route nodes, other pass through nodes show each input.
   */
  override readonly inputsPassThroughFollowing: PassThroughFollowing = PassThroughFollowing.REROUTE_ONLY;

  constructor(title?: string) {
    super(title);
    this.addOutput("Output", "*");
  }

  override clone() {
    const cloned = super.clone();
    return cloned;
  }

  override handleLinkedNodesStabilization(linkedNodes: LGraphNode[]): void {
    // No-op, no widgets.
  }

  /**
   * When we connect an input, check to see if it's already connected and cancel it.
   */
  override onConnectInput(inputIndex: number, outputType: string | -1, outputSlot: INodeOutputSlot, outputNode: LGraphNode, outputIndex: number): boolean {
    let canConnect = super.onConnectInput(inputIndex, outputType, outputSlot, outputNode, outputIndex);
    if (canConnect) {
      const allConnectedNodes = getConnectedInputNodes(this); // We want passthrough nodes, since they will loop.
      const nodesAlreadyInSlot = getConnectedInputNodes(this, undefined, inputIndex);
      if (allConnectedNodes.includes(outputNode)) {
        // If we're connecting to the same slot, then allow it by replacing the one we have.
        // const slotsOriginNode = getOriginNodeByLink(this.inputs[inputIndex]?.link);
        rgthree.logger.debug(`BaseCollectorNode: ${outputNode.title} is already connected to ${this.title}.`);
        if (nodesAlreadyInSlot.includes(outputNode)) {
          rgthree.logger.debug(`... but letting it slide since it's for the same slot.`);
        } else {
          canConnect = false;
        }
      }
      if (canConnect && shouldPassThrough(outputNode, PassThroughFollowing.REROUTE_ONLY)) {
        const connectedNode = getConnectedInputNodesAndFilterPassThroughs(outputNode, undefined, undefined, PassThroughFollowing.REROUTE_ONLY)[0];
        if (connectedNode && allConnectedNodes.includes(connectedNode)) {
          // If we're connecting to the same slot, then allow it by replacing the one we have.
          rgthree.logger.debug(`BaseCollectorNode: ${connectedNode.title} is already connected to ${this.title}.`);
          if (nodesAlreadyInSlot.includes(connectedNode)) {
          rgthree.logger.debug(`... but letting it slide since it's for the same slot.`);
          } else {
            canConnect = false;
          }
        }
      }
    }
    return canConnect;
  }
}
