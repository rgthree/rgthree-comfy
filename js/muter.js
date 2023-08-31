import { app } from "../../scripts/app.js";
import { BaseNodeModeChanger } from "./base_node_mode_changer.js";
const MODE_MUTE = 2;
const MODE_ALWAYS = 0;
class MuterNode extends BaseNodeModeChanger {
    constructor(title = MuterNode.title) {
        super(title);
        this.modeOn = MODE_ALWAYS;
        this.modeOff = MODE_MUTE;
    }
}
MuterNode.title = "Fast Muter (rgthree)";
app.registerExtension({
    name: "rgthree.Muter",
    registerCustomNodes() {
        MuterNode.setUp(MuterNode);
    },
    loadedGraphNode(node) {
        if (node.type == MuterNode.title) {
            node._tempWidth = node.size[0];
        }
    }
});
