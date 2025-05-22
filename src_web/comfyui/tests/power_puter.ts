import type {LGraphNode} from "@comfyorg/litegraph";

import {NodeTypesString} from "../constants";
import {ComfyUITestEnvironment} from "../testing/comfyui_env";
import {describe, should, beforeEach, expect, describeRun} from "../testing/runner.js";

const env = new ComfyUITestEnvironment();

function setPowerPuterValue(node: LGraphNode, value: string, outputType: string = "STRING") {
  node.widgets![1]!.value = value;
  node.widgets![0]!.value = outputType;
}

describe("TestPowerPuter", async () => {
  let powerPuter!: LGraphNode;
  let displayAny!: LGraphNode;

  await beforeEach(async () => {
    await env.clear();
    powerPuter = await env.addNode(NodeTypesString.POWER_PUTER);
    displayAny = await env.addNode(NodeTypesString.DISPLAY_ANY);
    powerPuter.connect(0, displayAny, 0);
    await env.wait();
  });

  await should("output constants and concatenation", async () => {
    const checks: Array<[string, string] | [string, string, string]> = [
      ["1", "1"],
      ['"abc"', "abc"],
      ["1 + 2", "3"],
      ['"abc" + "xyz"', "abcxyz"],
      // INT
      ["1", "1", "INT"],
      ["1 + 2", "3", "INT"],
      // FLOAT
      ["1", "1.0", "FLOAT"],
      ["1.3 + 2.8", "4.1", "FLOAT"],
      // BOOL
      ["1", "True", "BOOL"],
      ["1 - 1", "False", "BOOL"],
    ];
    for (const data of checks) {
      setPowerPuterValue(powerPuter, data[0], data[2]);
      await env.queuePrompt();
      expect(displayAny.widgets![0]!.value).toBe(data[0], data[1]);
    }
  });

  await should("handle inputs", async () => {
    // TODO
  });

  await should("handle complex inputs", async () => {
    // TODO
  });
});
