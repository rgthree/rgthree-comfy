import { tryToGetWorkflowData } from "../../rgthree/common/utils_workflow.js";
import { app } from "../../scripts/app.js";
import { SERVICE as CONFIG_SERVICE } from "./config_service.js";
app.registerExtension({
    name: "rgthree.ImportIndividualNodes",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        console.log(nodeType, nodeData);
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
    var _a, _b, _c;
    if (!((_a = node.widgets) === null || _a === void 0 ? void 0 : _a.length) || !CONFIG_SERVICE.getFeatureValue("import_individual_nodes.enabled")) {
        return false;
    }
    let handled = false;
    let workflow;
    let prompt;
    for (const file of ((_b = e.dataTransfer) === null || _b === void 0 ? void 0 : _b.files) || []) {
        const data = await tryToGetWorkflowData(file);
        if (data.workflow || data.prompt) {
            workflow = data.workflow;
            prompt = data.prompt;
            break;
        }
    }
    if (!handled && workflow) {
        const exact = (workflow.nodes || []).find((n) => n.id === node.id && n.type === node.type);
        if (exact &&
            ((_c = exact.widgets_values) === null || _c === void 0 ? void 0 : _c.length) &&
            confirm("Found a node match from embedded workflow (same id & type) in this workflow. Would you like to set the widget values?")) {
            node.configure({ widgets_values: [...((exact === null || exact === void 0 ? void 0 : exact.widgets_values) || [])] });
            handled = true;
        }
    }
    if (!handled) {
        handled = !confirm("No exact match found in workflow. Would you like to replace the whole workflow?");
    }
    return handled;
}
