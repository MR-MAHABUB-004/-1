"use strict";

module.exports = {
  config: {
    name:      "uid",
    aliases:   ["id", "chatid"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "info",
    countDown: 3,
    description: { en: "Show your user ID, chat ID, or replied user's ID" },
    guide:       { en: "{pn} — your IDs\n{pn} (reply to message) — that user's ID" },
  },

  langs: {
    en: {
      yourInfo:   "🪪 *Your Info*\n👤 User ID: `%1`\n📛 Name: %2\n🔗 Username: %3",
      chatInfo:   "💬 *Chat Info*\n🆔 Chat ID: `%1`\n📛 Title: %2\n🌐 Type: %3",
      replyInfo:  "👤 *Replied User*\n🆔 User ID: `%1`\n📛 Name: %2\n🔗 Username: %3",
    },
  },

  onStart: async function ({ event, message, getLang }) {
    const { raw: msg } = event;
    const from = msg.from;

    // If replying to someone
    if (event.messageReply) {
      const ru = msg.reply_to_message.from;
      return message.reply(
        getLang("replyInfo")
          .replace("%1", ru.id)
          .replace("%2", `${ru.first_name || ""} ${ru.last_name || ""}`.trim())
          .replace("%3", ru.username ? `@${ru.username}` : "none")
      );
    }

    const userLine = getLang("yourInfo")
      .replace("%1", from.id)
      .replace("%2", `${from.first_name || ""} ${from.last_name || ""}`.trim())
      .replace("%3", from.username ? `@${from.username}` : "none");

    // In groups also show chat info
    if (event.isGroup) {
      const chat = msg.chat;
      const chatLine = getLang("chatInfo")
        .replace("%1", chat.id)
        .replace("%2", chat.title || "—")
        .replace("%3", chat.type);
      return message.reply(userLine + "\n\n" + chatLine);
    }

    return message.reply(userLine);
  },
};
