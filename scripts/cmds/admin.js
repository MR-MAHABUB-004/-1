"use strict";

module.exports = {
  config: {
    name:      "admin",
    aliases:   ["demote", "promote"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "admin",
    countDown: 5,
    description: { en: "Promote or demote a group member" },
    guide: {
      en:
        "{pn} (reply) — promote to admin\n" +
        "demote (reply) — remove admin rights",
    },
  },

  langs: {
    en: {
      notGroup:   "❌ Only usable in groups.",
      noTarget:   "❌ Reply to the user you want to promote/demote.",
      promoted:   "⭐ *%1* has been promoted to admin.",
      demoted:    "👤 *%1* has been demoted.",
      failed:     "❌ Failed: %1",
    },
  },

  onStart: async function ({ api, event, message, getLang }) {
    if (!event.isGroup) return message.reply(getLang("notGroup"));
    if (!event.messageReply) return message.reply(getLang("noTarget"));

    const msg        = event.raw;
    const chatId     = msg.chat.id;
    const target     = msg.reply_to_message.from;
    const targetName = `${target.first_name || ""}`.trim();
    const isDemote   = msg.text?.toLowerCase().match(/^\/demote/);

    try {
      if (isDemote) {
        await api.promoteChatMember(chatId, target.id, {
          can_change_info:     false,
          can_delete_messages: false,
          can_invite_users:    false,
          can_restrict_members: false,
          can_pin_messages:    false,
          can_manage_chat:     false,
          can_manage_video_chats: false,
        });
        return message.reply(getLang("demoted").replace("%1", targetName));
      } else {
        await api.promoteChatMember(chatId, target.id, {
          can_change_info:     true,
          can_delete_messages: true,
          can_invite_users:    true,
          can_restrict_members: true,
          can_pin_messages:    true,
          can_manage_chat:     true,
          can_manage_video_chats: true,
        });
        return message.reply(getLang("promoted").replace("%1", targetName));
      }
    } catch (e) {
      return message.reply(getLang("failed").replace("%1", e.message));
    }
  },
};
