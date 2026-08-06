"use strict";

const fs       = require("fs");
const path     = require("path");
const axios    = require("axios");
const Photo360 = require("abir-photo360-apis");

const TEMPLATES = {
  "1":  "Foggy glass text",
  "2":  "Cloud text",
  "3":  "Light glow",
  "4":  "Glitch text",
  "5":  "3D metal",
  "6":  "Foggy rainy",
  "7":  "Sand writing",
  "8":  "Diamond text",
  "9":  "Neon signature",
  "10": "Broken glass",
  "11": "Multicolor arrow",
  "12": "Graffiti wall",
  "13": "Watercolor",
  "14": "Night lend",
  "15": "Sky clouds",
  "16": "Beach sand",
  "17": "Dark green",
  "18": "Stars night",
  "19": "3D sand",
  "20": "Summery sand",
  "21": "Firework text",
  "22": "Leaves ligature",
  "23": "Letters on leaves",
  "24": "Graffiti color",
  "25": "Paper cut"
};

const URLS = {
  "1":  "https://en.ephoto360.com/handwritten-text-on-foggy-glass-online-680.html",
  "2":  "https://en.ephoto360.com/create-realistic-cloud-text-effect-606.html",
  "3":  "https://en.ephoto360.com/light-glow-text-effect-369.html",
  "4":  "https://en.ephoto360.com/glitch-text-effect-online-345.html",
  "5":  "https://en.ephoto360.com/3d-metal-text-effect-600.html",
  "6":  "https://en.ephoto360.com/foggy-rainy-text-effect-75.html",
  "7":  "https://en.ephoto360.com/write-in-sand-summer-beach-online-free-595.html",
  "8":  "https://en.ephoto360.com/diamond-text-95.html",
  "9":  "https://en.ephoto360.com/create-multicolored-neon-light-signatures-591.html",
  "10": "https://en.ephoto360.com/create-broken-glass-text-effect-online-698.html",
  "11": "https://en.ephoto360.com/create-multicolored-signature-attachment-arrow-effect-714.html",
  "12": "https://en.ephoto360.com/create-a-graffiti-text-effect-on-the-wall-online-665.html",
  "13": "https://en.ephoto360.com/create-a-watercolor-text-effect-online-655.html",
  "14": "https://en.ephoto360.com/creating-text-effects-night-lend-for-word-effect-147.htm",
  "15": "https://en.ephoto360.com/write-text-effect-clouds-in-the-sky-online-619.html",
  "16": "https://en.ephoto360.com/write-in-sand-summer-beach-online-576.html",
  "17": "https://en.ephoto360.com/dark-green-typography-online-359.html",
  "18": "https://en.ephoto360.com/stars-night-online-1-85.html",
  "19": "https://en.ephoto360.com/realistic-3d-sand-text-effect-online-580.html",
  "20": "https://en.ephoto360.com/create-a-summery-sand-writing-text-effect-577.html",
  "21": "https://en.ephoto360.com/text-firework-effect-356.html",
  "22": "https://en.ephoto360.com/ligatures-effects-from-leaves-146.html",
  "23": "https://en.ephoto360.com/write-letters-on-the-leaves-248.html",
  "24": "https://en.ephoto360.com/graffiti-color-199.html",
  "25": "https://en.ephoto360.com/caper-cut-effect-184.html"
};

// Cache: threadID → { text, menuMsgId }
if (!global.ephotoCache) global.ephotoCache = new Map();

module.exports = {
  config: {
    name:        "ephoto",
    aliases:     ["ep"],
    version:     "2.0.0",
    author:      "Imran Ahmed",
    usePrefix:   true,
    role:        0,
    countDown:   5,
    category:    "textmaker",
    description: { en: "Generate stylish text images using Ephoto360 templates." },
    guide:       { en: "{pn} <text>\n\nExample: {pn} Mahabub" }
  },

  // ─── onStart ─────────────────────────────────────────────────────────────────
  // User runs: .ephoto Mahabub
  // → sends a message with all 25 template buttons
  onStart: async function ({ api, event, message, args }) {
    const { threadID } = event;

    const text = args.join(" ").trim();
    if (!text) {
      return message.reply(
        "⚠️ Please provide a text.\n\nExample: .ephoto Mahabub"
      );
    }

    // Build inline keyboard — 2 buttons per row
    const btnRows = [];
    const ids     = Object.keys(TEMPLATES);
    for (let i = 0; i < ids.length; i += 2) {
      const row = [
        { text: `🎨 ${TEMPLATES[ids[i]]}`, callback_data: `ep:${ids[i]}` }
      ];
      if (ids[i + 1]) {
        row.push({ text: `🎨 ${TEMPLATES[ids[i + 1]]}`, callback_data: `ep:${ids[i + 1]}` });
      }
      btnRows.push(row);
    }

    const menuMsg = await api.sendMessage(
      threadID,
      `✍️ *"${text}"* — Choose an effect:`,
      {
        parse_mode:   "Markdown",
        reply_markup: { inline_keyboard: btnRows }
      }
    );

    // Cache the text + menu message ID for this thread
    global.ephotoCache.set(threadID, {
      text,
      menuMsgId: menuMsg.message_id
    });
  },

  // ─── onCallbackQuery ─────────────────────────────────────────────────────────
  // Fires when user taps one of the template buttons
  // callback_data format: ep:<templateID>
  onCallbackQuery: async function ({ api, event, message, callbackData }) {
    const { threadID } = event;

    if (!callbackData.startsWith("ep:")) return;

    const templateID = callbackData.split(":")[1];

    if (!URLS[templateID]) {
      return message.reply("❌ Invalid template. Please try again.");
    }

    const cached = global.ephotoCache.get(threadID);
    if (!cached) {
      return message.reply(
        "❌ Session expired. Please run .ephoto again."
      );
    }

    const { text, menuMsgId } = cached;

    // Delete the button menu
    await api.deleteMessage(threadID, menuMsgId).catch(() => {});
    global.ephotoCache.delete(threadID);

    // ── Processing indicator ────────────────────────────────────────
    const waitMsg = await api.sendMessage(
      threadID,
      `⏳ Generating *"${text}"* with *${TEMPLATES[templateID]}*...`,
      { parse_mode: "Markdown" }
    );

    // ── Cache dir ───────────────────────────────────────────────────
    const cacheDir = path.join(__dirname, "..", "cache");
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const imagePath = path.join(cacheDir, `ephoto_${Date.now()}.png`);

    try {
      const photo360 = new Photo360(URLS[templateID]);
      photo360.setName(text);

      const result   = await photo360.execute();
      const response = await axios.get(result.imageUrl, { responseType: "arraybuffer" });
      fs.writeFileSync(imagePath, response.data);

      // Send the generated image
      await api.sendPhoto(
        threadID,
        fs.createReadStream(imagePath),
        {
          caption:    `✅ *"${text}"* — ${TEMPLATES[templateID]}`,
          parse_mode: "Markdown"
        }
      );

      // Remove the wait message
      await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});

      // Auto-delete local file after 15 s
      setTimeout(() => {
        if (fs.existsSync(imagePath)) {
          fs.unlink(imagePath, err => {
            if (!err) console.log(`🧹 Deleted: ${imagePath}`);
          });
        }
      }, 15000);

    } catch (err) {
      console.error("Ephoto Error:", err);
      await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      message.reply("❌ Failed to generate image. Please try again later.");
    }
  }
};
