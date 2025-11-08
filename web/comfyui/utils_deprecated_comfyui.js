import { app } from "../../scripts/app.js";
function isPrimitiveNode(node) {
    return node.type === "PrimitiveNode";
}
function getWidgetGetConfigSymbols(slot) {
    var _a;
    const widget = slot === null || slot === void 0 ? void 0 : slot.widget;
    if (!widget)
        return {};
    const syms = Object.getOwnPropertySymbols(widget || {});
    for (const sym of syms) {
        const symVal = widget[sym];
        const isGetConfig = typeof symVal === "function";
        let maybeCfg = isGetConfig ? symVal() : symVal;
        if (Array.isArray(maybeCfg) &&
            maybeCfg.length >= 2 &&
            typeof maybeCfg[0] === "string" &&
            (maybeCfg[0] === "*" || typeof ((_a = maybeCfg[1]) === null || _a === void 0 ? void 0 : _a.type) === "string")) {
            return isGetConfig ? { GET_CONFIG: sym } : { CONFIG: sym };
        }
    }
    return {};
}
export function getWidgetConfig(slot) {
    var _a, _b, _c;
    const configSyms = getWidgetGetConfigSymbols(slot);
    const widget = slot.widget || {};
    return ((_c = (_a = (configSyms.CONFIG && widget[configSyms.CONFIG])) !== null && _a !== void 0 ? _a : (configSyms.GET_CONFIG && ((_b = widget[configSyms.GET_CONFIG]) === null || _b === void 0 ? void 0 : _b.call(widget)))) !== null && _c !== void 0 ? _c : ["*", {}]);
}
export function setWidgetConfig(slot, config) {
    var _a;
    if (!(slot === null || slot === void 0 ? void 0 : slot.widget))
        return;
    if (config) {
        const configSyms = getWidgetGetConfigSymbols(slot);
        const widget = slot.widget || {};
        if (configSyms.GET_CONFIG) {
            widget[configSyms.GET_CONFIG] = () => config;
        }
        else if (configSyms.CONFIG) {
            widget[configSyms.CONFIG] = config;
        }
        else {
            console.error("Cannot set widget Config. This is due to ComfyUI removing the ability to call legacy " +
                "JavaScript APIs that are now deprecated without new, supported APIs. It's possible " +
                "some things in rgthree-comfy do not work correctly. If you see this, please file a bug.");
        }
    }
    else {
        delete slot.widget;
    }
    if ("link" in slot) {
        const link = app.graph.links[(_a = slot === null || slot === void 0 ? void 0 : slot.link) !== null && _a !== void 0 ? _a : -1];
        if (link) {
            const originNode = app.graph.getNodeById(link.origin_id);
            if (originNode && isPrimitiveNode(originNode)) {
                if (config) {
                    originNode.recreateWidget();
                }
                else if (!app.configuringGraph) {
                    originNode.disconnectOutput(0);
                    originNode.onLastDisconnect();
                }
            }
        }
    }
}
export function mergeIfValid(output, config2) {
    var _a;
    const config1 = getWidgetConfig(output);
    const customSpec = mergeInputSpec(config1, config2);
    if (customSpec) {
        setWidgetConfig(output, customSpec);
    }
    return (_a = customSpec === null || customSpec === void 0 ? void 0 : customSpec[1]) !== null && _a !== void 0 ? _a : null;
}
const mergeInputSpec = (spec1, spec2) => {
    const type1 = getInputSpecType(spec1);
    const type2 = getInputSpecType(spec2);
    if (type1 !== type2) {
        return null;
    }
    if (isIntInputSpec(spec1) || isFloatInputSpec(spec1)) {
        return mergeNumericInputSpec(spec1, spec2);
    }
    if (isComboInputSpec(spec1)) {
        return mergeComboInputSpec(spec1, spec2);
    }
    return mergeCommonInputSpec(spec1, spec2);
};
function getInputSpecType(inputSpec) {
    return isComboInputSpec(inputSpec) ? "COMBO" : inputSpec[0];
}
function isComboInputSpecV1(inputSpec) {
    return Array.isArray(inputSpec[0]);
}
function isIntInputSpec(inputSpec) {
    return inputSpec[0] === "INT";
}
function isFloatInputSpec(inputSpec) {
    return inputSpec[0] === "FLOAT";
}
function isComboInputSpecV2(inputSpec) {
    return inputSpec[0] === "COMBO";
}
function isComboInputSpec(inputSpec) {
    return isComboInputSpecV1(inputSpec) || isComboInputSpecV2(inputSpec);
}
const getRange = (options) => {
    var _a, _b;
    const min = (_a = options.min) !== null && _a !== void 0 ? _a : -Infinity;
    const max = (_b = options.max) !== null && _b !== void 0 ? _b : Infinity;
    return { min, max };
};
const mergeNumericInputSpec = (spec1, spec2) => {
    var _a, _b, _c, _d;
    const type = spec1[0];
    const options1 = (_a = spec1[1]) !== null && _a !== void 0 ? _a : {};
    const options2 = (_b = spec2[1]) !== null && _b !== void 0 ? _b : {};
    const range1 = getRange(options1);
    const range2 = getRange(options2);
    if (range1.min > range2.max || range1.max < range2.min) {
        return null;
    }
    const step1 = (_c = options1.step) !== null && _c !== void 0 ? _c : 1;
    const step2 = (_d = options2.step) !== null && _d !== void 0 ? _d : 1;
    const mergedOptions = {
        min: Math.max(range1.min, range2.min),
        max: Math.min(range1.max, range2.max),
        step: lcm(step1, step2),
    };
    return mergeCommonInputSpec([type, { ...options1, ...mergedOptions }], [type, { ...options2, ...mergedOptions }]);
};
const mergeComboInputSpec = (spec1, spec2) => {
    var _a, _b;
    const options1 = (_a = spec1[1]) !== null && _a !== void 0 ? _a : {};
    const options2 = (_b = spec2[1]) !== null && _b !== void 0 ? _b : {};
    const comboOptions1 = getComboSpecComboOptions(spec1);
    const comboOptions2 = getComboSpecComboOptions(spec2);
    const intersection = comboOptions1.filter((value) => comboOptions2.includes(value));
    if (intersection.length === 0) {
        return null;
    }
    return mergeCommonInputSpec(["COMBO", { ...options1, options: intersection }], ["COMBO", { ...options2, options: intersection }]);
};
const mergeCommonInputSpec = (spec1, spec2) => {
    var _a, _b;
    const type = getInputSpecType(spec1);
    const options1 = (_a = spec1[1]) !== null && _a !== void 0 ? _a : {};
    const options2 = (_b = spec2[1]) !== null && _b !== void 0 ? _b : {};
    const compareKeys = [...new Set([...Object.keys(options1), ...Object.keys(options2)])].filter((key) => !IGNORE_KEYS.has(key));
    const mergeIsValid = compareKeys.every((key) => {
        const value1 = options1[key];
        const value2 = options2[key];
        return value1 === value2 || (value1 == null && value2 == null);
    });
    return mergeIsValid ? [type, { ...options1, ...options2 }] : null;
};
const IGNORE_KEYS = new Set([
    "default",
    "forceInput",
    "defaultInput",
    "control_after_generate",
    "multiline",
    "tooltip",
    "dynamicPrompts",
]);
function getComboSpecComboOptions(inputSpec) {
    var _a, _b;
    return (_b = (isComboInputSpecV2(inputSpec) ? (_a = inputSpec[1]) === null || _a === void 0 ? void 0 : _a.options : inputSpec[0])) !== null && _b !== void 0 ? _b : [];
}
const lcm = (a, b) => {
    return Math.abs(a * b) / gcd(a, b);
};
const gcd = (a, b) => {
    return b === 0 ? a : gcd(b, a % b);
};
