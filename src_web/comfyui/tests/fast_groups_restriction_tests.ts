import {app} from "scripts/app.js";
import {NodeTypesString} from "../constants.js";
import {describe, expect, should} from "../testing/runner.js";

describe("TestFastGroupsRestrictions", async () => {
  for (const {nodeType, modeOff} of [
    {nodeType: NodeTypesString.FAST_GROUPS_MUTER, modeOff: 2},
    {nodeType: NodeTypesString.FAST_GROUPS_BYPASSER, modeOff: 4},
  ]) {
    for (const {restriction, afterEnable, afterDisable} of [
      {restriction: "default", afterEnable: [true, true], afterDisable: [true, false]},
      {restriction: "max one", afterEnable: [false, true], afterDisable: [false, false]},
      {restriction: "always one", afterEnable: [false, true], afterDisable: [false, true]},
    ]) {
      await should(`${nodeType} enforce ${restriction} after widget adoption`, async () => {
        app.graph.clear();
        const controller = LiteGraph.createNode(nodeType);
        if (
          !controller ||
          !("refreshWidgets" in controller) ||
          typeof controller.refreshWidgets !== "function"
        ) {
          throw new Error(`${nodeType} is not registered`);
        }
        controller.properties.toggleRestriction = restriction;

        const nodes = [0, 500].map((x, index) => {
          const node = new LGraphNode(`Member ${index}`);
          app.graph.add(node);
          node.pos = [x + 50, 100];
          node.mode = modeOff;
          const group = new LGraphGroup(`Group ${index}`);
          app.graph.add(group);
          group.pos = [x, 0];
          group.size = [400, 300];
          return node;
        });

        try {
          app.graph.add(controller);
          controller.pos = [0, 400];
          await new Promise(requestAnimationFrame);
          controller.refreshWidgets();
          expect(controller.widgets.length).toBe("group toggle count", 2);
          const [first, second] = controller.widgets;
          if (
            !first ||
            !second ||
            !("toggle" in first) ||
            typeof first.toggle !== "function" ||
            !("toggle" in second) ||
            typeof second.toggle !== "function"
          ) {
            throw new Error("Group toggle widgets were not created");
          }
          first.toggle();
          second.toggle();
          expect(JSON.stringify(nodes.map((node) => node.mode))).toBe(
            "modes after enabling two groups",
            JSON.stringify(afterEnable.map((active) => (active ? 0 : modeOff))),
          );
          second.toggle();
          expect(JSON.stringify(nodes.map((node) => node.mode))).toBe(
            "modes after toggling the second group off",
            JSON.stringify(afterDisable.map((active) => (active ? 0 : modeOff))),
          );
        } finally {
          app.graph.clear();
        }
      });
    }
  }
});
