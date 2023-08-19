import { app } from "../../scripts/app.js";
import { addConnectionLayoutSupport } from "./utils.js";
app.registerExtension({
    name: "rgthree.Context",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "Context (rgthree)") {
            addConnectionLayoutSupport(nodeType, app, [['Left', 'Right'], ['Right', 'Left']]);
        }
    },
});
