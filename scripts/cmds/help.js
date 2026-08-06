"use strict";

/**
 * scripts/cmds/help.js
 * Lists all commands or shows detail for one command.
 * Fully mirrors GoatBot V2 help.js behaviour.
 */

module.exports = {
  config: {
    name:      "help",
    aliases:   ["h", "cmds"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "info",
    countDown: 3,
    description: {
      en: "View all commands or get detailed info about one command",
    },
    guide: {
      en: "{pn} — list all commands\n{pn} <command> — info about a command\n{pn} -<category> — filter by category",
    },
  },

  langs: {
    en: {
      noCmd:        "❌ Command \"%1\" not found.",
      noCategory:   "❌ No commands found in category \"%1\".",
      headerAll:    "📋 *{botName} — Command List*\n🔑 Prefix: `{prefix}` | Total: {total}",
      headerCat:    "📂 *Category: {category}*",
      footer:       "\n💡 Use `{prefix}help <cmd>` for details.",
      detailHeader: "📖 *Command: {name}*",
    },
  },

  onStart: async function ({ api, event, message, args, role, getLang, prefix }) {
    const { commands, aliases, config: botConfig } = global.GoatBot;
    const arg = (args[0] || "").toLowerCase();

    // ── No argument → full command list ──────────────────────────────────────
    if (!arg) {
      // Group by category
      const categories = {};
      for (const [name, cmd] of commands) {
        if ((cmd.config.role || 0) > role) continue;
        const cat = (cmd.config.category || "other").toLowerCase();
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(name);
      }

      const header = getLang("headerAll")
        .replace("{botName}", botConfig.botName)
        .replace("{prefix}", prefix)
        .replace("{total}", commands.size);

      const body = Object.entries(categories)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cat, names]) =>
          `\n📁 *${cat.toUpperCase()}*\n` +
          names.sort().map(n => `  ┣ \`${prefix}${n}\``).join("\n")
        ).join("\n");

      const footer = getLang("footer").replace("{prefix}", prefix);

      return message.reply(header + body + footer);
    }

    // ── -category filter ─────────────────────────────────────────────────────
    if (arg.startsWith("-")) {
      const category = arg.slice(1);
      const matched  = [...commands.entries()]
        .filter(([, cmd]) =>
          cmd.config?.category?.toLowerCase() === category &&
          (cmd.config.role || 0) <= role
        )
        .map(([n]) => `  ┣ \`${prefix}${n}\``);

      if (!matched.length) {
        return message.reply(getLang("noCategory").replace("%1", category));
      }

      const hdr = getLang("headerCat").replace("{category}", category.toUpperCase());
      return message.reply(hdr + "\n" + matched.join("\n"));
    }

    // ── Specific command lookup ───────────────────────────────────────────────
    const cmdName = aliases.get(arg) || arg;
    const cmd     = commands.get(cmdName);

    if (!cmd || (cmd.config.role || 0) > role) {
      return message.reply(getLang("noCmd").replace("%1", arg));
    }

    const info    = cmd.config;
    const desc    = info.description?.en || "No description.";
    const guide   = (info.guide?.en || "No usage info.")
      .replace(/{pn}/g, `${prefix}${info.name}`)
      .replace(/{p}/g, prefix);
    const roleMap = { 0: "Everyone", 1: "Group Admin", 2: "Bot Admin" };
    const aliasList = info.aliases?.length ? info.aliases.join(", ") : "None";

    return message.reply(
      `📖 *Command: ${info.name}*\n` +
      `📝 *Description:* ${desc}\n` +
      `🔗 *Aliases:* ${aliasList}\n` +
      `📂 *Category:* ${info.category || "other"}\n` +
      `👤 *Permission:* ${roleMap[info.role || 0]}\n` +
      `⏱ *Cooldown:* ${info.countDown ?? 3}s\n` +
      `📌 *Usage:*\n${guide}`
    );
  },
};
