import assert from "node:assert/strict";
import test from "node:test";
import {
  clampRange,
  coverFit,
  shareCanvasSize,
  shareFileName,
  stickerRect,
} from "../app/manual/share-draw";

test("share sizes cover post and story", () => {
  assert.deepEqual(shareCanvasSize("4:5"), { width: 1080, height: 1350 });
  assert.deepEqual(shareCanvasSize("9:16"), { width: 1080, height: 1920 });
});

test("cover fit crops to the destination aspect", () => {
  const fit = coverFit(4000, 3000, 1080, 1350);
  assert.equal(fit.width, 1800);
  assert.equal(fit.height, 1350);
  assert.equal(fit.x, -360);
  assert.equal(fit.y, 0);
});

test("sticker rect centers on the given fractions", () => {
  const rect = stickerRect(
    { canvasWidth: 1080, canvasHeight: 1350, scale: 0.34, cx: 0.5, cy: 0.72 },
    { width: 512, height: 512 },
  );
  assert.ok(Math.abs(rect.width - 367.2) < 0.01);
  assert.ok(Math.abs(rect.height - 367.2) < 0.01);
  assert.ok(Math.abs(rect.x - 356.4) < 0.01);
  assert.ok(Math.abs(rect.y - 788.4) < 0.01);
});

test("clamps fractions and names the file", () => {
  assert.equal(clampRange(2, 0.05, 0.95), 0.95);
  assert.equal(shareFileName("2026-11-17", "9:16"), "walk-log-2026-11-17-story.png");
  assert.equal(shareFileName("2026-11-17", "4:5"), "walk-log-2026-11-17-post.png");
});
