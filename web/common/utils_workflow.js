import { getResolver } from "./shared_utils.js";
import { getPngMetadata, getWebpMetadata } from "../../scripts/pnginfo.js";
export async function tryToGetWorkflowData(file) {
    var _a, _b, _c;
    if (file.type === "image/png") {
        const pngInfo = await getPngMetadata(file);
        return {
            workflow: JSON.parse((_a = pngInfo === null || pngInfo === void 0 ? void 0 : pngInfo.workflow) !== null && _a !== void 0 ? _a : "null"),
            prompt: JSON.parse((_b = pngInfo === null || pngInfo === void 0 ? void 0 : pngInfo.prompt) !== null && _b !== void 0 ? _b : "null"),
        };
    }
    if (file.type === "image/webp") {
        const pngInfo = await getWebpMetadata(file);
        const workflow = JSON.parse((pngInfo === null || pngInfo === void 0 ? void 0 : pngInfo.workflow) || (pngInfo === null || pngInfo === void 0 ? void 0 : pngInfo.Workflow) || "null");
        const prompt = JSON.parse((pngInfo === null || pngInfo === void 0 ? void 0 : pngInfo.prompt) || (pngInfo === null || pngInfo === void 0 ? void 0 : pngInfo.Prompt) || "null");
        return { workflow, prompt };
    }
    if (file.type === "application/json" || ((_c = file.name) === null || _c === void 0 ? void 0 : _c.endsWith(".json"))) {
        const resolver = getResolver();
        const reader = new FileReader();
        reader.onload = async () => {
            const json = JSON.parse(reader.result);
            const isApiJson = Object.values(json).every((v) => v.class_type);
            const prompt = isApiJson ? json : null;
            const workflow = !isApiJson && !(json === null || json === void 0 ? void 0 : json.templates) ? json : null;
            return { workflow, prompt };
        };
        return resolver.promise;
    }
    return { workflow: null, prompt: null };
}
