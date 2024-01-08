import { rgthree } from "./rgthree.js";
import { BaseAnyInputConnectedNode } from "./base_any_input_connected_node.js";
import { PassThroughFollowing, getConnectedInputNodes, getConnectedInputNodesAndFilterPassThroughs, shouldPassThrough } from "./utils.js";
export class BaseCollectorNode extends BaseAnyInputConnectedNode {
    constructor(title) {
        super(title);
        this.inputsPassThroughFollowing = PassThroughFollowing.REROUTE_ONLY;
        this.addOutput("Output", "*");
    }
    clone() {
        const cloned = super.clone();
        return cloned;
    }
    handleLinkedNodesStabilization(linkedNodes) {
    }
    onConnectInput(inputIndex, outputType, outputSlot, outputNode, outputIndex) {
        let canConnect = super.onConnectInput(inputIndex, outputType, outputSlot, outputNode, outputIndex);
        if (canConnect) {
            const allConnectedNodes = getConnectedInputNodes(this);
            const nodesAlreadyInSlot = getConnectedInputNodes(this, undefined, inputIndex);
            if (allConnectedNodes.includes(outputNode)) {
                rgthree.logger.debug(`BaseCollectorNode: ${outputNode.title} is already connected to ${this.title}.`);
                if (nodesAlreadyInSlot.includes(outputNode)) {
                    rgthree.logger.debug(`... but letting it slide since it's for the same slot.`);
                }
                else {
                    canConnect = false;
                }
            }
            if (canConnect && shouldPassThrough(outputNode, PassThroughFollowing.REROUTE_ONLY)) {
                const connectedNode = getConnectedInputNodesAndFilterPassThroughs(outputNode, undefined, undefined, PassThroughFollowing.REROUTE_ONLY)[0];
                if (connectedNode && allConnectedNodes.includes(connectedNode)) {
                    rgthree.logger.debug(`BaseCollectorNode: ${connectedNode.title} is already connected to ${this.title}.`);
                    if (nodesAlreadyInSlot.includes(connectedNode)) {
                        rgthree.logger.debug(`... but letting it slide since it's for the same slot.`);
                    }
                    else {
                        canConnect = false;
                    }
                }
            }
        }
        return canConnect;
    }
}
