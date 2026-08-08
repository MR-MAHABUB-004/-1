"use strict";

module.exports = {
  config: {
    name:      "clear",
    aliases:   ["clearchat", "cls"],
    version:   "1.0.0",
    author:    "System",
    usePrefix: true,
    role:      1,           // group admin or higher — avoids random members wiping chat
    category:  "admin",
    countDown: 10,
    description: { en: "বটের পাঠানো সব মেসেজ এই চ্যাট থেকে মুছে ফেলে" },
    guide:       { en: "{pn}" },
  },

  langs: {
    en: {
      clearing:
        "🧹 বটের সব মেসেজ মুছে ফেলা হচ্ছে...",

      done:
        "✅ %1 টা মেসেজ মুছে ফেলা হয়েছে।\n❌ মুছা যায়নি: %2",

      none:
        "😶 মুছার মতো কোনো বট-মেসেজ পাওয়া যায়নি।",
    },
  },

  onStart: async function ({ api, event, message, getLang }) {
    const chatId = event.threadID;
    const ids = (global.sentMessages && global.sentMessages.get(String(chatId))) || [];

    if (ids.length === 0) {
      return message.reply(getLang("none"));
    }

    const statusMsg = await message.reply(getLang("clearing"));

    let deleted = 0;
    let failed = 0;

    for (const id of ids) {
      // Delete the "clearing..." status message last, not mid-loop.
      if (id === statusMsg.message_id) continue;

      try {
        await api.deleteMessage(chatId, id);
        deleted++;
      } catch (_) {
        // Telegram rejects deletes for messages older than 48h, or ones
        // already removed — just count it and move on.
        failed++;
      }

      await new Promise((r) => setTimeout(r, 40));
    }

    // Reset tracking for this chat — whatever's left either got deleted
    // or can't be deleted, no point holding onto the IDs.
    global.sentMessages.set(String(chatId), []);

    try {
      await api.deleteMessage(chatId, statusMsg.message_id);
    } catch (_) {}

    return api.sendMessage(chatId, getLang("done", deleted, failed), {
      parse_mode: "Markdown",
    });
  },
};
