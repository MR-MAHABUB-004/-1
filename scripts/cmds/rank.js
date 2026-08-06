"use strict";

module.exports = {
  config: {
    name:      "rank",
    aliases:   ["exp", "level", "profile"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "economy",
    countDown: 5,
    description: { en: "View your rank, EXP and money" },
    guide:       { en: "{pn} — your profile\n{pn} top — leaderboard" },
  },

  langs: {
    en: {
      profile:  "🏅 *Profile*\n👤 Name: %1\n⭐ EXP: %2\n🏆 Level: %3\n💰 Money: %4",
      top:      "🏆 *Top 10 Users*\n\n%1",
      topRow:   "%1. %2 — EXP: %3 | 💰 %4",
      noData:   "No users recorded yet.",
    },
  },

  // Called on every message to add EXP passively
  onChat: async function ({ event, usersData }) {
    if (!event.senderID) return;
    const user = usersData.getOrCreate(event.senderID);
    usersData.update(event.senderID, { exp: (user.exp || 0) + 1 });
  },

  onStart: async function ({ event, message, args, getLang, usersData }) {
    // ── Leaderboard ───────────────────────────────────────────────────────────
    if (args[0] === "top") {
      const all = Object.values(usersData.getAll());
      if (!all.length) return message.reply(getLang("noData"));

      const sorted = all.sort((a, b) => (b.exp || 0) - (a.exp || 0)).slice(0, 10);
      const rows   = sorted.map((u, i) =>
        getLang("topRow")
          .replace("%1", i + 1)
          .replace("%2", u.name || `User ${u.id}`)
          .replace("%3", u.exp || 0)
          .replace("%4", u.money || 0)
      ).join("\n");

      return message.reply(getLang("top").replace("%1", rows));
    }

    // ── Own profile ───────────────────────────────────────────────────────────
    const msg  = event.raw;
    const from = args[0] && event.messageReply
      ? msg.reply_to_message.from
      : msg.from;

    const user  = usersData.getOrCreate(String(from.id));
    const exp   = user.exp || 0;
    const level = Math.floor(Math.sqrt(exp / 10));
    const name  = user.name || `${from.first_name || ""}`.trim();

    return message.reply(
      getLang("profile")
        .replace("%1", name)
        .replace("%2", exp)
        .replace("%3", level)
        .replace("%4", user.money || 0)
    );
  },
};
