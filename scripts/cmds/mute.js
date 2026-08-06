"use strict";

module.exports = {
  config: {
    name:      "mute",
    aliases:   ["unmute", "silence"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "admin",
    countDown: 5,
    description: { en: "Mute or unmute a user in the group" },
    guide: {
      en:
        "{pn} (reply) [duration] — mute replied user\n" +
        "{pn} unmute (reply) — unmute a user\n" +
        "Duration: 30s, 10m, 2h, 1d (default: 1h)\n" +
        "Example: /mute 10m",
    },
  },

  langs: {
    en: {
      notGroup:    "❌ Only usable in groups.",
      noTarget:    "❌ Reply to a user's message to mute/unmute them.",
      cantMuteBot: "❌ Can't mute a bot.",
      cantMuteAdmin: "❌ Can't mute a group admin.",
      muted:       "🔇 *%1* has been muted for *%2*.",
      unmuted:     "🔊 *%1* has been unmuted.",
      failed:      "❌ Failed: %1",
      badTime:     "❌ Invalid duration. Use: 10s, 5m, 2h, 1d",
    },
  },

  onStart: async function ({ api, event, message, args, getLang }) {
    if (!event.isGroup) return message.reply(getLang("notGroup"));

    const msg      = event.raw;
    const chatId   = msg.chat.id;
    const isUnmute = msg.text?.toLowerCase().includes("unmute");

    if (!event.messageReply) return message.reply(getLang("noTarget"));

    const target     = msg.reply_to_message.from;
    const targetId   = target.id;
    const targetName = `${target.first_name || ""}`.trim();

    if (target.is_bot) return message.reply(getLang("cantMuteBot"));

    // Check if target is admin
    try {
      const member = await api.getChatMember(chatId, targetId);
      if (["administrator", "creator"].includes(member.status)) {
        return message.reply(getLang("cantMuteAdmin"));
      }
    } catch {}

    // Unmute
    if (isUnmute) {
      try {
        await api.restrictChatMember(chatId, targetId, {
          permissions: {
            can_send_messages:         true,
            can_send_media_messages:   true,
            can_send_other_messages:   true,
            can_add_web_page_previews: true,
            can_send_polls:            true,
          },
        });
        return message.reply(getLang("unmuted").replace("%1", targetName));
      } catch (e) {
        return message.reply(getLang("failed").replace("%1", e.message));
      }
    }

    // Parse duration
    function parseDuration(str) {
      if (!str) return 3600; // default 1h
      const m = str.match(/^(\d+)(s|m|h|d)$/i);
      if (!m) return null;
      const n = parseInt(m[1]);
      const units = { s: 1, m: 60, h: 3600, d: 86400 };
      return n * units[m[2].toLowerCase()];
    }

    const durationSec = parseDuration(args[0]);
    if (durationSec === null) return message.reply(getLang("badTime"));

    function humanDuration(sec) {
      if (sec < 60)   return `${sec}s`;
      if (sec < 3600) return `${Math.floor(sec / 60)}m`;
      if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
      return `${Math.floor(sec / 86400)}d`;
    }

    try {
      await api.restrictChatMember(chatId, targetId, {
        permissions: {
          can_send_messages:         false,
          can_send_media_messages:   false,
          can_send_other_messages:   false,
          can_add_web_page_previews: false,
          can_send_polls:            false,
        },
        until_date: Math.floor(Date.now() / 1000) + durationSec,
      });

      return message.reply(
        getLang("muted")
          .replace("%1", targetName)
          .replace("%2", humanDuration(durationSec))
      );
    } catch (e) {
      return message.reply(getLang("failed").replace("%1", e.message));
    }
  },
};
