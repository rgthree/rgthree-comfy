import type {LGraphNode} from "@comfyorg/frontend";

import {NodeTypesString} from "../constants";
import {ComfyUITestEnvironment} from "../testing/comfyui_env";
import {describe, should, beforeEach, expect, describeRun} from "../testing/runner.js";
import {pasteImageToLoadImageNode, PNG_1x1, PNG_1x2, PNG_2x1} from "../testing/utils_test.js";

const env = new ComfyUITestEnvironment();

function setPowerPuterValue(node: LGraphNode, outputType: string, value: string) {
  // Strip as much whitespace on first non-empty line from all lines.
  if (value.includes("\n")) {
    value = value.replace(/^\n/gm, "");
    const strip = value.match(/^(.*?)\S/)?.[1]?.length;
    if (strip) {
      value = value.replace(new RegExp(`^.{${strip}}`, "mg"), "");
    }
  }
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
    const checks: Array<[string, string, string]> = [
      ["1", "1", "STRING"],
      ['"abc"', "abc", "STRING"],
      ["1 + 2", "3", "STRING"],
      ['"abc" + "xyz"', "abcxyz", "STRING"],
      // INT
      ["1", "1", "INT"],
      ["1 + 2", "3", "INT"],
      // FLOAT
      ["1", "1.0", "FLOAT"],
      ["1.3 + 2.8", "4.1", "FLOAT"],
      // BOOLEAN
      ["1", "True", "BOOLEAN"],
      ["1 - 1", "False", "BOOLEAN"],
    ];
    for (const data of checks) {
      setPowerPuterValue(powerPuter, data[2], data[0]);
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

  await should("handle a for loop", async () => {
    setPowerPuterValue(
      powerPuter,
      "STRING",
      `
        a = 0
        b = ''
        for n in range(4):
          a += n
          for m in range(2):
            b += f'{str(n)}-{str(m)}.'
        f'a:{a} b:{b}'
      `,
    );
    await env.queuePrompt();
    expect(displayAny.widgets![0]!.value).toBe("a:6 b:0-0.0-1.1-0.1-1.2-0.2-1.3-0.3-1.");
  });

  await should("handle assigning with a subscript slice", async () => {
    setPowerPuterValue(
      powerPuter,
      "STRING",
      `
        a = [1,2,0]
        a[a[2]] = 3
        tuple(a)
      `,
    );
    await env.queuePrompt();
    expect(displayAny.widgets![0]!.value).toBe("(3, 2, 0)");
  });

  await should("handle aug assigning with a subscript slice", async () => {
    setPowerPuterValue(
      powerPuter,
      "STRING",
      `
        a = [1,2,0]
        a[a[2]] += 3
        tuple(a)
      `,
    );
    await env.queuePrompt();
    expect(displayAny.widgets![0]!.value).toBe("(4, 2, 0)");
  });

  await should("disallow calls to some methods", async () => {
    const imageNode = await pasteImageToLoadImageNode(env);
    imageNode.connect(0, powerPuter, 0);
    setPowerPuterValue(
      powerPuter,
      "STRING",
      `a.numpy().tofile('/tmp/test')
      `,
    );
    await env.queuePrompt();

    // Check to see if there's an error.
    expect(document.querySelector(".p-dialog-mask .p-card-body")!.textContent).toContain(
      "error message",
      "Disallowed access to \"tofile\" for type <class 'numpy.ndarray'>",
    );
    (document.querySelector(".p-dialog-mask .p-dialog-close-button")! as HTMLButtonElement).click();
  });

  await should("handle boolean operators correctly", async () => {
    const checks: Array<[string, string, string, ('toMatchJson'|'toBe')?]> = [
      // And operator all success
      ["1 and 42", "42", "STRING"],
      ["True and [42]", "[42]", "STRING", "toMatchJson"],
      ["a = 42\nTrue and [a]", "[42]", "STRING", "toMatchJson"],
      ["1 and 3 and True and [1] and 42", "42", "STRING"],
      // And operator w/ a failure
      ["1 and 3 and True and [] and 42", "[]", "STRING", "toMatchJson"],
      ["1 and 0 and True and [] and 42", "0", "STRING"],
      ["1 and 2 and False and [] and 42", "False", "STRING"],
      ["b = None\n1 and 2 and True and b and 42", "None", "STRING"],
      // Or operator
      ["1 or 42", "1", "STRING"],
      ["0 or 42", "42", "STRING"],
      ["0 or None or False or [] or 42", "42", "STRING"],
      ["b=42\n0 or None or False or [] or b", "42", "STRING"],
      ["b=42\n0 or None or False or [b] or b", "[42]", "STRING", "toMatchJson"],
      ["b=42\n0 or None or True or [b] or b", "True", "STRING"],
      // Mix
      ["1 and 2 and 0 or 5", "5", "STRING"],
      ["None and 1 or True", "True", "STRING"],
      ["0 or False and True", "False", "STRING"],

    ];
    for (const data of checks) {
      setPowerPuterValue(powerPuter, data[2], data[0]);
      await env.queuePrompt();
      expect(displayAny.widgets![0]!.value)[data[3] || 'toBe'](data[0], data[1]);
    }
  });
});
