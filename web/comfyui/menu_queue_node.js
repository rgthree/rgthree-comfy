import { app } from "../../scripts/app.js";
import { rgthree } from "./rgthree.js";
app.registerExtension({
    name: "rgthree.QueueNode",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.output_node == true) {
            const getExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
            nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
                getExtraMenuOptions ? getExtraMenuOptions.apply(this, arguments) : undefined;
                const menuItem = {
                    content: `Queue Node (rgthree)`,
                    className: "rgthree-contextmenu-item",
                    callback: () => {
                        rgthree.queueOutputNode(this.id);
                    },
                };
                const idx = options.findIndex(o => (o === null || o === void 0 ? void 0 : o.content) === "Outputs") + 1 || options.length - 1;
                options.splice(idx, 0, menuItem);
            };
        }
    },
});
