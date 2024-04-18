export function groupHasActiveNode(group) {
    group._rgthreeHasAnyActiveNode = group._nodes.some((n) => n.mode === LiteGraph.ALWAYS);
    return group._rgthreeHasAnyActiveNode;
}
