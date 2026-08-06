"use strict";

const axios  = require("axios");
const moment = require("moment-timezone");
const fs     = require("fs");
const path   = require("path");

const TMP_DIR = path.join(__dirname, "../tmp");

module.exports = {
  config: {
    name:      "info",
    aliases:   ["inf", "in4"],
    version:   "2.6",
    author:    "MR᭄﹅ MAHABUB﹅ メꪜ",
    usePrefix: true,
    role:      0,
    category:  "information",
    countDown: 5,
    description: { en: "Sends bot and admin info along with a video." },
    guide:       { en: "{pn}" },
  },

  langs: {
    en: {
      wait:  "𝑾𝒂𝒊𝒕 𝒃𝒂𝒃𝒚... 𝑳𝒐𝒂𝒅𝒊𝒏𝒈 𝒂𝒖𝒕𝒉𝒐𝒓 𝒊𝒏𝒇𝒐 😘",
      error: "❌ 𝑬𝒓𝒓𝒐𝒓 𝒇𝒆𝒕𝒄𝒉𝒊𝒏𝒈 𝒗𝒊𝒅𝒆𝒐. 𝑷𝒍𝒆𝒂𝒔𝒆 𝒕𝒓𝒚 𝒂𝒈𝒂𝒊𝒏 𝒍𝒂𝒕𝒆𝒓.",
    },
  },

  onStart: async function ({ message, getLang, prefix }) {
    await this.sendInfo(message, getLang, prefix);
  },

  // Typing "info" (no prefix) also triggers
  onChat: async function ({ event, message, getLang, prefix }) {
    if (event.body?.trim().toLowerCase() === "info") {
      await this.sendInfo(message, getLang, prefix);
    }
  },

  sendInfo: async function (message, getLang, prefix) {
    // Send wait message then auto-delete after 4s
    const waitMsg = await message.reply(getLang("wait"));
    if (waitMsg?.message_id) {
      setTimeout(() => message.delete(waitMsg.message_id).catch(() => {}), 4000);
    }

    const botName    = "𝑴𝑨𝑯𝑨𝑩𝑼𝑩-𝑩𝑶𝑻";
    const botPrefix  = prefix || global.GoatBot.config.prefix;
    const authorName = "𝑴𝑨𝑯𝑨𝑩𝑼𝑩 𝑹𝑨𝑯𝑴𝑨𝑵";
    const authorFB   = "https://www.facebook.com/www.xnxx.com140";
    const authorInst = "@mahabub_rahman_404";
    const status     = "𝑺𝑰𝑵𝑮𝑳𝑬..!";

    const now       = moment().tz("Asia/Dhaka");
    const date      = now.format("dddd, MMMM Do YYYY");
    const time      = now.format("h:mm:ss A");

    const uptime    = process.uptime();
    const d = Math.floor(uptime / 86400);
    const h = Math.floor((uptime % 86400) / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);
    const uptimeStr = `${d}d ${h}h ${m}m ${s}s`.replace(/^0d 0h /, "");

    const body =
`╭─╼━━━[ 🌟 𝑩𝑶𝑻 & 𝑨𝑼𝑻𝑯𝑶𝑹 𝑰𝑵𝑭𝑶 🌟 ]━━━╾─╮
┃
┃ 👤 𝑶𝒘𝒏𝒆𝒓: ${authorName}
┃ 🤖 𝑩𝒐𝒕 𝑵𝒂𝒎𝒆: ${botName}
┃ 🔰 𝑷𝒓𝒆𝒇𝒊𝒙: ${botPrefix}
┃ ❤ 𝑹𝒆𝒍𝒂𝒕𝒊𝒐𝒏: ${status}
┃
┃ 📆 𝑫𝒂𝒕𝒆: ${date}
┃ ⏰ 𝑻𝒊𝒎𝒆: ${time}
┃ ⚙ 𝑼𝒑𝒕𝒊𝒎𝒆: ${uptimeStr}
┃
┃ 🌐 𝑭𝒂𝒄𝒆𝒃𝒐𝒐𝒌: ${authorFB}
┃ 📸 𝑰𝒏𝒔𝒕𝒂: ${authorInst}
┃
╰─╼━━━━━━━━━━━━━━━━━━━━━━━━━━━━╾─╯`;

    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
    const tmpPath = path.join(TMP_DIR, `info_${Date.now()}.mp4`);

    try {
      const apiRes = await axios.get("https://mahabub-apis.vercel.app/info");
      if (!apiRes.data?.data) throw new Error("Invalid API response");

      let videoUrl = apiRes.data.data;

      // Convert Google Drive share link → direct download
      if (videoUrl.includes("drive.google.com")) {
        const match = videoUrl.match(/[-\w]{25,}/);
        if (match) videoUrl = `https://drive.google.com/uc?id=${match[0]}`;
      }

      const dlRes = await axios.get(videoUrl, {
        responseType: "stream",
        timeout:      60000,
        headers:      { "User-Agent": "Mozilla/5.0" },
      });

      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(tmpPath);
        dlRes.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      // Send video with info card as caption
      await message.sendVideo(fs.createReadStream(tmpPath), body);

    } catch (err) {
      console.error("info error:", err.message);
      // Fallback — text only if video fails
      await message.reply(body).catch(() => {});
    } finally {
      try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    }
  },
};
