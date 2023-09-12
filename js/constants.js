export function addRgthree(str) {
    return str + ' (rgthree)';
}
export function stripRgthree(str) {
    return str.replace(/\s*\(rgthree\)$/, '');
}
export const NodeTypesString = {
    NODE_MODE_RELAY: addRgthree('Mute / Bypass Relay'),
    NODE_MODE_REPEATER: addRgthree('Mute / Bypass Repeater'),
    FAST_MUTER: addRgthree('Fast Muter'),
    FAST_BYPASSER: addRgthree('Fast Bypasser'),
    FAST_ACTIONS_BUTTON: addRgthree('Fast Actions Button'),
    NODE_COLLECTOR: addRgthree('Node Collector'),
};