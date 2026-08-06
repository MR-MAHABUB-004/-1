"use strict";

module.exports = {
  config: {
    name:      "broadcast",
    aliases:   ["bc", "announce"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      2,           // bot admin only
    category:  "admin",
    countDown: 10,
    description: { en: "Broadcast a message to all chats" },
    guide:       { en: "{pn} <message>" },
  },

  langs: {
    en: {
      noMsg:   "❌ Please provide a message to broadcast.",
      sending: "📡 Broadcasting to all chats...",
      done:    "✅ Broadcast complete.\n✔️ Sent: %1\n❌ Failed: %2",
    },
  },

  onStart: async function ({ message, args, getLang }) {
    const text = args.join(" ").trim();
    if (!text) return message.reply(getLang("noMsg"));

    await message.reply(getLang("sending"));

    const { sent, failed } = await global.broadcast(
      `📢 *Announcement*\n\n${text}`
    );

    return message.reply(
      getLang("done").replace("%1", sent).replace("%2", failed)
    );
  },
};
