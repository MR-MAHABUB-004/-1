"use strict";

module.exports = {
  config: {
    name:      "rule",
    aliases:   ["rules"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "info",
    countDown: 5,
    description: { en: "View or set group rules" },
    guide: {
      en:
        "{pn} — show rules\n" +
        "{pn} set <rules text> — set rules (admin)\n" +
        "{pn} clear — clear rules (admin)",
    },
  },

  langs: {
    en: {
      noRules:   "📭 No rules have been set for this group yet.",
      header:    "📜 *Group Rules*\n\n",
      setDone:   "✅ Rules updated.",
      cleared:   "✅ Rules cleared.",
      adminOnly: "❌ Only admins can set rules.",
      notGroup:  "❌ Only usable in groups.",
    },
  },

  onStart: async function ({ event, message, args, getLang, role, threadsData }) {
    if (!event.isGroup) return message.reply(getLang("notGroup"));

    const chatId = event.threadID;
    const thread = threadsData.getOrCreate(chatId);
    const sub    = args[0]?.toLowerCase();

    if (sub === "set") {
      if (role < 1) return message.reply(getLang("adminOnly"));
      const text = args.slice(1).join(" ").trim();
      if (!text) return message.reply("❌ Provide the rules text.");
      threadsData.set(chatId, "rules", text);
      return message.reply(getLang("setDone"));
    }

    if (sub === "clear") {
      if (role < 1) return message.reply(getLang("adminOnly"));
      threadsData.set(chatId, "rules", null);
      return message.reply(getLang("cleared"));
    }

    // Show rules
    if (!thread.rules) return message.reply(getLang("noRules"));
    return message.reply(getLang("header") + thread.rules);
  },
};
