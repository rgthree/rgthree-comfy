import type {LGraphNode} from "@comfyorg/frontend";
import type {ComfyUITestEnvironment} from "./comfyui_env";

export const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4v5ThPwAG7wKklwQ/bwAAAABJRU5ErkJggg==";
export const PNG_1x2 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEElEQVQIW2NgYGD4D8QM/wEHAwH/OMSHKAAAAABJRU5ErkJggg==";
export const PNG_2x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVQIW2NkYGD4D8QMAAUNAQFqjhCLAAAAAElFTkSuQmCC";

export async function pasteImageToLoadImageNode(
  env: ComfyUITestEnvironment,
  dataUrl?: string,
  node?: LGraphNode,
) : Promise<LGraphNode> {
  const dataArr = (dataUrl ?? PNG_1x1).split(",");
  const mime = dataArr[0]!.match(/:(.*?);/)![1];
  const bstr = atob(dataArr[1]!);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  const filename = `test_image_${+new Date()}.png`;
  const file = new File([u8arr], filename, {type: mime});
  if (!node) {
    node = await env.addNode("LoadImage");
  }
  await (node as any).pasteFiles([file]);
  let i = 0;
  let good = false;
  while (i++ < 10 || good) {
    good = node.widgets![0]!.value === filename;
    if (good) break;
    await env.wait(100);
  }
  if (!good) {
    throw new Error("Expected file not loaded.");
  }
  return node;
}
