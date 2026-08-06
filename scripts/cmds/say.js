"use strict";

module.exports = {
  config: {
    name:      "say",
    aliases:   ["echo", "announce"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "admin",
    countDown: 5,
    description: { en: "Make the bot send a message and delete your command" },
    guide:       { en: "{pn} <message>" },
  },

  langs: {
    en: {
      noText: "❌ Provide a message.",
    },
  },

  onStart: async function ({ api, event, message, args, getLang }) {
    const text = args.join(" ").trim();
    if (!text) return message.reply(getLang("noText"));

    // Delete the triggering command
    try { await api.deleteMessage(event.threadID, event.messageID); } catch {}

    await message.send(text, event.threadID);
  },
};
