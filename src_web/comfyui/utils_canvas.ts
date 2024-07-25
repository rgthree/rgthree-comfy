import { app } from "scripts/app.js";
import type { LGraphCanvas as TLGraphCanvas, Vector2 } from "../typings/litegraph.js";

function binarySearch(max: number, getValue: (n: number) => number, match: number) {
  let min = 0;

  while (min <= max) {
    let guess = Math.floor((min + max) / 2);
    const compareVal = getValue(guess);

    if (compareVal === match) return guess;
    if (compareVal < match) min = guess + 1;
    else max = guess - 1;
  }

  return max;
}

/**
 * Fits a string against a max width for a ctx. Font should be defined on ctx beforehand.
 */
export function fitString(ctx: CanvasRenderingContext2D, str: string, maxWidth: number) {
  let width = ctx.measureText(str).width;
  const ellipsis = "…";
  const ellipsisWidth = measureText(ctx, ellipsis);
  if (width <= maxWidth || width <= ellipsisWidth) {
    return str;
  }

  const index = binarySearch(
    str.length,
    (guess) => measureText(ctx, str.substring(0, guess)),
    maxWidth - ellipsisWidth,
  );

  return str.substring(0, index) + ellipsis;
}

/** Measures the width of text for a canvas context. */
export function measureText(ctx: CanvasRenderingContext2D, str: string) {
  return ctx.measureText(str).width;
}

export type WidgetRenderingOptionsPart = {
  type?: "toggle" | "custom";
  margin?: number;
  fillStyle?: string;
  strokeStyle?: string;
  lowQuality?: boolean;
  draw?(ctx: CanvasRenderingContext2D, x: number, lowQuality: boolean): number;
};

type WidgetRenderingOptions = {
  width: number;
  height: number;
  posX?: number;
  posY: number;
  borderRadius?: number;
  colorStroke?: string;
  colorBackground?: string;
  // node: LGraphNode;
  // value?: any;
  // margin?: number;
  // direction?: "right" | "left";
  // fillStyle?: string;
  // strokeStyle?: string;
  // parts: WidgetRenderingOptionsPart[];
};

export function isLowQuality() {
  const canvas = app.canvas as TLGraphCanvas;
  return (canvas.ds?.scale || 1) <= 0.5;
}

export function drawNodeWidget(ctx: CanvasRenderingContext2D, options: WidgetRenderingOptions) {
  const lowQuality = isLowQuality();

  const data = {
    width: options.width,
    height: options.height,
    posY: options.posY,
    lowQuality,
    margin: 15,
    colorOutline: LiteGraph.WIDGET_OUTLINE_COLOR,
    colorBackground: LiteGraph.WIDGET_BGCOLOR,
    colorText: LiteGraph.WIDGET_TEXT_COLOR,
    colorTextSecondary: LiteGraph.WIDGET_SECONDARY_TEXT_COLOR,
  };

  // Draw background.
  ctx.strokeStyle = options.colorStroke || data.colorOutline;
  ctx.fillStyle = options.colorBackground || data.colorBackground;
  ctx.beginPath();
  ctx.roundRect(
    data.margin,
    data.posY,
    data.width - data.margin * 2,
    data.height,
    lowQuality ? [0] : options.borderRadius ? [options.borderRadius] : [options.height * 0.5],
  );
  ctx.fill();
  if (!lowQuality) {
    ctx.stroke();
  }

  return data;
}

/** Draws a rounded rectangle. */
export function drawRoundedRectangle(
  ctx: CanvasRenderingContext2D,
  options: WidgetRenderingOptions,
) {
  const lowQuality = isLowQuality();
  options = { ...options };
  ctx.strokeStyle = options.colorStroke || LiteGraph.WIDGET_OUTLINE_COLOR;
  ctx.fillStyle = options.colorBackground || LiteGraph.WIDGET_BGCOLOR;
  ctx.beginPath();
  ctx.roundRect(
    options.posX!,
    options.posY,
    options.width,
    options.height,
    lowQuality ? [0] : options.borderRadius ? [options.borderRadius] : [options.height * 0.5],
  );
  ctx.fill();
  !lowQuality && ctx.stroke();
}

type DrawNumberWidgetPartOptions = {
  posX: number;
  posY: number;
  height: number;
  value: number;
  direction?: 1 | -1;
  textColor?: string;
};

/**
 * Draws a number picker with arrows off to each side.
 *
 * This is for internal widgets that may have many hit areas (full-width, default number widgets put
 * the arrows on either side of the full-width row).
 */
export function drawNumberWidgetPart(
  ctx: CanvasRenderingContext2D,
  options: DrawNumberWidgetPartOptions,
): [Vector2, Vector2, Vector2] {
  const arrowWidth = 9;
  const arrowHeight = 10;
  const innerMargin = 3;
  const numberWidth = 32;

  const xBoundsArrowLess: Vector2 = [0, 0];
  const xBoundsNumber: Vector2 = [0, 0];
  const xBoundsArrowMore: Vector2 = [0, 0];

  ctx.save();

  let posX = options.posX;
  const { posY, height, value, textColor } = options;
  const midY = posY + height / 2;

  // If we're drawing parts from right to left (usually when something in the middle will be
  // flexible), then we can simply move left the expected width of our widget and draw forwards.
  if (options.direction === -1) {
    posX = posX - arrowWidth - innerMargin - numberWidth - innerMargin - arrowWidth;
  }

  // Draw the strength left arrow.
  ctx.fill(
    new Path2D(
      `M ${posX} ${midY} l ${arrowWidth} ${
        arrowHeight / 2
      } l 0 -${arrowHeight} L ${posX} ${midY} z`,
    ),
  );

  xBoundsArrowLess[0] = posX;
  xBoundsArrowLess[1] = arrowWidth;
  posX += arrowWidth + innerMargin;

  // Draw the strength text.
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const oldTextcolor = ctx.fillStyle;
  if (textColor) {
    ctx.fillStyle = textColor;
  }
  ctx.fillText(fitString(ctx, value.toFixed(2), numberWidth), posX + numberWidth / 2, midY);
  ctx.fillStyle = oldTextcolor;

  xBoundsNumber[0] = posX;
  xBoundsNumber[1] = numberWidth;
  posX += numberWidth + innerMargin;

  // Draw the strength right arrow.
  ctx.fill(
    new Path2D(
      `M ${posX} ${midY - arrowHeight / 2} l ${arrowWidth} ${arrowHeight / 2} l -${arrowWidth} ${
        arrowHeight / 2
      } v -${arrowHeight} z`,
    ),
  );

  xBoundsArrowMore[0] = posX;
  xBoundsArrowMore[1] = arrowWidth;

  ctx.restore();

  return [xBoundsArrowLess, xBoundsNumber, xBoundsArrowMore];
}
drawNumberWidgetPart.WIDTH_TOTAL = 9 + 3 + 32 + 3 + 9;

type DrawTogglePartOptions = {
  posX: number;
  posY: number;
  height: number;
  value: boolean | null;
};

/**
 * Draws a toggle for a widget. The toggle is a three-way switch with left being false, right being
 * true, and a middle state being null.
 */
export function drawTogglePart(
  ctx: CanvasRenderingContext2D,
  options: DrawTogglePartOptions,
): Vector2 {
  const lowQuality = isLowQuality();
  ctx.save();

  const { posX, posY, height, value } = options;

  const toggleRadius = height * 0.36; // This is the standard toggle height calc.
  const toggleBgWidth = height * 1.5; // We don't draw a separate bg, but this would be it.

  // Toggle Track
  if (!lowQuality) {
    ctx.beginPath();
    ctx.roundRect(posX + 4, posY + 4, toggleBgWidth - 8, height - 8, [height * 0.5]);
    ctx.globalAlpha = app.canvas.editor_alpha * 0.25;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fill();
    ctx.globalAlpha = app.canvas.editor_alpha;
  }

  // Toggle itself
  ctx.fillStyle = value === true ? "#89B" : "#888";
  const toggleX =
    lowQuality || value === false
      ? posX + height * 0.5
      : value === true
      ? posX + height
      : posX + height * 0.75;
  ctx.beginPath();
  ctx.arc(toggleX, posY + height * 0.5, toggleRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  return [posX, toggleBgWidth];
}

export function drawInfoIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number = 12,
) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, [size * 0.1]);
  ctx.fillStyle = "#2f82ec";
  ctx.strokeStyle = "#0f2a5e";
  ctx.fill();
  // ctx.stroke();
  ctx.strokeStyle = "#FFF";
  ctx.lineWidth = 2;
  // ctx.lineCap = 'round';
  const midX = x + size / 2;
  const serifSize = size * 0.175;
  ctx.stroke(
    new Path2D(`
    M ${midX} ${y + size * 0.15}
    v 2
    M ${midX - serifSize} ${y + size * 0.45}
    h ${serifSize}
    v ${size * 0.325}
    h ${serifSize}
    h -${serifSize * 2}
  `),
  );
  ctx.restore();
}
