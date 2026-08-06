"use strict";

module.exports = {
  config: {
    name:      "pin",
    aliases:   ["unpin"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "admin",
    countDown: 5,
    description: { en: "Pin or unpin a message in the group" },
    guide: {
      en:
        "{pn} (reply) — pin the replied message\n" +
        "unpin (reply) — unpin a specific message\n" +
        "unpin all — unpin all pinned messages",
    },
  },

  langs: {
    en: {
      notGroup:  "❌ Only usable in groups.",
      noReply:   "❌ Reply to the message you want to pin.",
      pinned:    "📌 Message pinned.",
      unpinned:  "📌 Message unpinned.",
      unpinnedAll: "📌 All messages unpinned.",
      failed:    "❌ Failed: %1",
    },
  },

  onStart: async function ({ api, event, message, args, getLang }) {
    if (!event.isGroup) return message.reply(getLang("notGroup"));

    const msg      = event.raw;
    const chatId   = msg.chat.id;
    const isUnpin  = msg.text?.toLowerCase().match(/^\/unpin/);

    if (isUnpin) {
      if (args[0] === "all") {
        try {
          await api.unpinAllChatMessages(chatId);
          return message.reply(getLang("unpinnedAll"));
        } catch (e) {
          return message.reply(getLang("failed").replace("%1", e.message));
        }
      }

      if (!event.messageReply) return message.reply(getLang("noReply"));
      try {
        await api.unpinChatMessage(chatId, { message_id: msg.reply_to_message.message_id });
        return message.reply(getLang("unpinned"));
      } catch (e) {
        return message.reply(getLang("failed").replace("%1", e.message));
      }
    }

    // Pin
    if (!event.messageReply) return message.reply(getLang("noReply"));
    try {
      await api.pinChatMessage(chatId, msg.reply_to_message.message_id, {
        disable_notification: false,
      });
      return message.reply(getLang("pinned"));
    } catch (e) {
      return message.reply(getLang("failed").replace("%1", e.message));
    }
  },
};
