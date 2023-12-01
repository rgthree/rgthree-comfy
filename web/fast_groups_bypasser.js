import { app } from "../../scripts/app.js";
import { NodeTypesString } from "./constants.js";
import { FastGroupsMuter } from "./fast_groups_muter.js";
export class FastGroupsBypasser extends FastGroupsMuter {
    constructor(title = FastGroupsBypasser.title) {
        super(title);
        this.modeOn = LiteGraph.ALWAYS;
        this.modeOff = 4;
    }
}
FastGroupsBypasser.type = NodeTypesString.FAST_GROUPS_BYPASSER;
FastGroupsBypasser.title = NodeTypesString.FAST_GROUPS_BYPASSER;
FastGroupsBypasser.exposedActions = ["Bypass all", "Enable all"];
app.registerExtension({
    name: "rgthree.FastGroupsBypasser",
    registerCustomNodes() {
        FastGroupsBypasser.setUp(FastGroupsBypasser);
    },
    loadedGraphNode(node) {
        if (node.type == FastGroupsMuter.title) {
            node.tempSize = [...node.size];
        }
    },
});
