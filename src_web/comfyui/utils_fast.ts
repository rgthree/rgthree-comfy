import { type LGraphGroup, type LiteGraph as TLiteGraph } from "typings/litegraph.js";

declare const LiteGraph: typeof TLiteGraph;

/**
 * Adds `_rgthreeHasAnyActiveNode` augment to group to cache state
 *
 * @param group Group to check
 * @returns true if any nodes are set to ALWAYS in the group
 */
export function groupHasActiveNode(group: LGraphGroup): boolean {
  group._rgthreeHasAnyActiveNode = group._nodes.some((n) => n.mode === LiteGraph.ALWAYS);
  return group._rgthreeHasAnyActiveNode;
}
