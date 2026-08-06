"use strict";

module.exports = {
  config: {
    name:      "badwords",
    aliases:   ["bw", "filter"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "admin",
    countDown: 5,
    description: { en: "Manage the bad-word filter for this group" },
    guide: {
      en:
        "{pn} on/off          — enable/disable filter\n" +
        "{pn} add <word> ...  — add words to the list\n" +
        "{pn} remove <word>   — remove a word\n" +
        "{pn} list            — show all banned words\n" +
        "{pn} clear           — clear all banned words\n" +
        "{pn} action <delete|warn|both> — set enforcement action",
    },
  },

  langs: {
    en: {
      notGroup:   "❌ Only usable in groups.",
      on:         "✅ Bad-word filter *enabled*.",
      off:        "🔴 Bad-word filter *disabled*.",
      added:      "✅ Added %1 word(s) to the filter.",
      removed:    "✅ Removed `%1` from the filter.",
      notFound:   "❌ `%1` is not in the list.",
      cleared:    "✅ Filter list cleared.",
      listHeader: "🚫 *Banned Words (%1 total)*\n\n",
      listEmpty:  "📭 No banned words set.",
      actionSet:  "✅ Filter action set to `%1`.",
      badAction:  "❌ Action must be: `delete`, `warn`, or `both`.",
      status:     "⚙️ *Bad-word filter*\nEnabled: %1\nWords: %2\nAction: %3",
    },
  },

  onStart: async function ({ event, message, args, getLang, threadsData }) {
    if (!event.isGroup) return message.reply(getLang("notGroup"));

    const chatId = event.threadID;
    const thread = threadsData.getOrCreate(chatId);
    const words  = Array.isArray(thread.badwords) ? [...thread.badwords] : [];
    const sub    = args[0]?.toLowerCase();

    // ── Status (no args) ─────────────────────────────────────────────────────
    if (!sub) {
      return message.reply(
        getLang("status")
          .replace("%1", thread.badwordsEnabled ? "Yes" : "No")
          .replace("%2", words.length)
          .replace("%3", thread.badwordsAction || "both")
      );
    }

    // ── on / off ──────────────────────────────────────────────────────────────
    if (sub === "on")  { threadsData.set(chatId, "badwordsEnabled", true);  return message.reply(getLang("on")); }
    if (sub === "off") { threadsData.set(chatId, "badwordsEnabled", false); return message.reply(getLang("off")); }

    // ── add ───────────────────────────────────────────────────────────────────
    if (sub === "add") {
      const newWords = args.slice(1).map(w => w.toLowerCase()).filter(w => w && !words.includes(w));
      if (!newWords.length) return message.reply("❌ Provide at least one new word.");
      const updated = [...words, ...newWords];
      threadsData.set(chatId, "badwords", updated);
      return message.reply(getLang("added").replace("%1", newWords.length));
    }

    // ── remove ────────────────────────────────────────────────────────────────
    if (sub === "remove" && args[1]) {
      const word = args[1].toLowerCase();
      if (!words.includes(word)) return message.reply(getLang("notFound").replace("%1", word));
      threadsData.set(chatId, "badwords", words.filter(w => w !== word));
      return message.reply(getLang("removed").replace("%1", word));
    }

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === "list") {
      if (!words.length) return message.reply(getLang("listEmpty"));
      return message.reply(
        getLang("listHeader").replace("%1", words.length) +
        words.map((w, i) => `${i + 1}. \`${w}\``).join("\n")
      );
    }

    // ── clear ─────────────────────────────────────────────────────────────────
    if (sub === "clear") {
      threadsData.set(chatId, "badwords", []);
      return message.reply(getLang("cleared"));
    }

    // ── action ────────────────────────────────────────────────────────────────
    if (sub === "action" && args[1]) {
      const act = args[1].toLowerCase();
      if (!["delete","warn","both"].includes(act)) return message.reply(getLang("badAction"));
      threadsData.set(chatId, "badwordsAction", act);
      return message.reply(getLang("actionSet").replace("%1", act));
    }

    return message.reply(`Use \`${global.GoatBot.config.prefix}help badwords\` for usage.`);
  },
};
