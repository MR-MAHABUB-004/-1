"use strict";

const fs    = require("fs");
const path  = require("path");
const axios = require("axios");

const TMP_DIR  = path.join(__dirname, "../tmp");
const API_BASE = "https://mahabub-apis.fun";

module.exports = {
  config: {
    name:      "auto",
    aliases:   ["dl", "download"],
    version:   "5.4",
    author:    "MR᭄﹅ MAHABUB﹅ メꪜ",
    usePrefix: false,
    role:      0,
    category:  "media",
    countDown: 5,
    description: { en: "Auto video downloader — just send any https link" },
    guide:       { en: "Just send any video link and the bot will try to download it" },
  },

  langs: {
    en: {
      downloaded: "✅ 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗱!\n\n📌 Platform: %1\n🎬 Title: %2",
      noLink:     "📥 Send any https video link and I'll download it for you 🎥",
      noVideo:    "❌ No downloadable video found for that link.",
    },
  },

  onStart: async function ({ message, getLang }) {
    return message.reply(getLang("noLink"));
  },

  onChat: async function ({ event, message, getLang }) {
    const text = event.body?.trim();
    if (!text) return;

    const match = text.match(/(https?:\/\/[^\s]+)/);
    if (!match) return;

    const videoLink = match[0];
    await message.action("upload_video");

    const wait = (ms) => new Promise(r => setTimeout(r, ms));

    async function fetchInfo(retries = 3) {
      for (let i = 1; i <= retries; i++) {
        try {
          const res = await axios.get(
            `${API_BASE}/mahabub/dl?url=${encodeURIComponent(videoLink)}`,
            { timeout: 15000 }
          );
          return res.data;
        } catch (err) {
          if (i === retries) throw err;
          await wait(2000);
        }
      }
    }

    async function downloadFile(downloadURL, filePath, retries = 3) {
      for (let i = 1; i <= retries; i++) {
        try {
          const res = await axios.get(downloadURL, {
            responseType: "stream",
            timeout: 60000,
            headers: { "User-Agent": "Mozilla/5.0" },
          });
          await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(filePath);
            res.data.pipe(writer);
            writer.on("finish", resolve);
            writer.on("error", reject);
          });
          return;
        } catch (err) {
          if (i === retries) throw err;
          await wait(2000);
        }
      }
    }

    function cleanup(filePath) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {}
    }

    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
    const filePath = path.join(TMP_DIR, `video_${Date.now()}.mp4`);

    try {
      const data = await fetchInfo();
      const { platform, title, hd, sd } = data;
      const downloadURL = hd || sd;

      if (!downloadURL) {
        return message.reply(getLang("noVideo"));
      }

      await downloadFile(downloadURL, filePath);

      // Wait for sendVideo to fully finish THEN delete — stream must be closed first
      await message.sendVideo(
        fs.createReadStream(filePath),
        getLang("downloaded")
          .replace("%1", platform || "Unknown")
          .replace("%2", title    || "No Title")
      );

      // ✅ File fully uploaded — safe to delete now
      cleanup(filePath);

    } catch {
      // Silent fail — cleanup on error too
      cleanup(filePath);
    }
  },
};
