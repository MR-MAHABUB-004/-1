"use strict";

const { createCanvas, loadImage } = require("canvas");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");

module.exports = {
config: {
name: "acslogo",
aliases: ["acs", "logo"],
version: "2.0",
author: "Mesbah Saxx / Modified for Telegram",

usePrefix: true,

role: 0,
category: "media",
countDown: 3,

description: {
  en: "Generate ACS style logo images from a Telegram photo.",
},

guide: {
  en:
    "{pn} — reply to a photo\n" +
    "{pn} <image URL> — generate from an image URL",
},

},

langs: {
en: {
noImage:
"❌ Please reply to an image or provide an image URL.",

  processing:
    "⏳ Creating ACS logo images...",

  success:
    "✅ ACS logo images generated successfully!",

  failed:
    "❌ Failed to generate ACS logo.",
},

},

onStart: async function ({
message,
event,
args,
getLang,
}) {
const tempFiles = [];

try {
  let avatarUrl = args[0];

  /*
   * ─────────────────────────────────────────────
   * 1. Get image URL from command argument
   * ─────────────────────────────────────────────
   */

  if (!avatarUrl && event.messageReply) {
    const reply = event.messageReply;

    /*
     * Different Telegram adapters may expose
     * the replied photo in different fields.
     */

    if (reply.attachments?.length) {
      const attachment = reply.attachments[0];

      avatarUrl =
        attachment.url ||
        attachment.fileUrl ||
        attachment.file_url;
    }

    avatarUrl =
      avatarUrl ||
      reply.photo?.[reply.photo.length - 1]?.url ||
      reply.photo?.[reply.photo.length - 1]?.fileUrl;
  }

  /*
   * ─────────────────────────────────────────────
   * 2. Get image directly from current message
   * ─────────────────────────────────────────────
   */

  if (!avatarUrl && event.attachments?.length) {
    const attachment = event.attachments[0];

    avatarUrl =
      attachment.url ||
      attachment.fileUrl ||
      attachment.file_url;
  }

  /*
   * If your Telegram event stores photo as fileId,
   * your framework should convert it to a usable URL
   * before reaching this command.
   */

  if (!avatarUrl) {
    return message.reply(getLang("noImage"));
  }

  await message.reply(getLang("processing"));

  /*
   * ─────────────────────────────────────────────
   * 3. ACS logo
   * ─────────────────────────────────────────────
   */

  const logoUrl =
    "https://raw.githubusercontent.com/MR-MAHABUB-004/MAHABUB-BOT-STORAGE/refs/heads/main/img/1788884508053.png";

  /*
   * ─────────────────────────────────────────────
   * 4. Download source images
   * ─────────────────────────────────────────────
   */

  const [avatarRes, logoRes] = await Promise.all([
    axios.get(avatarUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
    }),

    axios.get(logoUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
    }),
  ]);

  const img = await loadImage(
    Buffer.from(avatarRes.data)
  );

  const logo = await loadImage(
    Buffer.from(logoRes.data)
  );

  /*
   * ─────────────────────────────────────────────
   * 5. Canvas settings
   * ─────────────────────────────────────────────
   */

  const bgSize = 800;
  const upscaleFactor = 2;

  const logoSize = bgSize * 0.12;

  const desiredRatio = 2 / 3;

  const attachments = [];

  /*
   * ─────────────────────────────────────────────
   * Helper: draw ACS circular logo
   * ─────────────────────────────────────────────
   */

  function drawACSLogo(ctx) {
    const logoX = bgSize * 0.10;
    const logoY = bgSize * 0.12;

    const logoRadius = logoSize / 2;

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      logoX + logoRadius,
      logoY + logoRadius,
      logoRadius,
      0,
      Math.PI * 2
    );

    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      logo,
      logoX,
      logoY,
      logoSize,
      logoSize
    );

    ctx.restore();
  }

  /*
   * ─────────────────────────────────────────────
   * 6. If image is already 2:3
   * ─────────────────────────────────────────────
   */

  const currentRatio =
    img.width / img.height;

  if (
    Math.abs(currentRatio - desiredRatio) < 0.01
  ) {
    const canvas =
      createCanvas(bgSize, bgSize);

    const ctx =
      canvas.getContext("2d");

    /*
     * ACS background
     */

    ctx.fillStyle = "#01321f";

    ctx.fillRect(
      0,
      0,
      bgSize,
      bgSize
    );

    /*
     * Fit image vertically
     */

    const scale =
      bgSize / img.height;

    const targetWidth =
      img.width * scale;

    const dx =
      (bgSize - targetWidth) / 2;

    ctx.drawImage(
      img,
      0,
      0,
      img.width,
      img.height,
      dx,
      0,
      targetWidth,
      bgSize
    );

    /*
     * ACS circular logo
     */

    drawACSLogo(ctx);

    /*
     * PNG buffer
     */

    const tempBuffer =
      canvas.toBuffer("image/png");

    /*
     * Upscale
     */

    const outputBuffer =
      await sharp(tempBuffer)
        .resize(
          bgSize * upscaleFactor,
          bgSize * upscaleFactor
        )
        .png()
        .toBuffer();

    const fileName =
      path.join(
        __dirname,
        `acs_logo_${Date.now()}.png`
      );

    fs.writeFileSync(
      fileName,
      outputBuffer
    );

    tempFiles.push(fileName);

    attachments.push(
      fs.createReadStream(fileName)
    );
  }

  /*
   * ─────────────────────────────────────────────
   * 7. Generate 4 static slices
   * ─────────────────────────────────────────────
   */

  else {
    const partCount = 4;

    const partHeight =
      img.height;

    const partWidth =
      partHeight * desiredRatio;

    /*
     * Make sure crop width doesn't exceed image.
     */

    const actualPartWidth =
      Math.min(
        partWidth,
        img.width
      );

    /*
     * Maximum safe X position.
     */

    const maxStartX =
      Math.max(
        0,
        img.width - actualPartWidth
      );

    /*
     * Generate four different crops.
     */

    for (
      let i = 0;
      i < partCount;
      i++
    ) {
      const canvas =
        createCanvas(
          bgSize,
          bgSize
        );

      const ctx =
        canvas.getContext("2d");

      /*
       * Background
       */

      ctx.fillStyle =
        "#01321f";

      ctx.fillRect(
        0,
        0,
        bgSize,
        bgSize
      );

      /*
       * Static crop positions
       */

      let sx = 0;

      if (partCount > 1) {
        sx =
          (maxStartX / (partCount - 1)) * i;
      }

      /*
       * Keep crop inside image.
       */

      sx = Math.max(
        0,
        Math.min(
          sx,
          maxStartX
        )
      );

      const sy = 0;

      const sw =
        actualPartWidth;

      const sh =
        partHeight;

      /*
       * Scale crop to canvas.
       */

      const scale =
        bgSize / sh;

      const targetWidth =
        sw * scale;

      const dx =
        (bgSize - targetWidth) / 2;

      ctx.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        dx,
        0,
        targetWidth,
        bgSize
      );

      /*
       * ACS circular logo.
       */

      drawACSLogo(ctx);

      /*
       * Convert canvas to PNG.
       */

      const tempBuffer =
        canvas.toBuffer(
          "image/png"
        );

      /*
       * Upscale output.
       */

      const outputBuffer =
        await sharp(tempBuffer)
          .resize(
            bgSize * upscaleFactor,
            bgSize * upscaleFactor
          )
          .png()
          .toBuffer();

      const fileName =
        path.join(
          __dirname,
          `acs_logo_part_${i + 1}_${Date.now()}.png`
        );

      fs.writeFileSync(
        fileName,
        outputBuffer
      );

      tempFiles.push(fileName);

      attachments.push(
        fs.createReadStream(
          fileName
        )
      );
    }
  }

  /*
   * ─────────────────────────────────────────────
   * 8. Send generated images
   * ─────────────────────────────────────────────
   *
   * Telegram adapter may accept:
   *
   * message.reply({
   *   attachment: [...]
   * })
   *
   * If your adapter expects `files`,
   * change only this part.
   */

  await message.reply({
    attachment: attachments,
  });

  /*
   * ─────────────────────────────────────────────
   * 9. Cleanup
   * ─────────────────────────────────────────────
   */

  for (const file of tempFiles) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (e) {
      console.error(
        "Cleanup error:",
        e.message
      );
    }
  }

} catch (err) {
  console.error(
    "ACS LOGO ERROR:",
    err
  );

  /*
   * Cleanup even when generation fails.
   */

  for (const file of tempFiles) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (_) {}
  }

  return message.reply(
    getLang("failed")
  );
}

},
};
