// Regression test for https://github.com/rgthree/rgthree-comfy/issues/788
//
// In Slide mode the widget passes the raw pointer x (pointerOverPos[0], which spans the
// whole node) into drawImage() as cropX. When the pointer goes past the image box's right
// edge, sourceWidth/destWidth overshoot and WebKit stretches image_b horizontally and the
// divider disappears; on the left side the widths go negative.
//
// The fix clamps cropX into [offsetX, offsetX + targetWidth] before computing the
// source/destination rectangles. This test executes the REAL drawImage() implementation
// extracted from the shipped web/comfyui/image_comparer.js inside a minimal ctx stub,
// so no browser or ComfyUI runtime is required.
//
// The repo has no test runner; run standalone:  node tests/image-comparer-slide.test.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const built = readFileSync(join(root, "web/comfyui/image_comparer.js"), "utf8");

// Extract the widget's drawImage(ctx, image, y, cropX) method body via brace matching.
const def = built.indexOf("drawImage(ctx, image, y, cropX)");
if (def < 0) throw new Error("drawImage(ctx, image, y, cropX) not found in built artifact");
let depth = 0;
let end = -1;
for (let i = built.indexOf("{", def); i < built.length; i++) {
  if (built[i] === "{") depth++;
  else if (built[i] === "}") {
    depth--;
    if (depth === 0) { end = i + 1; break; }
  }
}
if (end < 0) throw new Error("unbalanced braces extracting drawImage method");

const drawImage = new Function(
  "ctx",
  "image",
  "y",
  "cropX",
  `return (${built.slice(def, end).replace("drawImage", "function")}).call(this, ctx, image, y, cropX);`,
);

function makeCtx() {
  const calls = { drawImage: [], clipRects: [], divider: null };
  const ctx = {
    calls,
    save() {}, restore() {}, beginPath() {}, clip() {}, stroke() {},
    rect(x, y, w, h) { calls.clipRects.push([x, y, w, h]); },
    moveTo(x, y) { calls.divider = [x, y]; },
    lineTo() {},
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) { calls.drawImage.push({ sx, sy, sw, sh, dx, dy, dw, dh }); },
  };
  Object.defineProperty(ctx, "globalCompositeOperation", { set() {}, get() { return "source-over"; } });
  return ctx;
}

// Issue scenario: 960x1282 portrait image_b in a 400x300 node (image box [87.7, 312.3]).
const nodeSize = [400, 300];
const img = { img: { naturalWidth: 960, naturalHeight: 1282 } };

// Run the real drawImage and report the geometry it actually passed to ctx.drawImage.
function run(cropX, image = img) {
  const ctx = makeCtx();
  drawImage.call({ node: { size: nodeSize } }, ctx, image, 0, cropX);
  const c = ctx.calls.drawImage[0];
  if (!c) throw new Error("drawImage() did not draw");
  // destX === (nodeWidth - targetWidth) / 2 === offsetX in both aspect branches.
  return {
    sourceWidth: c.sw,
    destWidth: c.dw,
    offsetX: c.dx,
    targetWidth: c.dw,
    naturalWidth: image.img.naturalWidth,
    ctx,
  };
}

let failures = 0;
function assert(cond, label, detail) {
  if (cond) {
    console.log(`  ok  ${label}`);
  } else {
    failures++;
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}
const near = (a, b) => Math.abs(a - b) < 1e-9;

// --- baseline geometry ------------------------------------------------------
const base = run(undefined);
const offsetX = base.offsetX;
const targetWidth = base.targetWidth; // ≈ 224.6
const rightEdge = offsetX + targetWidth;
const widthMultiplier = base.naturalWidth / targetWidth;
console.log(`image box = [${offsetX.toFixed(1)}, ${rightEdge.toFixed(1)}], targetWidth=${targetWidth.toFixed(1)}`);
assert(near(targetWidth, (300 * base.naturalWidth) / img.img.naturalHeight) && offsetX > 0,
  "baseline: portrait image is letterboxed (offsetX > 0)", `offsetX=${offsetX}, targetWidth=${targetWidth}`);

// --- the bug: pointer past the right edge -----------------------------------
const past = run(350); // 350 > rightEdge ≈ 312.3
console.log(`cropX=350 (past right edge): sourceWidth=${past.sourceWidth.toFixed(1)}, destWidth=${past.destWidth.toFixed(1)}, divider=${JSON.stringify(past.ctx.calls.divider)}`);
assert(past.sourceWidth <= base.naturalWidth + 1e-9,
  "past right edge: sourceWidth within natural bounds",
  `sourceWidth=${past.sourceWidth} > naturalWidth=${base.naturalWidth}`);
assert(past.destWidth <= targetWidth + 1e-9,
  "past right edge: destWidth within image box (no stretch)",
  `destWidth=${past.destWidth} > targetWidth=${targetWidth}`);
assert(past.ctx.calls.divider !== null && near(past.ctx.calls.divider[0], rightEdge),
  "past right edge: divider pinned at the image's right edge",
  `divider=${JSON.stringify(past.ctx.calls.divider)}, rightEdge=${rightEdge}`);
assert(past.ctx.calls.clipRects.length === 1 && past.ctx.calls.clipRects[0][2] <= targetWidth + 1e-9,
  "past right edge: clip rect width within image box");

// --- unchanged behavior inside the box ---------------------------------------
const inside = run(200);
assert(near(inside.sourceWidth, (200 - offsetX) * widthMultiplier),
  "inside box: sourceWidth matches original formula");
assert(near(inside.destWidth, 200 - offsetX), "inside box: destWidth matches original formula");
assert(inside.ctx.calls.divider !== null && near(inside.ctx.calls.divider[0], 200),
  "inside box: divider at the pointer position");

// --- left side: no negative widths (issue reporter's second finding) ----------
for (const cropX of [50, 0]) {
  const left = run(cropX);
  console.log(`cropX=${cropX} (left of/at box start): sourceWidth=${left.sourceWidth.toFixed(1)}, destWidth=${left.destWidth.toFixed(1)}, clipRects=${left.ctx.calls.clipRects.length}`);
  assert(left.sourceWidth >= 0 && left.destWidth >= 0,
    `cropX=${cropX}: no negative widths`,
    `sourceWidth=${left.sourceWidth}, destWidth=${left.destWidth}`);
  if (cropX === 0) {
    assert(left.ctx.calls.clipRects.length === 1,
      "cropX=0: clip rect still applied (old truthy `if (cropX)` skipped it)");
  }
}

// --- landscape image (offsetX = 0 branch) -------------------------------------
const wideImg = { img: { naturalWidth: 1280, naturalHeight: 720 } };
const wide = run(500, wideImg); // 500 > nodeWidth 400
assert(wide.destWidth <= nodeSize[0] + 1e-9,
  "landscape, pointer past node edge: destWidth <= nodeWidth",
  `destWidth=${wide.destWidth}`);
assert(wide.sourceWidth <= wideImg.img.naturalWidth + 1e-9,
  "landscape, pointer past node edge: sourceWidth within natural bounds",
  `sourceWidth=${wide.sourceWidth}`);

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll checks passed.");
