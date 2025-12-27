import {
  LGraphCanvas,
  LGraphNode,
  Vector2,
  LGraphNodeConstructor,
  CanvasMouseEvent,
  ISerialisedNode,
  Point,
  CanvasPointerEvent,
} from "@comfyorg/frontend";
import type {ComfyNodeDef} from "typings/comfy.js";

import {app} from "scripts/app.js";
import {api} from "scripts/api.js";
import {RgthreeBaseServerNode} from "./base_node.js";
import {NodeTypesString} from "./constants.js";
import {addConnectionLayoutSupport} from "./utils.js";
import {RgthreeBaseHitAreas, RgthreeBaseWidget, RgthreeBaseWidgetBounds} from "./utils_widgets.js";
import {measureText} from "./utils_canvas.js";

type ComfyImageServerData = {filename: string; type: string; subfolder: string};
type ComfyImageData = {name: string; selected: boolean; url: string; img?: HTMLImageElement};
type OldExecutedPayload = {
  images: ComfyImageServerData[];
};
type ExecutedPayload = {
  a_images?: ComfyImageServerData[];
  b_images?: ComfyImageServerData[];
};

function imageDataToUrl(data: ComfyImageServerData) {
  return api.apiURL(
    `/view?filename=${encodeURIComponent(data.filename)}&type=${data.type}&subfolder=${
      data.subfolder
    }${app.getPreviewFormatParam()}${app.getRandParam()}`,
  );
}

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
  override imageIndex: number = 0;
  override imgs: InstanceType<typeof Image>[] = [];

  override serialize_widgets = true;

  isPointerDown = false;
  isPointerOver = false;
  pointerOverPos: Vector2 = [0, 0];

  private canvasWidget: RgthreeImageComparerWidget | null = null;

  static "@comparer_mode" = {
    type: "combo",
    values: ["Slide", "Click"],
  };

  constructor(title = RgthreeImageComparer.title) {
    super(title);
    this.properties["comparer_mode"] = "Slide";
  }

  override onExecuted(output: ExecutedPayload | OldExecutedPayload) {
    super.onExecuted?.(output);
    if ("images" in output) {
      this.canvasWidget!.value = {
        images: (output.images || []).map((d, i) => {
          return {
            name: i === 0 ? "A" : "B",
            selected: true,
            url: imageDataToUrl(d),
          };
        }),
      };
    } else {
      output.a_images = output.a_images || [];
      output.b_images = output.b_images || [];
      const imagesToChoose: ComfyImageData[] = [];
      const multiple = output.a_images.length + output.b_images.length > 2;
      for (const [i, d] of output.a_images.entries()) {
        imagesToChoose.push({
          name: output.a_images.length > 1 || multiple ? `A${i + 1}` : "A",
          selected: i === 0,
          url: imageDataToUrl(d),
        });
      }
      for (const [i, d] of output.b_images.entries()) {
        imagesToChoose.push({
          name: output.b_images.length > 1 || multiple ? `B${i + 1}` : "B",
          selected: i === 0,
          url: imageDataToUrl(d),
        });
      }
      this.canvasWidget!.value = {images: imagesToChoose};
    }
  }

  override onSerialize(serialised: ISerialisedNode) {
    super.onSerialize && super.onSerialize(serialised);
    for (let [index, widget_value] of (serialised.widgets_values || []).entries()) {
      if (this.widgets[index]?.name === "rgthree_comparer") {
        serialised.widgets_values![index] = (
          this.widgets[index] as unknown as RgthreeImageComparerWidget
        ).value.images.map((d) => {
          d = {...d};
          delete d.img;
          return d;
        });
      }
    }
  }

  override onNodeCreated() {
    this.canvasWidget = this.addCustomWidget(
      new RgthreeImageComparerWidget("rgthree_comparer", this),
    ) as RgthreeImageComparerWidget;
    this.setSize(this.computeSize());
    this.setDirtyCanvas(true, true);
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

  override onMouseDown(event: CanvasPointerEvent, pos: Point, canvas: LGraphCanvas): boolean {
    super.onMouseDown?.(event, pos, canvas);
    this.setIsPointerDown(true);
    return false;
  }

  override onMouseEnter(event: CanvasPointerEvent): void {
    super.onMouseEnter?.(event);
    this.setIsPointerDown(!!app.canvas.pointer_is_down);
    this.isPointerOver = true;
  }

  override onMouseLeave(event: CanvasPointerEvent): void {
    super.onMouseLeave?.(event);
    this.setIsPointerDown(false);
    this.isPointerOver = false;
  }

  override onMouseMove(event: CanvasPointerEvent, pos: Point, canvas: LGraphCanvas): void {
    super.onMouseMove?.(event, pos, canvas);
    this.pointerOverPos = [...pos] as Point;
    this.imageIndex = this.pointerOverPos[0] > this.size[0] / 2 ? 1 : 0;
  }

  override getHelp(): string {
    return `
      <p>
        The ${this.type!.replace("(rgthree)", "")} node compares two images on top of each other.
      </p>
      <ul>
        <li>
          <p>
            <strong>Notes</strong>
          </p>
          <ul>
            <li><p>
              The right-click menu may show image options (Open Image, Save Image, etc.) which will
              correspond to the first image (image_a) if clicked on the left-half of the node, or
              the second image if on the right half of the node.
            </p></li>
          </ul>
        </li>
        <li>
          <p>
            <strong>Inputs</strong>
          </p>
          <ul>
            <li><p>
              <code>image_a</code> <i>Optional.</i> The first image to use to compare.
              image_a.
            </p></li>
            <li><p>
              <code>image_b</code> <i>Optional.</i> The second image to use to compare.
            </p></li>
            <li><p>
              <b>Note</b> <code>image_a</code> and <code>image_b</code> work best when a single
              image is provided. However, if each/either are a batch, you can choose which item
              from each batch are chosen to be compared. If either <code>image_a</code> or
              <code>image_b</code> are not provided, the node will choose the first two from the
              provided input if it's a batch, otherwise only show the single image (just as
              Preview Image would).
            </p></li>
          </ul>
        </li>
        <li>
          <p>
            <strong>Properties.</strong> You can change the following properties (by right-clicking
            on the node, and select "Properties" or "Properties Panel" from the menu):
          </p>
          <ul>
            <li><p>
              <code>comparer_mode</code> - Choose between "Slide" and "Click". Defaults to "Slide".
            </p></li>
          </ul>
        </li>
      </ul>`;
  }

  static override setUp(comfyClass: typeof LGraphNode, nodeData: ComfyNodeDef) {
    RgthreeBaseServerNode.registerForOverride(comfyClass, nodeData, RgthreeImageComparer);
  }

  static override onRegisteredForOverride(comfyClass: any) {
    addConnectionLayoutSupport(RgthreeImageComparer, app, [
      ["Left", "Right"],
      ["Right", "Left"],
    ]);
    setTimeout(() => {
      RgthreeImageComparer.category = comfyClass.category;
    });
  }
}

type RgthreeImageComparerWidgetValue = {
  images: ComfyImageData[];
};

class RgthreeImageComparerWidget extends RgthreeBaseWidget<RgthreeImageComparerWidgetValue> {
  override readonly type = "custom";

  private node: RgthreeImageComparer;

  protected override hitAreas: RgthreeBaseHitAreas<any> = {
    // We dynamically set this when/if we draw the labels.
  };

  private selected: [ComfyImageData?, ComfyImageData?] = [];

  // Store grouped A and B image lists.
  private aImages: ComfyImageData[] = [];
  private bImages: ComfyImageData[] = [];

  constructor(name: string, node: RgthreeImageComparer) {
    super(name);
    this.node = node;
  }

  private _value: RgthreeImageComparerWidgetValue = {images: []};

  set value(v: RgthreeImageComparerWidgetValue) {
    // Despite `v` typed as RgthreeImageComparerWidgetValue, we may have gotten an array of strings
    // from previous versions. We can handle that gracefully.
    let cleanedVal;
    if (Array.isArray(v)) {
      cleanedVal = v.map((d, i) => {
        if (!d || typeof d === "string") {
          // We usually only have two here, so they're selected.
          d = {url: d, name: i == 0 ? "A" : "B", selected: true};
        }
        return d;
      });
    } else {
      cleanedVal = v.images || [];
    }

    // If we have multiple items in our sent value but we don't have both an "A" and a "B" then
    // just simplify it down to the first two in the list.
    if (cleanedVal.length > 2) {
      const hasAAndB =
        cleanedVal.some((i) => i.name.startsWith("A")) &&
        cleanedVal.some((i) => i.name.startsWith("B"));
      if (!hasAAndB) {
        cleanedVal = [cleanedVal[0], cleanedVal[1]];
      }
    }

    let selected = cleanedVal.filter((d) => d.selected);
    // None are selected.
    if (!selected.length && cleanedVal.length) {
      cleanedVal[0]!.selected = true;
    }

    selected = cleanedVal.filter((d) => d.selected);
    if (selected.length === 1 && cleanedVal.length > 1) {
      cleanedVal.find((d) => !d.selected)!.selected = true;
    }

    this._value.images = cleanedVal;

    // Group A and B images.
    this.aImages = cleanedVal.filter((d) => d.name.startsWith("A"));
    this.bImages = cleanedVal.filter((d) => d.name.startsWith("B"));

    selected = cleanedVal.filter((d) => d.selected);
    this.setSelected(selected as [ComfyImageData, ComfyImageData]);
  }

  get value() {
    return this._value;
  }

  setSelected(selected: [ComfyImageData, ComfyImageData]) {
    this._value.images.forEach((d) => (d.selected = false));
    this.node.imgs.length = 0;
    for (const sel of selected) {
      if (!sel.img) {
        sel.img = new Image();
        sel.img.src = sel.url;
        this.node.imgs.push(sel.img);
      }
      sel.selected = true;
    }
    this.selected = selected;
  }

  draw(ctx: CanvasRenderingContext2D, node: RgthreeImageComparer, width: number, y: number) {
    this.hitAreas = {};
    // When more than 2 images, show dropdown selectors and navigation buttons.
    if (this.value.images.length > 2) {
      const dropdownHeight = 20;
      const btnWidth = 20;        // Single arrow button width.
      const groupBtnWidth = 24;   // Double arrow button width.
      const btnSpacing = 2;       // Spacing between buttons.
      const groupSpacing = 8;     // Spacing between A and B groups.
      const margin = 10;

      // Calculate dropdown width.
      // Layout: [◀◀] [◀] [A dropdown] [▶] | [◀] [B dropdown] [▶] [▶▶]
      const totalBtnWidth = groupBtnWidth * 2 + btnWidth * 4 + btnSpacing * 6 + groupSpacing;
      const availableWidth = width - margin * 2 - totalBtnWidth;
      const dropdownWidth = availableWidth / 2;

      let x = margin;

      // Draw previous group button (◀◀).
      this.drawArrowButton(ctx, x, y, groupBtnWidth, dropdownHeight, "prev_group");
      this.hitAreas["prev_group"] = {
        bounds: [x, y, groupBtnWidth, dropdownHeight],
        data: { action: "prev_group" },
        onDown: this.onNavButtonClick,
      };
      x += groupBtnWidth + btnSpacing;

      // Draw A previous button (◀).
      this.drawArrowButton(ctx, x, y, btnWidth, dropdownHeight, "prev");
      this.hitAreas["prev_a"] = {
        bounds: [x, y, btnWidth, dropdownHeight],
        data: { action: "prev", type: "A" },
        onDown: this.onNavButtonClick,
      };
      x += btnWidth + btnSpacing;

      // Draw A dropdown.
      const selectedA = this.selected[0];
      this.drawDropdown(ctx, x, y, dropdownWidth, dropdownHeight, "A", selectedA?.name || "A");
      this.hitAreas["dropdown_a"] = {
        bounds: [x, y, dropdownWidth, dropdownHeight],
        data: { type: "A", images: this.aImages },
        onDown: this.onDropdownClick,
      };
      x += dropdownWidth + btnSpacing;

      // Draw A next button (▶).
      this.drawArrowButton(ctx, x, y, btnWidth, dropdownHeight, "next");
      this.hitAreas["next_a"] = {
        bounds: [x, y, btnWidth, dropdownHeight],
        data: { action: "next", type: "A" },
        onDown: this.onNavButtonClick,
      };
      x += btnWidth + groupSpacing;

      // Draw B previous button (◀).
      this.drawArrowButton(ctx, x, y, btnWidth, dropdownHeight, "prev");
      this.hitAreas["prev_b"] = {
        bounds: [x, y, btnWidth, dropdownHeight],
        data: { action: "prev", type: "B" },
        onDown: this.onNavButtonClick,
      };
      x += btnWidth + btnSpacing;

      // Draw B dropdown.
      const selectedB = this.selected[1];
      this.drawDropdown(ctx, x, y, dropdownWidth, dropdownHeight, "B", selectedB?.name || "B");
      this.hitAreas["dropdown_b"] = {
        bounds: [x, y, dropdownWidth, dropdownHeight],
        data: { type: "B", images: this.bImages },
        onDown: this.onDropdownClick,
      };
      x += dropdownWidth + btnSpacing;

      // Draw B next button (▶).
      this.drawArrowButton(ctx, x, y, btnWidth, dropdownHeight, "next");
      this.hitAreas["next_b"] = {
        bounds: [x, y, btnWidth, dropdownHeight],
        data: { action: "next", type: "B" },
        onDown: this.onNavButtonClick,
      };
      x += btnWidth + btnSpacing;

      // Draw next group button (▶▶).
      this.drawArrowButton(ctx, x, y, groupBtnWidth, dropdownHeight, "next_group");
      this.hitAreas["next_group"] = {
        bounds: [x, y, groupBtnWidth, dropdownHeight],
        data: { action: "next_group" },
        onDown: this.onNavButtonClick,
      };

      y += dropdownHeight + 4;
    }

    if (node.properties?.["comparer_mode"] === "Click") {
      this.drawImage(ctx, this.selected[this.node.isPointerDown ? 1 : 0], y);
    } else {
      this.drawImage(ctx, this.selected[0], y);
      if (node.isPointerOver) {
        this.drawImage(ctx, this.selected[1], y, this.node.pointerOverPos[0]);
      }
    }
  }

  private onSelectionDown(
    event: CanvasMouseEvent,
    pos: Vector2,
    node: LGraphNode,
    bounds?: RgthreeBaseWidgetBounds,
  ) {
    const selected = [...this.selected];
    if (bounds?.data.name.startsWith("A")) {
      selected[0] = bounds.data;
    } else if (bounds?.data.name.startsWith("B")) {
      selected[1] = bounds.data;
    }
    this.setSelected(selected as [ComfyImageData, ComfyImageData]);
  }

  /**
   * Draws an arrow navigation button.
   * @param ctx Canvas rendering context.
   * @param x X coordinate.
   * @param y Y coordinate.
   * @param width Button width.
   * @param height Button height.
   * @param type Button type: prev, next, prev_group, next_group.
   */
  private drawArrowButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    type: "prev" | "next" | "prev_group" | "next_group",
  ) {
    ctx.save();
    // Draw button background.
    ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;
    ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, [4]);
    ctx.fill();
    ctx.stroke();

    // Draw arrow.
    ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const arrowSize = 5;

    if (type === "prev" || type === "prev_group") {
      // Left arrow ◀
      ctx.beginPath();
      ctx.moveTo(centerX + arrowSize / 2, centerY - arrowSize);
      ctx.lineTo(centerX - arrowSize / 2, centerY);
      ctx.lineTo(centerX + arrowSize / 2, centerY + arrowSize);
      ctx.closePath();
      ctx.fill();

      // Draw second arrow for double arrow button.
      if (type === "prev_group") {
        ctx.beginPath();
        ctx.moveTo(centerX + arrowSize / 2 + 5, centerY - arrowSize);
        ctx.lineTo(centerX - arrowSize / 2 + 5, centerY);
        ctx.lineTo(centerX + arrowSize / 2 + 5, centerY + arrowSize);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Right arrow ▶
      ctx.beginPath();
      ctx.moveTo(centerX - arrowSize / 2, centerY - arrowSize);
      ctx.lineTo(centerX + arrowSize / 2, centerY);
      ctx.lineTo(centerX - arrowSize / 2, centerY + arrowSize);
      ctx.closePath();
      ctx.fill();

      // Draw second arrow for double arrow button.
      if (type === "next_group") {
        ctx.beginPath();
        ctx.moveTo(centerX - arrowSize / 2 - 5, centerY - arrowSize);
        ctx.lineTo(centerX + arrowSize / 2 - 5, centerY);
        ctx.lineTo(centerX - arrowSize / 2 - 5, centerY + arrowSize);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Handles navigation button click events.
   */
  private onNavButtonClick(
    event: CanvasMouseEvent,
    pos: Vector2,
    node: LGraphNode,
    bounds?: RgthreeBaseWidgetBounds,
  ) {
    if (!bounds?.data) return;

    const { action, type } = bounds.data as {
      action: "prev" | "next" | "prev_group" | "next_group";
      type?: "A" | "B";
    };

    const selected = [...this.selected] as [ComfyImageData, ComfyImageData];

    if (action === "prev_group" || action === "next_group") {
      // Switch both A and B.
      const aIndex = this.aImages.findIndex((img) => img.name === selected[0]?.name);
      const bIndex = this.bImages.findIndex((img) => img.name === selected[1]?.name);

      if (action === "prev_group") {
        // Previous group.
        if (aIndex > 0) selected[0] = this.aImages[aIndex - 1]!;
        if (bIndex > 0) selected[1] = this.bImages[bIndex - 1]!;
      } else {
        // Next group.
        if (aIndex < this.aImages.length - 1) selected[0] = this.aImages[aIndex + 1]!;
        if (bIndex < this.bImages.length - 1) selected[1] = this.bImages[bIndex + 1]!;
      }
    } else if (type === "A") {
      // Switch A.
      const index = this.aImages.findIndex((img) => img.name === selected[0]?.name);
      if (action === "prev" && index > 0) {
        selected[0] = this.aImages[index - 1]!;
      } else if (action === "next" && index < this.aImages.length - 1) {
        selected[0] = this.aImages[index + 1]!;
      }
    } else if (type === "B") {
      // Switch B.
      const index = this.bImages.findIndex((img) => img.name === selected[1]?.name);
      if (action === "prev" && index > 0) {
        selected[1] = this.bImages[index - 1]!;
      } else if (action === "next" && index < this.bImages.length - 1) {
        selected[1] = this.bImages[index + 1]!;
      }
    }

    this.setSelected(selected);
    this.node.setDirtyCanvas(true, false);
  }

  /**
   * Draws a dropdown selector.
   * @param ctx Canvas rendering context.
   * @param x X coordinate.
   * @param y Y coordinate.
   * @param width Dropdown width.
   * @param height Dropdown height.
   * @param label Label (A or B).
   * @param selectedText Currently selected item text.
   */
  private drawDropdown(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    selectedText: string,
  ) {
    // Draw dropdown background.
    ctx.save();
    ctx.fillStyle = LiteGraph.WIDGET_BGCOLOR;
    ctx.strokeStyle = LiteGraph.WIDGET_OUTLINE_COLOR;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, [4]);
    ctx.fill();
    ctx.stroke();

    // Draw label and selected text.
    ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const textY = y + height / 2;
    const displayText = `${label}: ${selectedText}`;
    ctx.fillText(displayText, x + 8, textY);

    // Draw dropdown arrow.
    const arrowX = x + width - 15;
    const arrowY = textY;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY - 3);
    ctx.lineTo(arrowX + 6, arrowY - 3);
    ctx.lineTo(arrowX + 3, arrowY + 3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Handles dropdown click events, shows context menu.
   */
  private onDropdownClick(
    event: CanvasMouseEvent,
    pos: Vector2,
    node: LGraphNode,
    bounds?: RgthreeBaseWidgetBounds,
  ) {
    if (!bounds?.data) return;

    const { type, images } = bounds.data as { type: "A" | "B"; images: ComfyImageData[] };
    if (!images || images.length === 0) return;

    // Build menu items.
    const menuItems = images.map((img) => ({
      content: img.name,
      callback: () => {
        const selected = [...this.selected];
        if (type === "A") {
          selected[0] = img;
        } else {
          selected[1] = img;
        }
        this.setSelected(selected as [ComfyImageData, ComfyImageData]);
        this.node.setDirtyCanvas(true, false);
      },
    }));

    // Calculate menu position (convert to screen coordinates).
    const canvas = app.canvas;
    const rect = canvas.canvas.getBoundingClientRect();
    const nodePos = node.pos;
    const scale = canvas.ds?.scale || 1;
    const offset = canvas.ds?.offset || [0, 0];

    // Calculate menu screen position.
    const screenX = rect.left + (nodePos[0] + bounds.bounds[0]) * scale + offset[0] * scale;
    const screenY = rect.top + (nodePos[1] + bounds.bounds[1] + (bounds.bounds[3] || 20)) * scale + offset[1] * scale;

    // Show context menu.
    new LiteGraph.ContextMenu(menuItems, {
      event: event,
      left: screenX,
      top: screenY,
    });
  }

  private drawImage(
    ctx: CanvasRenderingContext2D,
    image: ComfyImageData | undefined,
    y: number,
    cropX?: number,
  ) {
    if (!image?.img?.naturalWidth || !image?.img?.naturalHeight) {
      return;
    }
    let [nodeWidth, nodeHeight] = this.node.size as [number, number];
    const imageAspect = image?.img.naturalWidth / image?.img.naturalHeight;
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
    const widthMultiplier = image?.img.naturalWidth / targetWidth;

    const sourceX = 0;
    const sourceY = 0;
    const sourceWidth =
      cropX != null ? (cropX - offsetX) * widthMultiplier : image?.img.naturalWidth;
    const sourceHeight = image?.img.naturalHeight;
    const destX = (nodeWidth - targetWidth) / 2;
    const destY = y + (height - targetHeight) / 2;
    const destWidth = cropX != null ? cropX - offsetX : targetWidth;
    const destHeight = targetHeight;
    ctx.save();
    ctx.beginPath();
    let globalCompositeOperation = ctx.globalCompositeOperation;
    if (cropX) {
      ctx.rect(destX, destY, destWidth, destHeight);
      ctx.clip();
    }
    ctx.drawImage(
      image?.img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      destX,
      destY,
      destWidth,
      destHeight,
    );
    // Shows a label overlayed on the image. Not perfect, keeping commented out.
    // ctx.globalCompositeOperation = "difference";
    // ctx.fillStyle = "rgba(180, 180, 180, 1)";
    // ctx.textAlign = "center";
    // ctx.font = `32px Arial`;
    // ctx.fillText(image.name, nodeWidth / 2, y + 32);
    if (cropX != null && cropX >= (nodeWidth - targetWidth) / 2 && cropX <= targetWidth + offsetX) {
      ctx.beginPath();
      ctx.moveTo(cropX, destY);
      ctx.lineTo(cropX, destY + destHeight);
      ctx.globalCompositeOperation = "difference";
      ctx.strokeStyle = "rgba(255,255,255, 1)";
      ctx.stroke();
    }
    ctx.globalCompositeOperation = globalCompositeOperation;
    ctx.restore();
  }

  computeSize(width: number): Vector2 {
    return [width, 20];
  }

  override serializeValue(
    node: LGraphNode,
    index: number,
  ): RgthreeImageComparerWidgetValue | Promise<RgthreeImageComparerWidgetValue> {
    const v = [];
    for (const data of this._value.images) {
      // Remove the img since it can't serialize.
      const d = {...data};
      delete d.img;
      v.push(d);
    }
    return {images: v};
  }
}

app.registerExtension({
  name: "rgthree.ImageComparer",
  async beforeRegisterNodeDef(nodeType: typeof LGraphNode, nodeData: ComfyNodeDef) {
    if (nodeData.name === RgthreeImageComparer.type) {
      RgthreeImageComparer.setUp(nodeType, nodeData);
    }
  },
});
