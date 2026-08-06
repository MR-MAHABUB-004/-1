"use strict";

// Active reminders stored in memory
// { id, chatId, userId, text, fireAt, timeoutHandle }
const reminders = new Map();
let nextId = 1;

function parseTime(str) {
  // Parses strings like "10s", "5m", "2h", "1d"
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * multipliers[unit];
}

module.exports = {
  config: {
    name:      "remind",
    aliases:   ["reminder", "remindme"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "utility",
    countDown: 3,
    description: { en: "Set a personal reminder" },
    guide: {
      en:
        "{pn} <time> <message> — set a reminder\n" +
        "{pn} list — see your active reminders\n" +
        "{pn} cancel <id> — cancel a reminder\n" +
        "Time units: s=seconds, m=minutes, h=hours, d=days\n" +
        "Example: {pn} 30m Buy groceries",
    },
  },

  langs: {
    en: {
      noArgs:    "❌ Provide a time and message. Example: `/remind 10m Call mom`",
      badTime:   "❌ Invalid time format. Use: 10s, 5m, 2h, 1d",
      tooShort:  "❌ Minimum reminder time is 10 seconds.",
      tooLong:   "❌ Maximum reminder time is 7 days.",
      set:       "⏰ Reminder set! I'll ping you in *%1*.\nID: `#%2`",
      fire:      "⏰ *Reminder* for %1\n\n📝 %2",
      noList:    "📭 You have no active reminders.",
      listHeader: "⏰ *Your Reminders*\n",
      listRow:   "#%1 — in %2 → %3",
      cancelled: "✅ Reminder `#%1` cancelled.",
      notFound:  "❌ Reminder `#%1` not found or not yours.",
    },
  },

  onStart: async function ({ api, event, message, args, getLang }) {
    const userId = event.senderID;
    const chatId = event.threadID;
    const sub    = args[0]?.toLowerCase();

    // ── list ──────────────────────────────────────────────────────────────────
    if (sub === "list") {
      const mine = [...reminders.values()].filter(r => r.userId === userId);
      if (!mine.length) return message.reply(getLang("noList"));

      const rows = mine.map(r => {
        const remaining = Math.max(0, r.fireAt - Date.now());
        const s = Math.ceil(remaining / 1000);
        const timeStr = s > 3600
          ? `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`
          : s > 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`;
        return getLang("listRow")
          .replace("%1", r.id)
          .replace("%2", timeStr)
          .replace("%3", r.text.slice(0, 40));
      }).join("\n");

      return message.reply(getLang("listHeader") + rows);
    }

    // ── cancel ────────────────────────────────────────────────────────────────
    if (sub === "cancel" && args[1]) {
      const id  = parseInt(args[1].replace("#", ""));
      const rem = reminders.get(id);
      if (!rem || rem.userId !== userId) {
        return message.reply(getLang("notFound").replace("%1", id));
      }
      clearTimeout(rem.timeoutHandle);
      reminders.delete(id);
      return message.reply(getLang("cancelled").replace("%1", id));
    }

    // ── set reminder ──────────────────────────────────────────────────────────
    if (!args[0] || !args[1]) return message.reply(getLang("noArgs"));

    const ms = parseTime(args[0]);
    if (ms === null)       return message.reply(getLang("badTime"));
    if (ms < 10000)        return message.reply(getLang("tooShort"));
    if (ms > 604800000)    return message.reply(getLang("tooLong"));

    const text     = args.slice(1).join(" ");
    const id       = nextId++;
    const fireAt   = Date.now() + ms;
    const userName = event.raw.from.first_name || `User ${userId}`;

    // Human-readable time string
    const totalSec = Math.round(ms / 1000);
    const dsp = totalSec >= 86400
      ? `${Math.floor(totalSec/86400)}d ${Math.floor((totalSec%86400)/3600)}h`
      : totalSec >= 3600
      ? `${Math.floor(totalSec/3600)}h ${Math.floor((totalSec%3600)/60)}m`
      : totalSec >= 60
      ? `${Math.floor(totalSec/60)}m ${totalSec%60}s`
      : `${totalSec}s`;

    const handle = setTimeout(async () => {
      reminders.delete(id);
      try {
        await api.sendMessage(chatId,
          getLang("fire").replace("%1", userName).replace("%2", text),
          { parse_mode: "Markdown" }
        );
      } catch {}
    }, ms);

    reminders.set(id, { id, chatId, userId, text, fireAt, timeoutHandle: handle });

    return message.reply(getLang("set").replace("%1", dsp).replace("%2", id));
  },
};
