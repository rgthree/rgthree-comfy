/**
 * @fileoverview A set of methods that mimic a bit of the Jasmine testing library, but simpler and
 * more succinct for manipulating a comfy integration test.
 *
 * Tests are not bundled by default, to test build with "--with-tests" and then invoke from the
 * dev console like `rgthree_tests.TestDescribeLabel()`. The output is in the test itself.
 */
import {wait} from "rgthree/common/shared_utils.js";

declare global {
  interface Window {
    rgthree_tests: {
      [key: string]: any;
    };
  }
}

window.rgthree_tests = window.rgthree_tests || {};

export type TestMatcher = {
  shouldLabel?: string;
  expectedProperty?: string;
  expectedLabel?: any;
};

type TestContext = {
  label?: string;
  beforeEach?: Function[];
};

let contexts: TestContext[] = [];
let globalMatcher: TestMatcher = {};

export function describe(label: string, fn: () => void | Promise<void>) {
  if (!label.startsWith("Test")) {
    throw new Error('Test labels should start with "Test"');
  }
  window.rgthree_tests[label] = async (matcher?: string | TestMatcher) => {
    if (typeof matcher === "string") {
      matcher = {shouldLabel: matcher};
    }
    globalMatcher = matcher ?? {};
    await describeRun(label, fn);
    globalMatcher = {};
  };
  return window.rgthree_tests[label];
}

export async function describeRun(label: string, fn: Function) {
  await wait();
  contexts.push({label});
  console.group(`[Start] ${contexts[contexts.length - 1]!.label}`);
  await fn();
  contexts.pop();
  console.groupEnd();
}

export async function should(declaration: string, fn: Function) {
  if (!contexts[contexts.length - 1]) {
    throw Error("Called should outside of a describe.");
  }
  if (globalMatcher?.shouldLabel && !declaration.includes(globalMatcher.shouldLabel)) {
    return;
  }
  console.group(`...should ${declaration}`);
  try {
    for (const context of contexts) {
      for (const beforeEachFn of context?.beforeEach || []) {
        await beforeEachFn();
      }
    }
    await fn();
  } catch (e: any) {
    fail(e);
  }
  console.groupEnd();
}

export async function beforeEach(fn: Function) {
  if (!contexts[contexts.length - 1]) {
    throw Error("Called beforeEach outside of a describe.");
  }
  const last = contexts[contexts.length - 1]!;
  last.beforeEach = last?.beforeEach || [];
  last.beforeEach.push(fn);
}

export function fail(e: Error) {
  log(`X Failure: ${e}`, "color:#600; background:#fdd; padding: 2px 6px;");
}

function log(msg: string, styles: string) {
  if (styles) {
    console.log(`%c ${msg}`, styles);
  } else {
    console.log(msg);
  }
}

class Expectation {
  private propertyLabel: string | null = "";
  private expectedLabel: string | null = "";
  private verbLabel: string | null = "be";
  private expectedFn!: (v: any) => boolean;
  private value: any;

  constructor(value: any) {
    this.value = value;
  }

  toBe(labelOrExpected: any, maybeExpected?: any) {
    const expected = maybeExpected !== undefined ? maybeExpected : labelOrExpected;
    this.propertyLabel = maybeExpected !== undefined ? labelOrExpected : null;
    this.expectedLabel = JSON.stringify(expected);
    this.expectedFn = (v) => v == expected;
    return this.toBeEval();
  }
  toMatchJson(labelOrExpected: any, maybeExpected?: any) {
    const expected = maybeExpected !== undefined ? maybeExpected : labelOrExpected;
    this.propertyLabel = maybeExpected !== undefined ? labelOrExpected : null;
    this.expectedLabel = JSON.stringify(expected);
    this.expectedFn = (v) => JSON.stringify(JSON.parse(v)) == JSON.stringify(JSON.parse(expected));
    return this.toBeEval();
  }
  toBeUndefined(propertyLabel: string) {
    this.expectedFn = (v) => v === undefined;
    this.propertyLabel = propertyLabel || "";
    this.expectedLabel = "undefined";
    return this.toBeEval(true);
  }
  toBeNullOrUndefined(propertyLabel: string) {
    this.expectedFn = (v) => v == null;
    this.propertyLabel = propertyLabel || "";
    this.expectedLabel = "null or undefined";
    return this.toBeEval(true);
  }
  toBeTruthy(propertyLabel: string) {
    this.expectedFn = (v) => !v;
    this.propertyLabel = propertyLabel || "";
    this.expectedLabel = "truthy";
    return this.toBeEval(false);
  }
  toBeANumber(propertyLabel: string) {
    this.expectedFn = (v) => typeof v === "number";
    this.propertyLabel = propertyLabel || "";
    this.expectedLabel = "a number";
    return this.toBeEval();
  }
  toContain(labelOrExpected: any, maybeExpected?: any) {
    const expected = maybeExpected !== undefined ? maybeExpected : labelOrExpected;
    this.propertyLabel = maybeExpected !== undefined ? labelOrExpected : null;
    this.verbLabel = "contain";
    this.expectedLabel = JSON.stringify(expected);
    this.expectedFn = (v) => v.includes(expected);
    return this.toBeEval();
  }
  toMatch(labelOrExpected: string | RegExp, maybeExpected?: RegExp) {
    let expected: RegExp | null = null;
    if (maybeExpected instanceof RegExp) {
      expected = maybeExpected;
      this.propertyLabel = labelOrExpected as string;
    } else if (labelOrExpected instanceof RegExp) {
      expected = labelOrExpected;
      this.propertyLabel = null;
    }
    if (!expected) throw new Error("No RegExp passed to toMatch");
    this.verbLabel = "match";
    this.expectedLabel = expected.toString();
    this.expectedFn = (v) => !!v.match(expected);
    return this.toBeEval();
  }
  toBeEval(strict = false) {
    if (
      (globalMatcher.expectedProperty !== undefined &&
        this.propertyLabel?.includes(globalMatcher.expectedProperty) &&
        (globalMatcher.expectedLabel === undefined ||
          globalMatcher.expectedLabel === this.expectedLabel)) ||
      (globalMatcher.expectedProperty === undefined &&
        globalMatcher.expectedLabel !== undefined &&
        globalMatcher.expectedLabel === this.expectedLabel)
    ) {
      return null;
    }
    let evaluation = this.expectedFn(this.value);
    let msg = `Expected ${this.propertyLabel ? this.propertyLabel + ` to ${this.verbLabel} ` : ""}${
      this.expectedLabel
    }`;
    msg += evaluation ? "." : `, but was ${JSON.stringify(this.value)}`;
    this.log(evaluation, msg);
    return evaluation;
  }
  async log(value: boolean, msg: string) {
    if (value) {
      log(`🗸 ${msg}`, "color:#060; background:#cec; padding: 2px 6px;");
    } else {
      log(`X ${msg}`, "color:#600; background:#fdd; padding: 2px 6px;");
      throw new Error(msg);
    }
  }
}

export function expect(value: any, msg?: string) {
  const expectation = new Expectation(value);
  if (msg) {
    expectation.log(value, msg);
  }
  return expectation;
}
