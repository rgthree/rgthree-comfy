var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { addConnectionLayoutSupport } from "./utils.js";
app.registerExtension({
    name: "rgthree.DisplayInt",
    beforeRegisterNodeDef(nodeType, nodeData, app) {
        return __awaiter(this, void 0, void 0, function* () {
            if (nodeData.name === "Display Int (rgthree)") {
                let showValueWidget;
                nodeType.title_mode = LiteGraph.NO_TITLE;
                const onNodeCreated = nodeType.prototype.onNodeCreated;
                nodeType.prototype.onNodeCreated = function () {
                    onNodeCreated ? onNodeCreated.apply(this, []) : undefined;
                    showValueWidget = ComfyWidgets["STRING"](this, "output", ["STRING", { multiline: true }], app).widget;
                    showValueWidget.inputEl.readOnly = true;
                    showValueWidget.serializeValue = (node, index) => __awaiter(this, void 0, void 0, function* () {
                        node.widgets_values[index] = '';
                        return '';
                    });
                };
                addConnectionLayoutSupport(nodeType, app, [['Left'], ['Right']]);
                const onExecuted = nodeType.prototype.onExecuted;
                nodeType.prototype.onExecuted = function (message) {
                    onExecuted === null || onExecuted === void 0 ? void 0 : onExecuted.apply(this, [message]);
                    showValueWidget.value = message.text[0];
                };
            }
        });
    },
});
