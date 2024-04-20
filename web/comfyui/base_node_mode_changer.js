import { BaseAnyInputConnectedNode } from "./base_any_input_connected_node.js";
import { PassThroughFollowing } from "./utils.js";
import { wait } from "../../rgthree/common/shared_utils.js";
export class BaseNodeModeChanger extends BaseAnyInputConnectedNode {
    constructor(title) {
        super(title);
        this.inputsPassThroughFollowing = PassThroughFollowing.ALL;
        this.isVirtualNode = true;
        this.modeOn = -1;
        this.modeOff = -1;
        this.properties['toggleRestriction'] = 'default';
    }
    onConstructed() {
        wait(10).then(() => {
            if (this.modeOn < 0 || this.modeOff < 0) {
                throw new Error('modeOn and modeOff must be overridden.');
            }
        });
        this.addOutput("OPT_CONNECTION", "*");
        return super.onConstructed();
    }
    configure(info) {
        var _a;
        if ((_a = info.outputs) === null || _a === void 0 ? void 0 : _a.length) {
            info.outputs.length = 1;
        }
        super.configure(info);
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
    setWidget(widget, linkedNode, forceValue) {
        const value = forceValue == null ? linkedNode.mode === this.modeOn : forceValue;
        widget.name = `Enable ${linkedNode.title}`;
        widget.options = { 'on': 'yes', 'off': 'no' };
        widget.value = value;
        widget.doModeChange = (forceValue, skipOtherNodeCheck) => {
            var _a, _b, _c;
            let newValue = forceValue == null ? linkedNode.mode === this.modeOff : forceValue;
            if (skipOtherNodeCheck !== true) {
                if (newValue && ((_b = (_a = this.properties) === null || _a === void 0 ? void 0 : _a['toggleRestriction']) === null || _b === void 0 ? void 0 : _b.includes(' one'))) {
                    for (const widget of this.widgets) {
                        widget.doModeChange(false, true);
                    }
                }
                else if (!newValue && ((_c = this.properties) === null || _c === void 0 ? void 0 : _c['toggleRestriction']) === 'always one') {
                    newValue = this.widgets.every(w => !w.value || w === widget);
                }
            }
            linkedNode.mode = (newValue ? this.modeOn : this.modeOff);
            widget.value = newValue;
        };
        widget.callback = () => {
            widget.doModeChange();
        };
        if (forceValue != null) {
            linkedNode.mode = (forceValue ? this.modeOn : this.modeOff);
        }
    }
    forceWidgetOff(widget, skipOtherNodeCheck) {
        widget.doModeChange(false, skipOtherNodeCheck);
    }
    forceWidgetOn(widget, skipOtherNodeCheck) {
        widget.doModeChange(true, skipOtherNodeCheck);
    }
    forceWidgetToggle(widget, skipOtherNodeCheck) {
        widget.doModeChange(!widget.value, skipOtherNodeCheck);
    }
    static setUp(clazz) {
        BaseAnyInputConnectedNode.setUp(clazz);
    }
}
BaseNodeModeChanger.collapsible = false;
BaseNodeModeChanger["@toggleRestriction"] = {
    type: "combo",
    values: ["default", "max one", "always one"],
};
