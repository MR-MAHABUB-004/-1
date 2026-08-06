"use strict";

module.exports = {
  config: {
    name:      "kick",
    aliases:   ["remove", "ban"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,           // group admin+
    category:  "admin",
    countDown: 5,
    description: { en: "Kick a user from the group" },
    guide:       { en: "{pn} @username — kick a tagged user\n{pn} (reply) — kick replied user" },
  },

  langs: {
    en: {
      noTarget:    "❌ Please reply to a message or tag someone to kick.",
      notInGroup:  "❌ This command only works in groups.",
      cantKickBot: "❌ I can't kick myself.",
      cantKickAdmin: "❌ Can't kick a group admin.",
      success:     "✅ Kicked %1 from the group.",
      failed:      "❌ Failed to kick: %1",
    },
  },

  onStart: async function ({ api, event, message, getLang }) {
    if (!event.isGroup) return message.reply(getLang("notInGroup"));

    const msg  = event.raw;
    const self = (await api.getMe()).id;
    let targetId = null;
    let targetName = "User";

    // From reply
    if (event.messageReply) {
      const ru = msg.reply_to_message.from;
      targetId   = ru.id;
      targetName = ru.first_name || "User";
    }
    // From @mention entity
    else if (msg.entities) {
      for (const entity of msg.entities) {
        if (entity.type === "text_mention" && entity.user) {
          targetId   = entity.user.id;
          targetName = entity.user.first_name || "User";
          break;
        }
      }
    }

    if (!targetId) return message.reply(getLang("noTarget"));
    if (targetId === self) return message.reply(getLang("cantKickBot"));

    // Check if target is admin
    try {
      const member = await api.getChatMember(msg.chat.id, targetId);
      if (["administrator", "creator"].includes(member.status)) {
        return message.reply(getLang("cantKickAdmin"));
      }
    } catch {}

    try {
      await api.banChatMember(msg.chat.id, targetId);
      // Unban immediately so they can re-join (kick, not permanent ban)
      await api.unbanChatMember(msg.chat.id, targetId, { only_if_banned: true });
      return message.reply(getLang("success").replace("%1", targetName));
    } catch (e) {
      return message.reply(getLang("failed").replace("%1", e.message));
    }
  },
};
