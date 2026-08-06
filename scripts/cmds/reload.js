"use strict";

module.exports = {
  config: {
    name:      "reload",
    aliases:   ["rl"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      2,           // bot admin only
    category:  "admin",
    countDown: 5,
    description: { en: "Hot-reload all commands and events without restarting" },
    guide:       { en: "{pn} — reload all\n{pn} <cmdname> — reload one command" },
  },

  langs: {
    en: {
      reloading: "🔄 Reloading...",
      done:      "✅ Reloaded %1 commands and %2 events.",
      cmdDone:   "✅ Reloaded command: `%1`",
      cmdFail:   "❌ Failed to reload `%1`: %2",
      notFound:  "❌ Command `%1` not found.",
    },
  },

  onStart: async function ({ message, args, getLang }) {
    const { loadCommands } = require("../../core/loadCommands.js");
    const { loadEvents }   = require("../../core/loadEvents.js");
    const { commands, eventCommands, aliases, onChat } = global.GoatBot;

    await message.reply(getLang("reloading"));

    if (args[0]) {
      // Reload a single command
      const name = args[0].toLowerCase();
      const path = require("path");
      const fs   = require("fs");
      const dir  = path.join(__dirname);
      const file = fs.readdirSync(dir).find(f =>
        f.toLowerCase() === `${name}.js`
      );

      if (!file) return message.reply(getLang("notFound").replace("%1", name));

      try {
        const fp = path.join(dir, file);
        delete require.cache[require.resolve(fp)];
        const cmd = require(fp);
        commands.set(cmd.config.name.toLowerCase(), cmd);
        if (cmd.config.aliases) {
          for (const a of cmd.config.aliases) aliases.set(a.toLowerCase(), cmd.config.name);
        }
        return message.reply(getLang("cmdDone").replace("%1", name));
      } catch (e) {
        return message.reply(getLang("cmdFail").replace("%1", name).replace("%2", e.message));
      }
    }

    // Full reload
    commands.clear();
    eventCommands.clear();
    aliases.clear();
    onChat.length = 0;

    loadCommands();
    loadEvents();

    return message.reply(
      getLang("done")
        .replace("%1", commands.size)
        .replace("%2", eventCommands.size)
    );
  },
};
