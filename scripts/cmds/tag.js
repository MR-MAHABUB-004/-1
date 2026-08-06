"use strict";

module.exports = {
  config: {
    name:      "tag",
    aliases:   ["tagall", "mention"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "admin",
    countDown: 10,
    description: { en: "Tag all members in the group" },
    guide:       { en: "{pn} <message> — tag everyone with a message" },
  },

  langs: {
    en: {
      notInGroup: "❌ This command only works in groups.",
      noMembers:  "❌ Could not retrieve member list.",
      header:     "📢 *%1*\n\n",
    },
  },

  onStart: async function ({ api, event, message, args, getLang }) {
    if (!event.isGroup) return message.reply(getLang("notInGroup"));

    const chatId = event.raw.chat.id;
    const customMsg = args.join(" ") || "Attention everyone!";

    try {
      const admins = await api.getChatAdministrators(chatId);
      // Telegram doesn't allow fetching all members easily, so we tag admins
      // and show a note. For full tag, store members via join events.
      const mentions = admins
        .filter(m => !m.user.is_bot)
        .map(m => {
          const name = `${m.user.first_name || ""}`.trim();
          return `[${name}](tg://user?id=${m.user.id})`;
        })
        .join(" ");

      if (!mentions) return message.reply(getLang("noMembers"));

      return message.reply(
        getLang("header").replace("%1", customMsg) + mentions
      );
    } catch (e) {
      return message.reply(`❌ Error: ${e.message}`);
    }
  },
};
