

function binarySearch(max: number, getValue: (n:number) => number, match: number) {
  let min = 0;

  while (min <= max) {
    let guess = Math.floor((min + max) / 2);
    const compareVal = getValue(guess);

    if (compareVal === match) return guess;
    if (compareVal < match) min = guess + 1;
    else max = guess - 1;
  }

  return max;
};

/**
 * Fits a string against a max width for a ctx. Font should be defined on ctx beforehand.
 */
export function fitString(ctx: CanvasRenderingContext2D, str: string, maxWidth: number) {
  let width = ctx.measureText(str).width;
  const ellipsis = '…';
  const ellipsisWidth = ctx.measureText(ellipsis).width;
  if (width <= maxWidth || width <= ellipsisWidth) {
    return str;
  }

  const index = binarySearch(
    str.length,
    guess => ctx.measureText(str.substring(0, guess)).width,
    maxWidth - ellipsisWidth,
  );

  return str.substring(0, index) + ellipsis;
};