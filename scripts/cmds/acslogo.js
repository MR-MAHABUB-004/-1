"use strict";

/**
 * scripts/cmds/acslogo.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generate the ACS-branded template (dark-green side bars + circular ACS
 * badge) around a photo.
 *
 * Usage:
 *   Reply to a photo with  {pn}
 *   Or send a photo with the caption  {pn}
 *
 * Also doubles as the on/off switch for automatic mode (see
 * scripts/events/acslogoauto.js), which — when on — generates this
 * automatically for every photo sent in the chat, no command needed:
 *   {pn} on   — turn automatic mode on for this chat  (group admin)
 *   {pn} off  — turn automatic mode off for this chat  (group admin)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const axios = require("axios");
const { generateAcsLogo } = require("./lib/acsLogoGen.js");

module.exports = {
  config: {
    name: "acslogo",
    aliases: ["acs"],
    version: "2.0",
    author: "Mesbah Saxx (ported to Telegram)",
    usePrefix: true,
    role: 0,
    countDown: 5,
    category: "canvas",
    description: {
      en: "Generate the ACS logo template around a photo.",
    },
    guide: {
      en: "{pn} — reply to a photo, or send a photo with this as the caption.\n{pn} on/off — toggle automatic mode for this chat (group admin only).",
    },
  },

  langs: {
    en: {
      noPhoto: "⚠️ Reply to a photo, or send a photo with {pn} as the caption.",
      generating: "🖼️ Generating...",
      failed: "❌ Failed to generate ACS logo.",
      needAdmin: "⛔ Only group admins can change this setting.",
      autoOn: "✅ Automatic ACS logo mode is now ON for this chat — just send a photo.",
      autoOff: "❎ Automatic ACS logo mode is now OFF for this chat.",
    },
  },

  onStart: async function ({ api, event, message, args, role, threadsData, getLang }) {
    const sub = (args[0] || "").toLowerCase();

    if (sub === "on" || sub === "off") {
      if (role < 1) return message.reply(getLang("needAdmin"));
      await threadsData.set(event.threadID, "data.acsLogoAuto", sub === "on");
      return message.reply(getLang(sub === "on" ? "autoOn" : "autoOff"));
    }

    const photo = event.attachments.find((a) => a.type === "photo")
      || event.messageReply?.attachments?.find((a) => a.type === "photo");

    if (!photo) {
      return message.reply(getLang("noPhoto"));
    }

    return runAcsLogo({ api, event, message, fileId: photo.fileId });
  },

  // Shared entry point used directly by scripts/events/acslogoauto.js too.
  // Deliberately doesn't depend on the calling module's `langs` dict, since
  // it's invoked from two different modules (this command + the auto event).
  runAcsLogo,
};

async function runAcsLogo({ api, event, message, fileId }) {
  try {
    await api.sendChatAction(event.threadID, "upload_photo").catch(() => {});

    const fileUrl = await api.getFileLink(fileId);
    const res = await axios.get(fileUrl, { responseType: "arraybuffer" });
    const inputBuffer = Buffer.from(res.data);

    const frames = await generateAcsLogo(inputBuffer);

    for (const buf of frames) {
      await message.sendPhoto(buf, "");
    }
  } catch (err) {
    console.error("Error generating ACS logo:", err);
    await message.reply("❌ Failed to generate ACS logo.");
  }
}
