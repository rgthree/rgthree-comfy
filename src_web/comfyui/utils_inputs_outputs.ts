import type { LGraphNode } from "typings/litegraph";

/** Removes all inputs from the end. */
export function removeUnusedInputsFromEnd(node: LGraphNode, minNumber = 1) {
  for (let i = node.inputs.length - 1; i >= minNumber; i--) {
    if (!node.inputs[i]?.link) {
      node.removeInput(i);
      continue;
    }
    break;
  }
}
