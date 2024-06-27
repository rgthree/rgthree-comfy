export function addRgthree(str) {
    return str + ' (rgthree)';
}
export function stripRgthree(str) {
    return str.replace(/\s*\(rgthree\)$/, '');
}
export const NodeTypesString = {
    ANY_SWITCH: addRgthree('Any Switch'),
    NODE_MODE_RELAY: addRgthree('Mute / Bypass Relay'),
    NODE_MODE_REPEATER: addRgthree('Mute / Bypass Repeater'),
    FAST_MUTER: addRgthree('Fast Muter'),
    FAST_BYPASSER: addRgthree('Fast Bypasser'),
    FAST_GROUPS_MUTER: addRgthree('Fast Groups Muter'),
    FAST_GROUPS_BYPASSER: addRgthree('Fast Groups Bypasser'),
    FAST_ACTIONS_BUTTON: addRgthree('Fast Actions Button'),
    LABEL: addRgthree('Label'),
    POWER_LORA_LOADER: addRgthree('Power Lora Loader'),
    NODE_COLLECTOR: addRgthree('Node Collector'),
    REROUTE: addRgthree('Reroute'),
    RANDOM_UNMUTER: addRgthree('Random Unmuter'),
    SEED: addRgthree('Seed'),
    BOOKMARK: addRgthree('Bookmark'),
    IMAGE_COMPARER: addRgthree('Image Comparer'),
};
