import { app } from "../../scripts/app.js";
import { BaseNodeDispatcher } from "./base_node_dispatcher.js";
const MODE_BYPASS = 4;
const MODE_ALWAYS = 0;
class BypasserNode extends BaseNodeDispatcher {
    constructor(title = BypasserNode.title) {
        super(title);
    }
    setWidget(widget, linkedNode) {
        const bypassed = linkedNode.mode === MODE_BYPASS;
        widget.name = `Enable ${linkedNode.title}`;
        widget.options = {
            'on': 'yes',
            'off': 'no'
        };
        widget.value = !bypassed;
        widget.callback = () => {
            const bypassed = linkedNode.mode === MODE_BYPASS;
            linkedNode.mode = bypassed ? MODE_ALWAYS : MODE_BYPASS;
            widget.value = bypassed;
        };
    }
}
BypasserNode.title = "Fast Bypasser (rgthree)";
app.registerExtension({
    name: "rgthree.Bypasser",
    registerCustomNodes() {
        BypasserNode.setUp(BypasserNode);
    },
    loadedGraphNode(node) {
        if (node.type == BypasserNode.title) {
            node._tempWidth = node.size[0];
        }
    }
});
