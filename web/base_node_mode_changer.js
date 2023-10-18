import { BaseAnyInputConnectedNode } from "./base_any_input_connected_node.js";
import { PassThroughFollowing } from "./utils.js";
import { wait } from "./shared_utils.js";
export class BaseNodeModeChanger extends BaseAnyInputConnectedNode {
    constructor(title) {
        super(title);
        this.inputsPassThroughFollowing = PassThroughFollowing.ALL;
        this.isVirtualNode = true;
        this.modeOn = -1;
        this.modeOff = -1;
        wait(10).then(() => {
            if (this.modeOn < 0 || this.modeOff < 0) {
                throw new Error('modeOn and modeOff must be overridden.');
            }
        });
        this.addOutput("OPT_CONNECTION", "*");
    }
    handleLinkedNodesStabilization(linkedNodes) {
        for (const [index, node] of linkedNodes.entries()) {
            let widget = this.widgets && this.widgets[index];
            if (!widget) {
                this._tempWidth = this.size[0];
                widget = this.addWidget('toggle', '', false, '', { "on": 'yes', "off": 'no' });
            }
            node && this.setWidget(widget, node);
        }
        if (this.widgets && this.widgets.length > linkedNodes.length) {
            this.widgets.length = linkedNodes.length;
        }
    }
    setWidget(widget, linkedNode) {
        const off = linkedNode.mode === this.modeOff;
        widget.name = `Enable ${linkedNode.title}`;
        widget.options = { 'on': 'yes', 'off': 'no' };
        widget.value = !off;
        widget.doModeChange = (force) => {
            let off = force == null ? linkedNode.mode === this.modeOff : force;
            linkedNode.mode = (off ? this.modeOn : this.modeOff);
            widget.value = off;
        };
        widget.callback = () => {
            widget.doModeChange();
        };
    }
    forceWidgetOff(widget) {
        widget.doModeChange(false);
    }
    forceWidgetOn(widget) {
        widget.doModeChange(true);
    }
    static setUp(clazz) {
        BaseAnyInputConnectedNode.setUp(clazz);
    }
}
BaseNodeModeChanger.collapsible = false;
