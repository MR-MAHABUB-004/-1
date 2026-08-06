const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API = "https://mahabub-aldl.vercel.app/api/dl";
const TMP_DIR = path.join(__dirname, "tmp");

module.exports = {
  config: {
    name: "auto",
    aliases: ["dl", "download"],
    version: "6.0",
    author: "MR᭄﹅ MAHABUB﹅ メꪜ",
    usePrefix: false,
    role: 0,
    category: "media",
    countDown: 5,
    description: {
      en: "Auto video downloader"
    },
    guide: {
      en: "Just send any supported video link."
    }
  },

  langs: {
    en: {
      noLink: "📥 Send any supported video link.",
      noVideo: "❌ No downloadable video found.",
      downloaded:
        "✅ Downloaded!\n\n📌 Platform: %1\n🎬 Title: %2\n👤 Author: %3"
    }
  },

  onStart: async ({ message, getLang }) => {
    return message.reply(getLang("noLink"));
  },

  onChat: async function ({ event, message, getLang }) {
    const text = event.body?.trim();
    if (!text) return;

    const match = text.match(/https?:\/\/[^\s]+/i);
    if (!match) return;

    const url = match[0];

    await message.action("upload_video");

    if (!fs.existsSync(TMP_DIR))
      fs.mkdirSync(TMP_DIR, { recursive: true });

    const filePath = path.join(TMP_DIR, `video_${Date.now()}.mp4`);

    try {
      const { data } = await axios.get(
        `${API}?url=${encodeURIComponent(url)}`,
        {
          timeout: 20000
        }
      );

      if (
        data.status !== "success" ||
        !(data.video || data.hd || data.sd)
      ) {
        return message.reply(getLang("noVideo"));
      }

      const videoUrl = data.video || data.hd || data.sd;

      const res = await axios({
        url: videoUrl,
        method: "GET",
        responseType: "stream",
        timeout: 60000,
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        res.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      await message.sendVideo(
        fs.createReadStream(filePath),
        getLang("downloaded")
          .replace("%1", data.platform || "Unknown")
          .replace("%2", data.title || "No Title")
          .replace("%3", data.author || "Unknown")
      );

      fs.unlinkSync(filePath);
    } catch (e) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }
};
