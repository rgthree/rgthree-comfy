import { tryToGetWorkflowDataFromEvent } from "../../rgthree/common/utils_workflow.js";
import { app } from "../../scripts/app.js";
import { SERVICE as CONFIG_SERVICE } from "./services/config_service.js";
app.registerExtension({
    name: "rgthree.ImportIndividualNodes",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        const onDragOver = nodeType.prototype.onDragOver;
        nodeType.prototype.onDragOver = function (e) {
            var _a;
            let handled = (_a = onDragOver === null || onDragOver === void 0 ? void 0 : onDragOver.apply) === null || _a === void 0 ? void 0 : _a.call(onDragOver, this, [...arguments]);
            if (handled != null) {
                return handled;
            }
            return importIndividualNodesInnerOnDragOver(this, e);
        };
        const onDragDrop = nodeType.prototype.onDragDrop;
        nodeType.prototype.onDragDrop = async function (e) {
            var _a;
            const alreadyHandled = await ((_a = onDragDrop === null || onDragDrop === void 0 ? void 0 : onDragDrop.apply) === null || _a === void 0 ? void 0 : _a.call(onDragDrop, this, [...arguments]));
            if (alreadyHandled) {
                return alreadyHandled;
            }
            return importIndividualNodesInnerOnDragDrop(this, e);
        };
    },
});
export function importIndividualNodesInnerOnDragOver(node, e) {
    var _a;
    return ((((_a = node.widgets) === null || _a === void 0 ? void 0 : _a.length) && !!CONFIG_SERVICE.getFeatureValue("import_individual_nodes.enabled")) ||
        false);
}
export async function importIndividualNodesInnerOnDragDrop(node, e) {
    var _a, _b;
    if (!((_a = node.widgets) === null || _a === void 0 ? void 0 : _a.length) || !CONFIG_SERVICE.getFeatureValue("import_individual_nodes.enabled")) {
        return false;
    }
    let handled = false;
    const { workflow, prompt } = await tryToGetWorkflowDataFromEvent(e);
    if (!handled && workflow) {
        const exact = (workflow.nodes || []).find((n) => n.id === node.id && n.type === node.type);
        if (((_b = exact === null || exact === void 0 ? void 0 : exact.widgets_values) === null || _b === void 0 ? void 0 : _b.length) &&
            confirm("Found a node match from embedded workflow (same id & type) in this workflow. Would you like to set the widget values?")) {
            node.configure({
                title: node.title,
                widgets_values: [...((exact === null || exact === void 0 ? void 0 : exact.widgets_values) || [])]
            });
            handled = true;
        }
    }
    if (!handled && workflow) {
        handled = !confirm("No exact match found in workflow. Would you like to replace the whole workflow?");
    }
    return handled;
}
