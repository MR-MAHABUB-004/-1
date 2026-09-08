"use strict";

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");

// ─────────────────────────────────────────────────────────────
// ACS TEAM LOGO
// Keep this URL unchanged if you want the same ACS circular logo
// as the original Messenger version.
// ─────────────────────────────────────────────────────────────
const ACS_LOGO_URL = "https://i.ibb.co/gF4K2Vfc/image0.jpg";

const BG_COLOR = "#01321f";

const OUTPUT_SIZE = 800;
const UPSCALE = 2;

const LOGO_SIZE = Math.round(OUTPUT_SIZE * 0.12);
const LOGO_X = Math.round(OUTPUT_SIZE * 0.10);
const LOGO_Y = Math.round(OUTPUT_SIZE * 0.12);

const PART_COUNT = 4;
const DESIRED_RATIO = 2 / 3;

// ─────────────────────────────────────────────────────────────
// Download URL as Buffer
// ─────────────────────────────────────────────────────────────
async function downloadBuffer(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxContentLength: 25 * 1024 * 1024,
  });

  return Buffer.from(response.data);
}

// ─────────────────────────────────────────────────────────────
// Get Telegram image URL
// ─────────────────────────────────────────────────────────────
async function getTelegramImageUrl(api, fileId) {
  return await api.getFileLink(fileId);
}

// ─────────────────────────────────────────────────────────────
// Make circular ACS logo
// ─────────────────────────────────────────────────────────────
async function createCircularLogo(logoBuffer) {
  const circleMask = Buffer.from(`
    <svg width="${LOGO_SIZE}" height="${LOGO_SIZE}">
      <circle
        cx="${LOGO_SIZE / 2}"
        cy="${LOGO_SIZE / 2}"
        r="${LOGO_SIZE / 2}"
        fill="white"
      />
    </svg>
  `);

  return await sharp(logoBuffer)
    .resize(LOGO_SIZE, LOGO_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .composite([
      {
        input: circleMask,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────
// Generate one ACS image
// ─────────────────────────────────────────────────────────────
async function generatePart(imageBuffer, logoBuffer, index) {
  const meta = await sharp(imageBuffer).metadata();

  const width = meta.width;
  const height = meta.height;

  if (!width || !height) {
    throw new Error("Invalid image dimensions.");
  }

  // Width of a 2:3 crop
  let cropWidth = Math.floor(height * DESIRED_RATIO);

  // If image is smaller than required crop, use full width
  cropWidth = Math.min(cropWidth, width);

  // Static slice position, similar to the original code
  let left;

  if (width <= cropWidth) {
    left = 0;
  } else {
    const maxLeft = width - cropWidth;

    left = Math.floor(
      (index * maxLeft) / (PART_COUNT - 1)
    );
  }

  // Crop image
  const cropped = await sharp(imageBuffer)
    .extract({
      left,
      top: 0,
      width: cropWidth,
      height,
    })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: "contain",
      background: BG_COLOR,
      position: "centre",
    })
    .png()
    .toBuffer();

  // Background
  const background = Buffer.from(`
    <svg width="${OUTPUT_SIZE}" height="${OUTPUT_SIZE}">
      <rect
        width="100%"
        height="100%"
        fill="${BG_COLOR}"
      />
    </svg>
  `);

  // Circular ACS logo
  const circularLogo = await createCircularLogo(logoBuffer);

  // Composite everything
  const finalImage = await sharp(background)
    .composite([
      {
        input: cropped,
        left: 0,
        top: 0,
      },
      {
        input: circularLogo,
        left: LOGO_X,
        top: LOGO_Y,
      },
    ])
    .resize(OUTPUT_SIZE * UPSCALE, OUTPUT_SIZE * UPSCALE)
    .png()
    .toBuffer();

  return finalImage;
}

// ─────────────────────────────────────────────────────────────
// MAIN COMMAND
// ─────────────────────────────────────────────────────────────
module.exports = {
  config: {
    name: "acslogo",
    aliases: ["acs"],
    version: "1.0.0",
    author: "Mahabub",
    usePrefix: true,
    role: 2,
    countDown: 5,

    category: "image",

    description: {
      en: "Automatically creates ACS team logo images from photos.",
    },

    guide: {
      en:
        "{pn} — reply to an image\n\n" +
        "You can also simply send an image without using the command.",
    },
  },

  // ───────────────────────────────────────────────────────────
  // Manual command
  // /acslogo + reply to image
  // ───────────────────────────────────────────────────────────
  onStart: async function ({ api, event, message }) {
    try {
      let fileId = null;

      // Current message image
      if (event.attachments?.length) {
        const photo = event.attachments.find(
          a => a.type === "photo"
        );

        if (photo) {
          fileId = photo.fileId;
        }
      }

      // Replied image
      if (
        !fileId &&
        event.messageReply?.attachments?.length
      ) {
        const photo = event.messageReply.attachments.find(
          a => a.type === "photo"
        );

        if (photo) {
          fileId = photo.fileId;
        }
      }

      if (!fileId) {
        return message.reply(
          "🖼️ Please send/reply to an image.\n\n" +
          "Or simply send a new image — ACS logo will be generated automatically."
        );
      }

      await generateACS(api, message, fileId);

    } catch (error) {
      console.error("[ACSLOGO]", error);
      return message.reply(
        "❌ Failed to generate ACS logo.\nPlease try another image."
      );
    }
  },

  // ───────────────────────────────────────────────────────────
  // AUTO MODE
  //
  // User simply sends an image
  // → ACS logo generated automatically
  // ───────────────────────────────────────────────────────────
  onChat: async function ({ api, event, message }) {
    try {
      // Ignore bot-generated messages
      if (event.raw?.from?.is_bot) return;

      let fileId = null;

      // Telegram normal photo
      const photo = event.attachments?.find(
        a => a.type === "photo"
      );

      if (photo) {
        fileId = photo.fileId;
      }

      // Telegram image sent as document
      if (
        !fileId &&
        event.raw?.document?.mime_type?.startsWith("image/")
      ) {
        fileId = event.raw.document.file_id;
      }

      if (!fileId) return;

      await generateACS(api, message, fileId);

    } catch (error) {
      console.error("[ACSLOGO AUTO]", error);

      // Don't spam the chat if auto-generation fails
      return;
    }
  },
};

// ─────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────
async function generateACS(api, message, fileId) {
  const cacheDir = path.join(__dirname, "..", "cache");

  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const jobId = `acs_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const outputFiles = [];

  try {
    await message.action("upload_photo");

    const waitMsg = await message.reply(
      "⏳ Creating ACS logo..."
    );

    // Telegram image URL
    const imageUrl = await getTelegramImageUrl(api, fileId);

    // Download source image + ACS logo
    const [imageBuffer, logoBuffer] = await Promise.all([
      downloadBuffer(imageUrl),
      downloadBuffer(ACS_LOGO_URL),
    ]);

    // Generate 4 images
    for (let i = 0; i < PART_COUNT; i++) {
      const outputBuffer = await generatePart(
        imageBuffer,
        logoBuffer,
        i
      );

      const outputPath = path.join(
        cacheDir,
        `${jobId}_${i + 1}.png`
      );

      fs.writeFileSync(outputPath, outputBuffer);
      outputFiles.push(outputPath);
    }

    // Send all 4 images
    for (const file of outputFiles) {
      await message.sendPhoto(
        fs.createReadStream(file),
        ""
      );
    }

    // Remove processing message
    if (waitMsg?.message_id) {
      await message
        .delete(waitMsg.message_id)
        .catch(() => {});
    }

  } catch (error) {
    console.error("[ACSLOGO GENERATOR]", error);

    throw error;

  } finally {
    // Cleanup
    for (const file of outputFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch {}
    }
  }
}
