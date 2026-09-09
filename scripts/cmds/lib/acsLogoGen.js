"use strict";

/**
 * scripts/cmds/lib/acsLogoGen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared image generator for the ACS logo template, used by both:
 *   - scripts/cmds/acslogo.js      (explicit command)
 *   - scripts/events/acslogoauto.js (auto-trigger on any photo)
 *
 * Rebuilt with Jimp instead of node-canvas + sharp (neither of which are
 * dependencies of this project — Jimp already is, e.g. in kiss.js), so no
 * new native/build-tool dependencies are introduced.
 *
 * Layout constants below were measured directly off the reference renders
 * you shared (dark-green #01321f side bars, a 2:3 photo slot, circular badge
 * top-left) — same math as the original acslogo.js, just with a real logo
 * asset baked in.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const path = require("path");
const Jimp = require("jimp");

const WORK_SIZE = 800; // working canvas size, upscaled at the end
const UPSCALE = 2; // final output = 1600x1600
const BG_COLOR = 0x01321fff; // #01321f, matches the reference renders
const DESIRED_RATIO = 2 / 3; // width:height of the photo slot
const PART_COUNT = 4; // how many slices to generate for wide/tall sources

// Fractions of WORK_SIZE — matches the badge position/size measured off
// the reference renders you sent.
const LOGO = { x: 0.1, y: 0.12, size: 0.12 };

const LOGO_ASSET_PATH = path.join(__dirname, "assets", "acs_logo.png");

let logoCache = null;
async function getLogo(sizePx) {
  // Cache the base badge read, but always hand back a fresh resized+masked
  // clone since Jimp mutates in place.
  if (!logoCache) logoCache = await Jimp.read(LOGO_ASSET_PATH);
  return logoCache.clone().resize(sizePx, sizePx).circle();
}

/**
 * Draws one frame: crops [sx,sy,sw,sh] out of `source`, scales it to fill
 * the WORK_SIZE canvas height, centers it inside the dark-green slot, then
 * stamps the circular ACS badge on top. Returns a PNG buffer.
 */
async function renderFrame(source, sx, sy, sw, sh) {
  const bg = new Jimp(WORK_SIZE, WORK_SIZE, BG_COLOR);

  const slice = source.clone().crop(Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh));
  const scale = WORK_SIZE / sh;
  const targetWidth = Math.round(sw * scale);
  slice.resize(targetWidth, WORK_SIZE);

  const dx = Math.round((WORK_SIZE - targetWidth) / 2);
  bg.composite(slice, dx, 0);

  const logoSizePx = Math.round(WORK_SIZE * LOGO.size);
  const logo = await getLogo(logoSizePx);
  bg.composite(logo, Math.round(WORK_SIZE * LOGO.x), Math.round(WORK_SIZE * LOGO.y));

  bg.resize(WORK_SIZE * UPSCALE, WORK_SIZE * UPSCALE, Jimp.RESIZE_BICUBIC);
  return bg.getBufferAsync(Jimp.MIME_PNG);
}

/**
 * generateAcsLogo(inputBuffer)
 * Returns an array of PNG buffers: a single image if the source is already
 * ~2:3, or 4 static slices (left-to-right) otherwise — same behavior as the
 * original acslogo.js.
 */
async function generateAcsLogo(inputBuffer) {
  const img = await Jimp.read(inputBuffer);
  const w = img.bitmap.width;
  const h = img.bitmap.height;
  const currentRatio = w / h;

  if (Math.abs(currentRatio - DESIRED_RATIO) < 0.01) {
    return [await renderFrame(img, 0, 0, w, h)];
  }

  const partHeight = h;
  const partWidth = Math.min(partHeight * DESIRED_RATIO, w);
  const buffers = [];

  for (let i = 0; i < PART_COUNT; i++) {
    let sx = i * (partWidth / PART_COUNT);
    // clamp so the last slices don't try to read past the source's edge
    if (sx + partWidth > w) sx = Math.max(0, w - partWidth);
    buffers.push(await renderFrame(img, sx, 0, partWidth, partHeight));
  }

  return buffers;
}

module.exports = { generateAcsLogo };
