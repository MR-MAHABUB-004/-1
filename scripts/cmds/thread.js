"use strict";

module.exports = {
  config: {
    name:      "thread",
    aliases:   ["chat", "settings"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "admin",
    countDown: 5,
    description: { en: "View or modify settings for this chat" },
    guide: {
      en:
        "{pn} — view settings\n" +
        "{pn} set adminonly on/off — restrict commands to admins\n" +
        "{pn} set welcome <msg> — set welcome message\n" +
        "{pn} set leave <msg> — set leave message\n" +
        "{pn} reset — reset all settings",
    },
  },

  langs: {
    en: {
      notGroup:     "❌ Only usable in groups.",
      viewHeader:   "⚙️ *Settings for this chat*\n",
      setDone:      "✅ Setting `%1` updated.",
      resetDone:    "✅ All settings reset to default.",
      unknownKey:   "❌ Unknown setting key: `%1`",
    },
  },

  onStart: async function ({ event, message, args, getLang, threadsData, prefix }) {
    if (!event.isGroup) return message.reply(getLang("notGroup"));

    const chatId  = event.threadID;
    const thread  = threadsData.getOrCreate(chatId);

    // ── View ─────────────────────────────────────────────────────────────────
    if (!args[0] || args[0] === "view") {
      return message.reply(
        getLang("viewHeader") +
        `🔑 *Prefix:* \`${thread.prefix || prefix}\`\n` +
        `🌐 *Language:* ${thread.language || "en"}\n` +
        `🔒 *Admin Only:* ${thread.adminOnly ? "On" : "Off"}\n` +
        `👋 *Welcome Msg:* ${thread.welcomeMsg || "_(default)_"}\n` +
        `🚪 *Leave Msg:* ${thread.leaveMsg || "_(default)_"}`
      );
    }

    // ── Reset ─────────────────────────────────────────────────────────────────
    if (args[0] === "reset") {
      threadsData.update(chatId, {
        prefix: null, language: "en", adminOnly: false,
        welcomeMsg: null, leaveMsg: null,
      });
      return message.reply(getLang("resetDone"));
    }

    // ── Set ───────────────────────────────────────────────────────────────────
    if (args[0] === "set" && args[1]) {
      const key   = args[1].toLowerCase();
      const value = args.slice(2).join(" ");

      const allowed = {
        adminonly:  v => ({ adminOnly: v === "on" }),
        welcome:    v => ({ welcomeMsg: v || null }),
        leave:      v => ({ leaveMsg:   v || null }),
        language:   v => ({ language:   v || "en" }),
      };

      if (!allowed[key]) {
        return message.reply(getLang("unknownKey").replace("%1", key));
      }

      threadsData.update(chatId, allowed[key](value));
      return message.reply(getLang("setDone").replace("%1", key));
    }

    return message.reply(`Use \`${prefix}help thread\` for usage.`);
  },
};
