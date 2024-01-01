// @ts-ignore
import { app } from "/scripts/app.js";
// @ts-ignore
import { api } from "/scripts/api.js";
import { RgthreeBaseServerNode } from "./base_node.js";
import { NodeTypesString } from "./constants.js";
import { ComfyNodeConstructor, ComfyObjectInfo } from "comfy.js";
import { ContextMenuItem, IWidget, LGraphCanvas, LGraphNode, SerializedLGraphNode, Vector2 } from "./typings/litegraph.js";
import { addConnectionLayoutSupport } from "./utils.js";

/**
 * Compares two images in one canvas node.
 */
export class RgthreeImageComparer extends RgthreeBaseServerNode {
  static override title = NodeTypesString.IMAGE_COMPARER;
  static override type = NodeTypesString.IMAGE_COMPARER;
  static comfyClass = NodeTypesString.IMAGE_COMPARER;

  // These is what the core preview image node uses to show the context menu. May not be that helpful
  // since it likely will always be "0" when a context menu is invoked without manually changing
  // something.
  imageIndex: number = 0;
  imgs: InstanceType<typeof Image>[] = [];

  override serialize_widgets = true;

  protected isPointerDown = false;
  protected isPointerOver = false;
  protected pointerOverPos: Vector2 = [0,0];

  private canvasWidget: IWidget|null = null;

  static "@comparer_mode" = {
    type: "combo",
    values: ["Slide", "Click"],
  };

  constructor(title = RgthreeImageComparer.title) {
    super(title);
    this.properties['comparer_mode'] = 'Slide';
  }

  override onExecuted(output: any) {
    super.onExecuted?.(output);
    // this.imgs = [];
    // for (const imgData of output.images || []) {
    //   let img = new Image();
    //   img.src = api.apiURL(
    //     `/view?filename=${encodeURIComponent(imgData.filename)}&type=${imgData.type}&subfolder=${
    //       imgData.subfolder
    //     }${app.getPreviewFormatParam()}${app.getRandParam()}`,
    //   );
    //   this.imgs.push(img);
    // }
    this.canvasWidget!.value = (output.images || []).map((d: any) => api.apiURL(
      `/view?filename=${encodeURIComponent(d.filename)}&type=${d.type}&subfolder=${
        d.subfolder
      }${app.getPreviewFormatParam()}${app.getRandParam()}`,
    ));
  }

  // override configure(info: SerializedLGraphNode<LGraphNode>): void {
  //   console.log('configure', info)
  //   super.configure?.(info);
  // }

  private drawWidgetImage(ctx: CanvasRenderingContext2D, image: InstanceType<typeof Image>|undefined, y: number, cropX?: number) {
    if (!image?.naturalWidth || !image?.naturalHeight) {
      return;
    }
    let [nodeWidth, nodeHeight] = this.size;
    const imageAspect = image.naturalWidth / image.naturalHeight;
    let height = nodeHeight - y;
    const widgetAspect = nodeWidth / height;
    let targetWidth, targetHeight;
    let offsetX = 0;
    if (imageAspect > widgetAspect) {
      targetWidth = nodeWidth;
      targetHeight = nodeWidth / imageAspect;
    } else {
      targetHeight = height;
      targetWidth = height * imageAspect;
      offsetX = (nodeWidth - targetWidth) / 2;
    }
    const widthMultiplier = image.naturalWidth / targetWidth;

    const sourceX = 0;
    const sourceY = 0;
    const sourceWidth = cropX != null ? (cropX - offsetX) * widthMultiplier : image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    const destX = (nodeWidth - targetWidth) / 2;
    const destY = y + (height - targetHeight) / 2;
    const destWidth = cropX != null ? (cropX - offsetX) : targetWidth;
    const destHeight = targetHeight;
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      destX,
      destY,
      destWidth,
      destHeight);
    if (cropX != null
        && cropX >= (nodeWidth - targetWidth) / 2
        && cropX <= targetWidth + offsetX) {
      let globalCompositeOperation = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = "difference";
      ctx.moveTo(cropX, destY);
      ctx.lineTo(cropX, destY + destHeight)
      ctx.strokeStyle = 'rgba(255,255,255, 1)';
      ctx.stroke();
      ctx.globalCompositeOperation = globalCompositeOperation;
    }
  }

  override onNodeCreated() {
    const node = this;
    const widget: any = {
      type: "RGTHREE_CANVAS_COMPARER" as any,
      name: "CANVAS_COMPARER",
      options: { serialize: false },
      _value: [],
      set value(v) {
        this._value = v;
        node.imgs = [];
        if (v && v.length) {
          for (let i = 0; i < 2; i++) {
            let img = new Image();
            img.src = v[i];
            node.imgs.push(img);
          }
        }
      },
      get value() {
        return this._value;
      },
      draw(ctx: CanvasRenderingContext2D, node: RgthreeImageComparer, width: number, y: number) {
        let [nodeWidth, nodeHeight] = node.size;
        if (node.properties?.['comparer_mode'] === 'Click') {
          const image = node.isPointerDown ? node.imgs[1] : node.imgs[0];
          node.drawWidgetImage(ctx, image, y);
        } else {
          node.drawWidgetImage(ctx, node.imgs[0], y);
          if (node.isPointerOver) {
            node.drawWidgetImage(ctx, node.imgs[1], y, node.pointerOverPos[0]);
          }
        }
      },
      computeSize(...args: any[]) {
        return [128, 128];
      },
      // serializeValue(serializedNode: any, widgetIndex: any) {
      //   const value = node.imgs.map(i => i.src)
      //   this.value = value;
      //   return value;
      // }
    };

    this.canvasWidget = this.addCustomWidget(widget as any);
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
    this.imageIndex = this.isPointerDown ? 1 : 0;
    if (this.isPointerDown) {
      requestAnimationFrame(() => {
        this.setIsPointerDown();
      });
    }
  }

  override onMouseDown(event: MouseEvent, pos: Vector2, graphCanvas: LGraphCanvas): void {
    super.onMouseDown?.(event, pos, graphCanvas);
    this.setIsPointerDown(true);
  }

  override onMouseEnter(event: MouseEvent, pos: Vector2, graphCanvas: LGraphCanvas): void {
    super.onMouseEnter?.(event, pos, graphCanvas);
    this.setIsPointerDown(!!app.canvas.pointer_is_down);
    this.isPointerOver = true;
  }

  override onMouseLeave(event: MouseEvent, pos: Vector2, graphCanvas: LGraphCanvas): void {
    super.onMouseLeave?.(event, pos, graphCanvas);
    this.setIsPointerDown(false);
    this.isPointerOver = false;
  }

  override onMouseMove(event: MouseEvent, pos: Vector2, graphCanvas: LGraphCanvas): void {
    super.onMouseMove?.(event, pos, graphCanvas);
    this.pointerOverPos = [...pos];
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

  override getExtraMenuOptions(canvas: LGraphCanvas, options: ContextMenuItem[]): void {
    PreviewImageNodeForHacking?.prototype?.getExtraMenuOptions?.apply(this, [canvas, options]);
  }

}

// Set a reference to the native PreviewImage node so we can use its `getExtraMenuOptions` method
// off its prototype (ComfyUI doesn't expose the method to set it up, so we can't hook in natively).
// This may not be super beneficial, since it's likely that it will always be options for the first
// image, but, that's ok.
let PreviewImageNodeForHacking: any;

app.registerExtension({
  name: "rgthree.ImageComparer",
  async beforeRegisterNodeDef(nodeType: ComfyNodeConstructor, nodeData: ComfyObjectInfo) {
    if (nodeData.name === RgthreeImageComparer.type) {
      RgthreeImageComparer.nodeType = nodeType;
      RgthreeImageComparer.nodeData = nodeData;
      RgthreeImageComparer.setUp(nodeType as any);
    }
    if (nodeData.name === 'PreviewImage') {
      PreviewImageNodeForHacking = nodeType;
    }
  },
});
