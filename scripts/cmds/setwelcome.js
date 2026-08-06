"use strict";

module.exports = {
  config: {
    name:      "setwelcome",
    aliases:   ["setleave", "welcomemsg"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "admin",
    countDown: 5,
    description: { en: "Set or view custom welcome/leave messages" },
    guide: {
      en:
        "{pn} <message>       — set welcome message\n" +
        "{pn} off             — reset to default\n" +
        "{pn} view            — preview current message\n" +
        "setleave <message>   — set leave message\n\n" +
        "Placeholders: {userName}, {boxName}, {prefix}",
    },
  },

  langs: {
    en: {
      notGroup:  "❌ Only usable in groups.",
      setWelcome: "✅ Welcome message updated.",
      setLeave:   "✅ Leave message updated.",
      reset:      "✅ Message reset to default.",
      preview:    "👁️ *Current message:*\n%1",
      none:       "_(using default message)_",
    },
  },

  onStart: async function ({ event, message, args, getLang, threadsData }) {
    if (!event.isGroup) return message.reply(getLang("notGroup"));

    const chatId  = event.threadID;
    const thread  = threadsData.getOrCreate(chatId);
    const isLeave = event.body.toLowerCase().includes("setleave");
    const key     = isLeave ? "leaveMsg" : "welcomeMsg";
    const text    = args.join(" ").trim();

    if (!text || text === "view") {
      const current = thread[key] || getLang("none");
      return message.reply(getLang("preview").replace("%1", current));
    }

    if (text === "off") {
      threadsData.set(chatId, key, null);
      return message.reply(getLang("reset"));
    }

    threadsData.set(chatId, key, text);
    return message.reply(isLeave ? getLang("setLeave") : getLang("setWelcome"));
  },
};
