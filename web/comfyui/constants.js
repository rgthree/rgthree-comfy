import { SERVICE as CONFIG_SERVICE } from "./services/config_service.js";
export function addRgthree(str) {
    return str + " (rgthree)";
}
export function stripRgthree(str) {
    return str.replace(/\s*\(rgthree\)$/, "");
}
export const NodeTypesString = {
    ANY_SWITCH: addRgthree("Any Switch"),
    CONTEXT: addRgthree("Context"),
    CONTEXT_BIG: addRgthree("Context Big"),
    CONTEXT_SWITCH: addRgthree("Context Switch"),
    CONTEXT_SWITCH_BIG: addRgthree("Context Switch Big"),
    CONTEXT_MERGE: addRgthree("Context Merge"),
    CONTEXT_MERGE_BIG: addRgthree("Context Merge Big"),
    DYNAMIC_CONTEXT: addRgthree("Dynamic Context"),
    DYNAMIC_CONTEXT_SWITCH: addRgthree("Dynamic Context Switch"),
    DISPLAY_ANY: addRgthree("Display Any"),
    IMAGE_OR_LATENT_SIZE: addRgthree("Image or Latent Size"),
    NODE_MODE_RELAY: addRgthree("Mute / Bypass Relay"),
    NODE_MODE_REPEATER: addRgthree("Mute / Bypass Repeater"),
    FAST_MUTER: addRgthree("Fast Muter"),
    FAST_BYPASSER: addRgthree("Fast Bypasser"),
    FAST_GROUPS_MUTER: addRgthree("Fast Groups Muter"),
    FAST_GROUPS_BYPASSER: addRgthree("Fast Groups Bypasser"),
    FAST_ACTIONS_BUTTON: addRgthree("Fast Actions Button"),
    LABEL: addRgthree("Label"),
    POWER_PRIMITIVE: addRgthree("Power Primitive"),
    POWER_PROMPT: addRgthree("Power Prompt"),
    POWER_PROMPT_SIMPLE: addRgthree("Power Prompt - Simple"),
    POWER_PUTER: addRgthree("Power Puter"),
    SDXL_EMPTY_LATENT_IMAGE: addRgthree("SDXL Empty Latent Image"),
    SDXL_POWER_PROMPT_POSITIVE: addRgthree("SDXL Power Prompt - Positive"),
    SDXL_POWER_PROMPT_NEGATIVE: addRgthree("SDXL Power Prompt - Simple / Negative"),
    POWER_LORA_LOADER: addRgthree("Power Lora Loader"),
    KSAMPLER_CONFIG: addRgthree("KSampler Config"),
    NODE_COLLECTOR: addRgthree("Node Collector"),
    REROUTE: addRgthree("Reroute"),
    RANDOM_UNMUTER: addRgthree("Random Unmuter"),
    SEED: addRgthree("Seed"),
    BOOKMARK: addRgthree("Bookmark"),
    IMAGE_COMPARER: addRgthree("Image Comparer"),
    IMAGE_INSET_CROP: addRgthree("Image Inset Crop"),
};
export function getNodeTypeStrings() {
    return Object.values(NodeTypesString)
        .map((i) => stripRgthree(i))
        .filter((i) => {
        if (i.startsWith("Dynamic Context") &&
            !CONFIG_SERVICE.getConfigValue("unreleased.dynamic_context.enabled")) {
            return false;
        }
        return true;
    })
        .sort();
}
