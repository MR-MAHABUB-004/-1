"use strict";

module.exports = {
  config: {
    name:      "restart",
    aliases:   ["reboot", "rs"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      2,         // bot admin only
    category:  "admin",
    countDown: 5,
    description: { en: "Restart the bot process" },
    guide:       { en: "{pn}" },
  },

  langs: {
    en: {
      confirm: "🔄 Restarting bot...",
    },
  },

  onStart: async function ({ message, getLang }) {
    await message.reply(getLang("confirm"));
    // index.js auto-restarts on exit code 2
    setTimeout(() => process.exit(2), 500);
  },
};
