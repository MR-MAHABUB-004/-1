"use strict";

module.exports = {
  config: {
    name:      "prefix",
    aliases:   ["setprefix"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,           // group admin+
    category:  "admin",
    countDown: 5,
    description: { en: "Change or view the bot prefix for this chat" },
    guide:       { en: "{pn} — view current prefix\n{pn} <new_prefix> — set new prefix" },
  },

  langs: {
    en: {
      current:    "🔑 Current prefix for this chat: `%1`",
      changed:    "✅ Prefix changed to `%1` for this chat.",
      tooLong:    "❌ Prefix must be 1–5 characters.",
      noPrivate:  "❌ Prefix can only be changed in groups.",
    },
  },

  onStart: async function ({ event, message, args, getLang, threadsData, prefix }) {
    if (!event.isGroup) return message.reply(getLang("noPrivate"));

    if (!args[0]) {
      return message.reply(getLang("current").replace("%1", prefix));
    }

    const newPrefix = args[0];
    if (newPrefix.length > 5) return message.reply(getLang("tooLong"));

    threadsData.set(event.threadID, "prefix", newPrefix);
    return message.reply(getLang("changed").replace("%1", newPrefix));
  },
};
