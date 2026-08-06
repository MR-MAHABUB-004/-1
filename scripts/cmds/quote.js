"use strict";

module.exports = {
  config: {
    name:      "quote",
    aliases:   ["q"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "fun",
    countDown: 5,
    description: { en: "Save a message as a quote and retrieve random ones" },
    guide: {
      en:
        "{pn} (reply) — save the replied message as a quote\n" +
        "{pn} — get a random quote\n" +
        "{pn} list — show all saved quotes (count)\n" +
        "{pn} clear — clear all quotes (admin)",
    },
  },

  langs: {
    en: {
      saved:    "✅ Quote saved! (#%1 total)",
      noReply:  "❌ Reply to a message to save it as a quote.",
      noQuotes: "📭 No quotes saved yet. Reply to a message with `/quote` to save one.",
      quote:    "💬 *Quote #%1*\n\n_%2_\n\n— %3",
      count:    "📚 *%1* quote(s) saved in this chat.",
      cleared:  "✅ All quotes cleared.",
      adminOnly: "❌ Only admins can clear quotes.",
    },
  },

  onStart: async function ({ event, message, args, getLang, role, threadsData }) {
    const chatId = event.threadID;
    const thread = threadsData.getOrCreate(chatId);
    const quotes = Array.isArray(thread.quotes) ? thread.quotes : [];
    const sub    = args[0]?.toLowerCase();

    // ── Save quote ────────────────────────────────────────────────────────────
    if (!sub && event.messageReply) {
      const msg    = event.raw;
      const from   = msg.reply_to_message.from;
      const text   = event.messageReply.body;
      if (!text) return message.reply("❌ That message has no text to quote.");

      quotes.push({
        text,
        author: `${from.first_name || ""}`.trim(),
        date:   Date.now(),
      });
      threadsData.set(chatId, "quotes", quotes);
      return message.reply(getLang("saved").replace("%1", quotes.length));
    }

    // ── Count ─────────────────────────────────────────────────────────────────
    if (sub === "list") {
      return message.reply(getLang("count").replace("%1", quotes.length));
    }

    // ── Clear ─────────────────────────────────────────────────────────────────
    if (sub === "clear") {
      if (role < 1) return message.reply(getLang("adminOnly"));
      threadsData.set(chatId, "quotes", []);
      return message.reply(getLang("cleared"));
    }

    // ── Random quote ──────────────────────────────────────────────────────────
    if (!quotes.length) return message.reply(getLang("noQuotes"));

    const idx = Math.floor(Math.random() * quotes.length);
    const q   = quotes[idx];
    return message.reply(
      getLang("quote")
        .replace("%1", idx + 1)
        .replace("%2", q.text)
        .replace("%3", q.author || "Unknown")
    );
  },
};
