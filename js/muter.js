import { app } from "../../scripts/app.js";
import { BaseNodeDispatcher } from "./base_node_dispatcher.js";
const MODE_MUTE = 2;
const MODE_ALWAYS = 0;
class MuterNode extends BaseNodeDispatcher {
    constructor(title = MuterNode.title) {
        super(title);
    }
    setWidget(widget, linkedNode) {
        const muted = linkedNode.mode === MODE_MUTE;
        widget.name = `Enable ${linkedNode.title}`;
        widget.options = {
            'on': 'yes',
            'off': 'no'
        };
        widget.value = !muted;
        widget.callback = () => {
            const muted = linkedNode.mode === MODE_MUTE;
            linkedNode.mode = muted ? MODE_ALWAYS : MODE_MUTE;
            widget.value = muted;
        };
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
