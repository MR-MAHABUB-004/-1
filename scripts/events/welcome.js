"use strict";

module.exports = {
  config: {
    name:      "welcome",
    version:   "1.0",
    author:    "System",
    category:  "events",
    eventType: "join",      // only fires on new_chat_members
  },

  langs: {
    en: {
      defaultMsg: "👋 Welcome *%1* to *%2*!\nUse `%3help` to see available commands.",
      botAdded:   "👋 Thanks for adding me to *%1*!\nPrefix: `%2` | Use `%2help` to get started.",
    },
  },

  onStart: async function ({ api, event, message, threadsData, getLang }) {
    const msg      = event.raw;
    const chatId   = msg.chat.id;
    const chatTitle = msg.chat.title || "this group";
    const thread   = threadsData.getOrCreate(String(chatId));
    const prefix   = thread.prefix || global.GoatBot.config.prefix;

    for (const member of event.newMembers || []) {
      // Bot was added
      if (member.is_bot && member.id === (await api.getMe()).id) {
        const botMsg = getLang("botAdded")
          .replace("%1", chatTitle)
          .replace("%2", prefix);
        await message.send(botMsg, chatId);
        continue;
      }

      // Human joined
      const name     = `${member.first_name || ""} ${member.last_name || ""}`.trim();
      const custom   = thread.welcomeMsg;

      const text = custom
        ? custom
            .replace("{userName}", name)
            .replace("{boxName}", chatTitle)
            .replace("{prefix}", prefix)
        : getLang("defaultMsg")
            .replace("%1", name)
            .replace("%2", chatTitle)
            .replace("%3", prefix);

      await message.send(text, chatId);
    }
  },
};
