import { app } from "../../scripts/app.js";
import { rgthree } from "./rgthree.js";
import { SERVICE as CONFIG_SERVICE } from "./config_service.js";
function getOutputNodesFromSelected(canvas) {
    return ((canvas.selected_nodes &&
        Object.values(canvas.selected_nodes).filter((n) => {
            var _a;
            return (n.mode != LiteGraph.NEVER &&
                ((_a = n.constructor.nodeData) === null || _a === void 0 ? void 0 : _a.output_node));
        })) ||
        []);
}
function showQueueNodesMenuIfOutputNodesAreSelected(existingOptions, node) {
    if (CONFIG_SERVICE.getConfigValue("features.menu_queue_selected_nodes") != false) {
        const canvas = app.canvas;
        const outputNodes = getOutputNodesFromSelected(canvas);
        const menuItem = {
            content: `Queue Selected Output Nodes (rgthree) &nbsp;`,
            className: "rgthree-contextmenu-item",
            callback: () => {
                rgthree.queueOutputNodes(outputNodes.map((n) => n.id));
            },
            disabled: !outputNodes.length,
        };
        let idx = existingOptions.findIndex((o) => (o === null || o === void 0 ? void 0 : o.content) === "Outputs") + 1;
        idx = idx || existingOptions.findIndex((o) => (o === null || o === void 0 ? void 0 : o.content) === "Align") + 1;
        idx = idx || 3;
        existingOptions.splice(idx, 0, menuItem);
    }
    return existingOptions;
}
app.registerExtension({
    name: "rgthree.QueueNode",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            getExtraMenuOptions ? getExtraMenuOptions.apply(this, arguments) : undefined;
            showQueueNodesMenuIfOutputNodesAreSelected(options, this);
        };
    },
    async setup() {
        const getCanvasMenuOptions = LGraphCanvas.prototype.getCanvasMenuOptions;
        LGraphCanvas.prototype.getCanvasMenuOptions = function (...args) {
            const options = getCanvasMenuOptions.apply(this, [...args]);
            showQueueNodesMenuIfOutputNodesAreSelected(options);
            return options;
        };
    },
});
