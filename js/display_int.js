import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { addConnectionLayoutSupport } from "./utils.js";
app.registerExtension({
    name: "rgthree.DisplayInt",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Display Int (rgthree)") {
            nodeType.title_mode = LiteGraph.NO_TITLE;
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined;
                this.showValueWidget = ComfyWidgets["STRING"](this, "output", ["STRING", { multiline: true }], app).widget;
                this.showValueWidget.inputEl.readOnly = true;
                this.showValueWidget.serializeValue = async (node, index) => {
                    node.widgets_values[index] = '';
                    return '';
                };
            };
            addConnectionLayoutSupport(nodeType, app, [['Left'], ['Right']]);
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                var _a;
                onExecuted === null || onExecuted === void 0 ? void 0 : onExecuted.apply(this, [message]);
                (_a = this.showValueWidget) === null || _a === void 0 ? void 0 : _a.value = message.text[0];
            };
        }
    },
});
