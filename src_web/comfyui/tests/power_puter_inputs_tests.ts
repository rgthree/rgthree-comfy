import {app} from "scripts/app.js";
import {NodeTypesString} from "../constants.js";
import {beforeEach, describe, expect, should} from "../testing/runner.js";

describe("TestPowerPuterInputs", async () => {
  let source: NonNullable<ReturnType<typeof LiteGraph.createNode>>;
  let puter: NonNullable<ReturnType<typeof LiteGraph.createNode>>;

  function stabilize(node = puter) {
    if (!("stabilize" in node) || typeof node.stabilize !== "function") {
      throw new Error("Power Puter is not registered");
    }
    node.stabilize();
  }

  function connectInputs(count: number) {
    for (let i = 0; i < count; i++) {
      source.connect(0, puter, i);
      stabilize();
    }
  }

  function inputNames(node = puter) {
    return node.inputs.map((input: {name: string}) => input.name).join("");
  }

  await beforeEach(async () => {
    app.graph.clear();
    source = LiteGraph.createNode(NodeTypesString.POWER_PRIMITIVE)!;
    puter = LiteGraph.createNode(NodeTypesString.POWER_PUTER)!;
    app.graph.add(source);
    app.graph.add(puter);
  });

  try {
    await should("keep existing inputs and one spare slot", async () => {
      expect(inputNames()).toBe("initial inputs", "ab");
      connectInputs(3);
      expect(inputNames()).toBe("inputs after connecting c", "abcd");
      puter.disconnectInput(2);
      stabilize();
      expect(inputNames()).toBe("inputs after disconnecting c", "abc");
      expect(puter.inputs.slice(0, 2).every((input: {link: unknown}) => input.link != null)).toBe(
        true,
      );
    });

    await should("connect w through z without adding an unnamed 27th input", async () => {
      connectInputs(26);
      expect(inputNames()).toBe("all input names", "abcdefghijklmnopqrstuvwxyz");
      expect(puter.inputs.length).toBe("input count at the limit", 26);
      expect(puter.inputs.every((input: {link: unknown}) => input.link != null)).toBe(true);
      stabilize();
      stabilize();
      expect(puter.inputs.length).toBe("input count after repeated stabilization", 26);
    });

    await should(
      "restore trailing inputs after disconnecting and reconnecting y and z",
      async () => {
        connectInputs(26);
        puter.disconnectInput(25);
        puter.disconnectInput(24);
        stabilize();
        expect(inputNames()).toBe("one spare input after x", "abcdefghijklmnopqrstuvwxy");
        source.connect(0, puter, 24);
        stabilize();
        source.connect(0, puter, 25);
        stabilize();
        expect(inputNames()).toBe("reconnected input names", "abcdefghijklmnopqrstuvwxyz");
        expect(puter.inputs.length).toBe("reconnected input count", 26);
        expect(puter.inputs.every((input: {link: unknown}) => input.link != null)).toBe(true);
      },
    );

    await should("preserve all 26 input names and links through a saved workflow", async () => {
      connectInputs(26);
      const id = puter.id;
      const sourceId = source.id;
      const workflow = JSON.parse(JSON.stringify(app.graph.serialize()));
      await app.loadGraphData(workflow);
      puter = app.graph.getNodeById(id)!;
      stabilize();
      expect(inputNames()).toBe("restored input names", "abcdefghijklmnopqrstuvwxyz");
      expect(puter.inputs.length).toBe("restored input count", 26);
      for (let i = 0; i < 26; i++) {
        const link = puter.getInputLink(i);
        expect(link?.origin_id).toBe(`input ${i} source`, sourceId);
        expect(link?.origin_slot).toBe(`input ${i} source slot`, 0);
        expect(link?.target_slot).toBe(`input ${i} target slot`, i);
      }
    });
  } finally {
    app.graph.clear();
  }
});
