// @ts-ignore
import { app } from "../../scripts/app.js";
import type {
  LiteGraph as TLiteGraph,
  LGraphCanvas as TLGraphCanvas,
  LGraphNode,
} from "../typings/litegraph.js";

declare const LiteGraph: typeof TLiteGraph;

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
  const ellipsisWidth = ctx.measureText(ellipsis).width;
  if (width <= maxWidth || width <= ellipsisWidth) {
    return str;
  }

  const index = binarySearch(
    str.length,
    (guess) => ctx.measureText(str.substring(0, guess)).width,
    maxWidth - ellipsisWidth,
  );

  return str.substring(0, index) + ellipsis;
}

export type WidgetRenderingOptionsPart = {
  type?: 'toggle'|'custom';
  margin?: number;
  fillStyle?: string;
  strokeStyle?: string;
  lowQuality?: boolean;
  draw?(ctx: CanvasRenderingContext2D, x: number, lowQuality: boolean): number;
};

type WidgetRenderingOptions = {
  width: number;
  height: number;
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
  }

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
