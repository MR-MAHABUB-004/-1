"use strict";

module.exports = {
  config: {
    name:      "cmd",
    aliases:   ["command", "toggle"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "admin",
    countDown: 5,
    description: { en: "Enable or disable commands for this chat" },
    guide: {
      en:
        "{pn} list — show enabled/disabled commands\n" +
        "{pn} off <name> — disable a command in this chat\n" +
        "{pn} on <name>  — re-enable a command in this chat\n" +
        "{pn} off all    — disable ALL non-admin commands\n" +
        "{pn} on all     — enable all commands",
    },
  },

  langs: {
    en: {
      notFound:    "❌ Command `%1` not found.",
      cantDisable: "❌ Cannot disable admin/system commands.",
      turnedOff:   "🔴 Command `%1` disabled in this chat.",
      turnedOn:    "🟢 Command `%1` enabled in this chat.",
      allOff:      "🔴 All non-admin commands disabled in this chat.",
      allOn:       "🟢 All commands enabled in this chat.",
      listHeader:  "⚙️ *Command Status for this chat*\n",
    },
  },

  onStart: async function ({ event, message, args, getLang, threadsData }) {
    if (!event.isGroup) return message.reply("❌ Only usable in groups.");

    const chatId  = event.threadID;
    const thread  = threadsData.getOrCreate(chatId);
    const disabled = Array.isArray(thread.disabledCmds) ? thread.disabledCmds : [];
    const { commands } = global.GoatBot;

    const action  = args[0]?.toLowerCase();
    const target  = args[1]?.toLowerCase();

    // ── list ──────────────────────────────────────────────────────────────────
    if (!action || action === "list") {
      const rows = [...commands.entries()].map(([name, cmd]) => {
        const isOff = disabled.includes(name);
        const role  = cmd.config.role || 0;
        return `${isOff ? "🔴" : "🟢"} \`${name}\`${role > 0 ? " _(admin)_" : ""}`;
      }).join("\n");

      return message.reply(getLang("listHeader") + rows);
    }

    const PROTECTED = ["cmd", "help", "reload", "thread", "prefix", "broadcast"];

    // ── on/off all ────────────────────────────────────────────────────────────
    if (target === "all") {
      if (action === "off") {
        const toDisable = [...commands.keys()].filter(n => !PROTECTED.includes(n));
        threadsData.set(chatId, "disabledCmds", toDisable);
        return message.reply(getLang("allOff"));
      }
      if (action === "on") {
        threadsData.set(chatId, "disabledCmds", []);
        return message.reply(getLang("allOn"));
      }
    }

    // ── on/off <name> ─────────────────────────────────────────────────────────
    if (!target) return message.reply(`Usage: \`${global.GoatBot.config.prefix}cmd ${action} <name>\``);

    if (!commands.has(target)) {
      return message.reply(getLang("notFound").replace("%1", target));
    }

    if (PROTECTED.includes(target)) {
      return message.reply(getLang("cantDisable"));
    }

    if (action === "off") {
      if (!disabled.includes(target)) disabled.push(target);
      threadsData.set(chatId, "disabledCmds", disabled);
      return message.reply(getLang("turnedOff").replace("%1", target));
    }

    if (action === "on") {
      threadsData.set(chatId, "disabledCmds", disabled.filter(n => n !== target));
      return message.reply(getLang("turnedOn").replace("%1", target));
    }

    return message.reply(`Use \`${global.GoatBot.config.prefix}help cmd\` for usage.`);
  },
};
