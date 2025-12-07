import type {LGraphNode} from "@comfyorg/frontend";

import {NodeTypesString} from "../constants";
import {ComfyUITestEnvironment} from "../testing/comfyui_env";
import {describe, should, beforeEach, expect, describeRun} from "../testing/runner.js";
import {pasteImageToLoadImageNode, PNG_1x1, PNG_1x2, PNG_2x1} from "../testing/utils_test.js";

const env = new ComfyUITestEnvironment();

describe("TestImageOrLatentSize", async () => {
  await beforeEach(async () => {
    await env.clear();
  });

  await describeRun("LoadImage", async () => {
    let imageNode: LGraphNode;
    let displayAnyW: LGraphNode;
    let displayAnyH: LGraphNode;

    await beforeEach(async () => {
      await env.clear();
      imageNode = await env.addNode("LoadImage");
      const sizeNode = await env.addNode(NodeTypesString.IMAGE_OR_LATENT_SIZE);
      displayAnyW = await env.addNode(NodeTypesString.DISPLAY_ANY);
      displayAnyH = await env.addNode(NodeTypesString.DISPLAY_ANY);
      imageNode.connect(0, sizeNode, 0);
      sizeNode.connect(0, displayAnyW, 0);
      sizeNode.connect(1, displayAnyH, 0);
      await env.wait();
    });

    await should("get correct size for a 1x1 image", async () => {
      await pasteImageToLoadImageNode(env, PNG_1x1, imageNode);
      await env.queuePrompt();
      expect(displayAnyW.widgets![0]!.value).toBe("width", 1);
      expect(displayAnyH.widgets![0]!.value).toBe("height", 1);
    });

    await should("get correct size for a 1x2 image", async () => {
      await pasteImageToLoadImageNode(env, PNG_1x2, imageNode);
      await env.queuePrompt();
      expect(displayAnyW.widgets![0]!.value).toBe("width", 1);
      expect(displayAnyH.widgets![0]!.value).toBe("height", 2);
    });

    await should("get correct size for a 2x1 image", async () => {
      await pasteImageToLoadImageNode(env, PNG_2x1, imageNode);
      await env.queuePrompt();
      expect(displayAnyW.widgets![0]!.value).toBe("width", 2);
      expect(displayAnyH.widgets![0]!.value).toBe("height", 1);
    });
  });

  await describeRun("Latent", async () => {
    let latentNode: LGraphNode;
    let displayAnyW: LGraphNode;
    let displayAnyH: LGraphNode;

    await beforeEach(async () => {
      await env.clear();
      latentNode = await env.addNode("EmptyLatentImage");
      const sizeNode = await env.addNode(NodeTypesString.IMAGE_OR_LATENT_SIZE);
      displayAnyW = await env.addNode(NodeTypesString.DISPLAY_ANY);
      displayAnyH = await env.addNode(NodeTypesString.DISPLAY_ANY);
      latentNode.connect(0, sizeNode, 0);
      sizeNode.connect(0, displayAnyW, 0);
      sizeNode.connect(1, displayAnyH, 0);
      await env.wait();
      latentNode.widgets![0]!.value = 16; // Width
      latentNode.widgets![1]!.value = 16; // Height
      latentNode.widgets![2]!.value = 1; // Batch
      await env.wait();
    });

    await should("get correct size for a 16x16 latent", async () => {
      await env.queuePrompt();
      expect(displayAnyW.widgets![0]!.value).toBe("width", 16);
      expect(displayAnyH.widgets![0]!.value).toBe("height", 16);
    });

    await should("get correct size for a 16x32 latent", async () => {
      latentNode.widgets![1]!.value = 32;
      await env.queuePrompt();
      expect(displayAnyW.widgets![0]!.value).toBe("width", 16);
      expect(displayAnyH.widgets![0]!.value).toBe("height", 32);
    });

    await should("get correct size for a 32x16 image", async () => {
      latentNode.widgets![0]!.value = 32;
      await env.queuePrompt();
      expect(displayAnyW.widgets![0]!.value).toBe("width", 32);
      expect(displayAnyH.widgets![0]!.value).toBe("height", 16);
    });

    await should("get correct size with a batch", async () => {
      latentNode.widgets![0]!.value = 32;
      latentNode.widgets![2]!.value = 2;
      await env.queuePrompt();
      expect(displayAnyW.widgets![0]!.value).toBe("width", 32);
      expect(displayAnyH.widgets![0]!.value).toBe("height", 16);
    });
  });
});
