import type { LGraphNode } from "@comfyorg/litegraph";

/** Removes all inputs from the end. */
export function removeUnusedInputsFromEnd(node: LGraphNode, minNumber = 1, nameMatch?: RegExp) {
  for (let i = node.inputs.length - 1; i >= minNumber; i--) {
    if (!node.inputs[i]?.link) {
      if (!nameMatch || nameMatch.test(node.inputs[i]!.name)) {
        node.removeInput(i);
      }
      continue;
    }
    break;
  }
}