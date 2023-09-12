import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { addConnectionLayoutSupport, replaceNode } from "./utils.js";
let hasShownAlertForUpdatingInt = false;
app.registerExtension({
    name: "rgthree.DisplayAny",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Display Any (rgthree)") {
            nodeType.title_mode = LiteGraph.NO_TITLE;
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                onNodeCreated ? onNodeCreated.apply(this, []) : undefined;
                this.showValueWidget = ComfyWidgets["STRING"](this, "output", ["STRING", { multiline: true }], app).widget;
                this.showValueWidget.inputEl.readOnly = true;
                this.showValueWidget.serializeValue = async (node, index) => {
                    node.widgets_values[index] = "";
                    return "";
                };
            };
            addConnectionLayoutSupport(nodeType, app, [["Left"], ["Right"]]);
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted === null || onExecuted === void 0 ? void 0 : onExecuted.apply(this, [message]);
                this.showValueWidget.value = message.text[0];
            };
        }
    },
    async loadedGraphNode(node) {
        if (node.type === "Display Int (rgthree)") {
            replaceNode(node, "Display Any (rgthree)", new Map([["input", "source"]]));
            if (!hasShownAlertForUpdatingInt) {
                hasShownAlertForUpdatingInt = true;
                setTimeout(() => {
                    alert("Don't worry, your 'Display Int' nodes have been updated to the new " +
                        "'Display Any' nodes! You can ignore the error message underneath (for that node)." +
                        "\n\nThanks.\n- rgthree");
                }, 128);
            }
        }
    },
});
