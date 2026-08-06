"use strict";

module.exports = {
  config: {
    name:      "antispam",
    aliases:   ["spam"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "admin",
    countDown: 5,
    description: { en: "Configure anti-spam protection for this group" },
    guide: {
      en:
        "{pn} on/off             — enable/disable\n" +
        "{pn} limit <n>          — messages allowed per window (default: 5)\n" +
        "{pn} window <seconds>   — time window in seconds (default: 5)\n" +
        "{pn} mute <seconds>     — mute duration (default: 60)",
    },
  },

  langs: {
    en: {
      notGroup: "❌ Only usable in groups.",
      on:       "✅ Anti-spam *enabled*.",
      off:      "🔴 Anti-spam *disabled*.",
      set:      "✅ Set `%1` to `%2`.",
      badNum:   "❌ Value must be a positive number.",
      status:   "⚙️ *Anti-spam*\nEnabled: %1\nLimit: %2 msg/window\nWindow: %3s\nMute: %4s",
    },
  },

  onStart: async function ({ event, message, args, getLang, threadsData }) {
    if (!event.isGroup) return message.reply(getLang("notGroup"));

    const chatId = event.threadID;
    const thread = threadsData.getOrCreate(chatId);
    const sub    = args[0]?.toLowerCase();

    if (!sub) {
      return message.reply(
        getLang("status")
          .replace("%1", thread.antispam  ? "Yes"  : "No")
          .replace("%2", thread.antispamLimit  || 5)
          .replace("%3", thread.antispamWindow || 5)
          .replace("%4", thread.antispamMute   || 60)
      );
    }

    if (sub === "on")  { threadsData.set(chatId, "antispam", true);  return message.reply(getLang("on")); }
    if (sub === "off") { threadsData.set(chatId, "antispam", false); return message.reply(getLang("off")); }

    const numericKeys = { limit: "antispamLimit", window: "antispamWindow", mute: "antispamMute" };
    if (numericKeys[sub] && args[1]) {
      const val = parseInt(args[1]);
      if (!val || val <= 0) return message.reply(getLang("badNum"));
      threadsData.set(chatId, numericKeys[sub], val);
      return message.reply(getLang("set").replace("%1", sub).replace("%2", val));
    }

    return message.reply(`Use \`${global.GoatBot.config.prefix}help antispam\` for usage.`);
  },
};
