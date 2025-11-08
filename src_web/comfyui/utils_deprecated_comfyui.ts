/**
 * [🤮] ComfyUI started deprecating the use of their legacy JavaScript files. These are ports/shims
 * since we relied on them at one point.
 *
 * TODO: Should probably remove these all together at some point.
 */

import {app} from "scripts/app.js";

import type {INodeInputSlot, INodeOutputSlot, InputSpec, LGraphNode} from "@comfyorg/frontend";

/** Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/extensions/core/widgetInputs.ts#L462 */
interface PrimitiveNode extends LGraphNode {
  recreateWidget(): void;
  onLastDisconnect(): void;
}

/** Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/renderer/utils/nodeTypeGuards.ts */
function isPrimitiveNode(node: LGraphNode): node is PrimitiveNode {
  return node.type === "PrimitiveNode";
}

/**
 * CONFIG and GET_CONFIG in https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/services/litegraphService.ts
 * are not accessible publicly, so we need to look at a slot.widget's symbols and check to see if it
 * matches rather than access it directly. Cool...
 */
function getWidgetGetConfigSymbols(slot: INodeOutputSlot | INodeInputSlot): {
  CONFIG?: symbol;
  GET_CONFIG?: symbol;
} {
  const widget = slot?.widget;
  if (!widget) return {};
  const syms = Object.getOwnPropertySymbols(widget || {});
  for (const sym of syms) {
    const symVal = widget![sym];
    const isGetConfig = typeof symVal === "function";
    let maybeCfg = isGetConfig ? symVal() : symVal;
    if (
      Array.isArray(maybeCfg) &&
      maybeCfg.length >= 2 &&
      typeof maybeCfg[0] === "string" &&
      (maybeCfg[0] === "*" || typeof maybeCfg[1]?.type === "string")
    ) {
      return isGetConfig ? {GET_CONFIG: sym} : {CONFIG: sym};
    }
  }
  return {};
}

/**
 * Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/extensions/core/widgetInputs.ts
 */
export function getWidgetConfig(slot: INodeOutputSlot | INodeInputSlot): InputSpec {
  const configSyms = getWidgetGetConfigSymbols(slot);
  const widget = slot.widget || ({} as any);
  return (
    (configSyms.CONFIG && widget[configSyms.CONFIG]) ??
    (configSyms.GET_CONFIG && widget[configSyms.GET_CONFIG]?.()) ?? ["*", {}]
  );
}

/**
 * This is lossy, since we don't have access to GET_CONFIG Symbol, we cannot accurately set it. As a
 * best-chance we can look for a function that seems to return a
 *
 * Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/extensions/core/widgetInputs.ts
 */
export function setWidgetConfig(
  slot: INodeOutputSlot | INodeInputSlot | undefined,
  config: InputSpec,
) {
  if (!slot?.widget) return;
  if (config) {
    const configSyms = getWidgetGetConfigSymbols(slot);
    const widget = slot.widget || ({} as any);
    if (configSyms.GET_CONFIG) {
      widget[configSyms.GET_CONFIG] = () => config;
    } else if (configSyms.CONFIG) {
      widget[configSyms.CONFIG] = config;
    } else {
      console.error(
        "Cannot set widget Config. This is due to ComfyUI removing the ability to call legacy " +
          "JavaScript APIs that are now deprecated without new, supported APIs. It's possible " +
          "some things in rgthree-comfy do not work correctly. If you see this, please file a bug.",
      );
    }
  } else {
    delete slot.widget;
  }

  if ("link" in slot) {
    const link = app.graph.links[(slot as INodeInputSlot)?.link ?? -1];
    if (link) {
      const originNode = app.graph.getNodeById(link.origin_id);
      if (originNode && isPrimitiveNode(originNode)) {
        if (config) {
          originNode.recreateWidget();
        } else if (!app.configuringGraph) {
          originNode.disconnectOutput(0);
          originNode.onLastDisconnect();
        }
      }
    }
  }
}

/**
 * A slimmed-down version of `mergeIfValid` for only what was needed in rgthree-comfy.
 *
 * Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/extensions/core/widgetInputs.ts
 */
export function mergeIfValid(
  output: INodeOutputSlot | INodeInputSlot,
  config2: InputSpec,
): InputSpec[1] | null {
  const config1 = getWidgetConfig(output);
  const customSpec = mergeInputSpec(config1, config2);
  if (customSpec) {
    setWidgetConfig(output, customSpec);
  }
  return customSpec?.[1] ?? null;
}

/**
 * Merges two input specs.
 *
 * Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/utils/nodeDefUtil.ts
 */
const mergeInputSpec = (spec1: InputSpec, spec2: InputSpec): InputSpec | null => {
  const type1 = getInputSpecType(spec1);
  const type2 = getInputSpecType(spec2);

  if (type1 !== type2) {
    return null;
  }

  if (isIntInputSpec(spec1) || isFloatInputSpec(spec1)) {
    return mergeNumericInputSpec(spec1, spec2 as typeof spec1);
  }

  if (isComboInputSpec(spec1)) {
    return mergeComboInputSpec(spec1, spec2 as typeof spec1);
  }

  return mergeCommonInputSpec(spec1, spec2);
};

/**
 * Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/schemas/nodeDefSchema.ts
 */
function getInputSpecType(inputSpec: InputSpec): string {
  return isComboInputSpec(inputSpec) ? "COMBO" : inputSpec[0];
}

/**
 * Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/schemas/nodeDefSchema.ts
 */
function isComboInputSpecV1(inputSpec: InputSpec) {
  return Array.isArray(inputSpec[0]);
}

/**
 * Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/schemas/nodeDefSchema.ts
 */
function isIntInputSpec(inputSpec: InputSpec) {
  return inputSpec[0] === "INT";
}

/**
 * Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/schemas/nodeDefSchema.ts
 */
function isFloatInputSpec(inputSpec: InputSpec) {
  return inputSpec[0] === "FLOAT";
}

/**
 * Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/schemas/nodeDefSchema.ts
 */
function isComboInputSpecV2(inputSpec: InputSpec) {
  return inputSpec[0] === "COMBO";
}

/**
 * Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/schemas/nodeDefSchema.ts
 */
function isComboInputSpec(inputSpec: InputSpec) {
  return isComboInputSpecV1(inputSpec) || isComboInputSpecV2(inputSpec);
}

/** Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/utils/nodeDefUtil.ts */
const getRange = (options: any) => {
  const min = options.min ?? -Infinity;
  const max = options.max ?? Infinity;
  return {min, max};
};

/** Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/utils/nodeDefUtil.ts */
const mergeNumericInputSpec = <T extends any>(spec1: any, spec2: any): T | null => {
  const type = spec1[0];
  const options1 = spec1[1] ?? {};
  const options2 = spec2[1] ?? {};

  const range1 = getRange(options1);
  const range2 = getRange(options2);

  // If the ranges do not overlap, return null
  if (range1.min > range2.max || range1.max < range2.min) {
    return null;
  }

  const step1 = options1.step ?? 1;
  const step2 = options2.step ?? 1;

  const mergedOptions = {
    // Take intersection of ranges
    min: Math.max(range1.min, range2.min),
    max: Math.min(range1.max, range2.max),
    step: lcm(step1, step2),
  };

  return mergeCommonInputSpec(
    [type, {...options1, ...mergedOptions}] as T,
    [type, {...options2, ...mergedOptions}] as T,
  );
};

/** Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/utils/nodeDefUtil.ts */
const mergeComboInputSpec = <T extends any>(spec1: any, spec2: any): T | null => {
  const options1 = spec1[1] ?? {};
  const options2 = spec2[1] ?? {};

  const comboOptions1 = getComboSpecComboOptions(spec1);
  const comboOptions2 = getComboSpecComboOptions(spec2);

  const intersection = comboOptions1.filter((value) => comboOptions2.includes(value));

  // If the intersection is empty, return null
  if (intersection.length === 0) {
    return null;
  }

  return mergeCommonInputSpec(
    ["COMBO", {...options1, options: intersection}] as T,
    ["COMBO", {...options2, options: intersection}] as T,
  );
};

/** Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/utils/nodeDefUtil.ts */
const mergeCommonInputSpec = <T extends InputSpec>(spec1: T, spec2: T): T | null => {
  const type = getInputSpecType(spec1);
  const options1 = spec1[1] ?? {};
  const options2 = spec2[1] ?? {};

  const compareKeys = [...new Set([...Object.keys(options1), ...Object.keys(options2)])].filter(
    (key: string) => !IGNORE_KEYS.has(key),
  );

  const mergeIsValid = compareKeys.every((key: string) => {
    const value1 = options1[key];
    const value2 = options2[key];
    return value1 === value2 || (value1 == null && value2 == null);
  });

  return mergeIsValid ? ([type, {...options1, ...options2}] as T) : null;
};

/** Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/utils/nodeDefUtil.ts */
const IGNORE_KEYS = new Set<string>([
  "default",
  "forceInput",
  "defaultInput",
  "control_after_generate",
  "multiline",
  "tooltip",
  "dynamicPrompts",
]);

/**
 * Derived from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/schemas/nodeDefSchema.ts
 */
function getComboSpecComboOptions(inputSpec: any): (number | string)[] {
  return (isComboInputSpecV2(inputSpec) ? inputSpec[1]?.options : inputSpec[0]) ?? [];
}

/** Taken from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/utils/mathUtil.ts */
const lcm = (a: number, b: number): number => {
  return Math.abs(a * b) / gcd(a, b);
};

/** Taken from https://github.com/Comfy-Org/ComfyUI_frontend/blob/1f3fb90b1b79c4190b3faa7928b05a8ba3671307/src/utils/mathUtil.ts */
const gcd = (a: number, b: number): number => {
  return b === 0 ? a : gcd(b, a % b);
};
