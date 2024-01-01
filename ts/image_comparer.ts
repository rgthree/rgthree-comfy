// @ts-ignore
import { app } from "/scripts/app.js";
// @ts-ignore
import { api } from "/scripts/api.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
import { ComfyNodeConstructor, ComfyObjectInfo } from "comfy.js";
import { IWidget, LGraphCanvas, LGraphNode, Vector2 } from "./typings/litegraph.js";
import { addConnectionLayoutSupport } from "./utils.js";

/**
 * Compares two images in one canvas node.
 */
export class RgthreeImageComparer extends RgthreeBaseServerNode {
  static override title = NodeTypesString.IMAGE_COMPARER;
  static override type = NodeTypesString.IMAGE_COMPARER;
  static comfyClass = NodeTypesString.IMAGE_COMPARER;

  imgs: { filename: string; subfolder: string; type: string }[] = [];
  images: InstanceType<typeof Image>[] = [];

  protected isPointerDown = false;

  constructor(title = RgthreeImageComparer.title) {
    super(title);
  }

  override onExecuted(output: any) {
    super.onExecuted?.(output);
    this.imgs = output.images || [];
    this.images = [];
    for (const imgData of this.imgs) {
      let img = new Image();
      img.src = api.apiURL(
        `/view?filename=${encodeURIComponent(imgData.filename)}&type=${imgData.type}&subfolder=${
          imgData.subfolder
        }${app.getPreviewFormatParam()}${app.getRandParam()}`,
      );
      this.images.push(img);
    }
  }

  override onNodeCreated() {
    const widget: IWidget = {
      type: "RGTHREE_CANVAS_COMPARER" as any,
      name: "CANVAS_COMPARER",
      options: { serialize: false },
      value: null,
      draw(ctx: CanvasRenderingContext2D, node: RgthreeImageComparer, width: number, y: number) {
        let [nodeWidth, nodeHeight] = node.size;
        const image = node.isPointerDown ? node.images[1] : node.images[0];
        if (!image?.naturalWidth || !image?.naturalHeight) {
          return;
        }
        const imageAspect = image.width / image.height;
        let height = nodeHeight - y;
        const widgetAspect = width / height;
        let targetWidth, targetHeight;
        if (imageAspect > widgetAspect) {
          targetWidth = width;
          targetHeight = width / imageAspect;
        } else {
          targetHeight = height;
          targetWidth = height * imageAspect;
        }
        ctx.drawImage(
          image,
          (width - targetWidth) / 2,
          y + (height - targetHeight) / 2,
          targetWidth,
          targetHeight,
        );
      },
      computeSize(...args: any[]) {
        return [128, 128];
      },
    };

    this.addCustomWidget(widget as any);
  }

  /**
   * Sets mouse as down or up based on param. If it's down, we also loop to check pointer is still
   * down. This is because LiteGraph doesn't fire `onMouseUp` every time there's a mouse up, so we
   * need to manually monitor `pointer_is_down` and, when it's no longer true, set mouse as up here.
   */
  private setIsPointerDown(down: boolean = this.isPointerDown) {
    const newIsDown = down && !!app.canvas.pointer_is_down;
    if (this.isPointerDown !== newIsDown) {
      this.isPointerDown = newIsDown;
      this.setDirtyCanvas(true, false);
    }
    if (this.isPointerDown) {
      requestAnimationFrame(() => {
        this.setIsPointerDown();
      });
    }
  }

  override onMouseDown(event: MouseEvent, pos: Vector2, graphCanvas: LGraphCanvas): void {
    super.onMouseDown?.(event, pos, graphCanvas);
    this.setIsPointerDown();
  }

  override onMouseEnter(event: MouseEvent, pos: Vector2, graphCanvas: LGraphCanvas): void {
    super.onMouseEnter?.(event, pos, graphCanvas);
    this.setIsPointerDown(!!app.canvas.pointer_is_down);
  }

  override onMouseLeave(event: MouseEvent, pos: Vector2, graphCanvas: LGraphCanvas): void {
    super.onMouseLeave?.(event, pos, graphCanvas);
    this.setIsPointerDown(false);
  }

  static override setUp(comfyClass: any) {
    RgthreeBaseServerNode.registerForOverride(comfyClass, RgthreeImageComparer);
    addConnectionLayoutSupport(RgthreeBaseServerNode, app, [
      ["Left", "Right"],
      ["Right", "Left"],
    ]);
    setTimeout(() => {
      RgthreeImageComparer.category = comfyClass.category;
    });
  }
}

app.registerExtension({
  name: "rgthree.ImageComparer",
  async beforeRegisterNodeDef(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    if (nodeData.name === RgthreeImageComparer.type) {
      console.log("beforeRegisterNodeDef", nodeType, nodeData);
      RgthreeImageComparer.nodeType = nodeType;
      RgthreeImageComparer.nodeData = nodeData;
      RgthreeImageComparer.setUp(nodeType as any);
    }
  },
});
