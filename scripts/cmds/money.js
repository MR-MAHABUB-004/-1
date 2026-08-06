"use strict";

const DAILY_AMOUNT  = 500;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

module.exports = {
  config: {
    name:      "money",
    aliases:   ["bal", "balance", "daily", "give", "pay"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "economy",
    countDown: 3,
    description: { en: "Economy system — check balance, claim daily reward, give money" },
    guide: {
      en:
        "{pn} — check your balance\n" +
        "{pn} daily — claim daily reward\n" +
        "{pn} give <amount> (reply) — send money to another user\n" +
        "{pn} top — richest users leaderboard",
    },
  },

  langs: {
    en: {
      balance:      "💰 *Balance*\n👤 %1\n💵 Money: **%2** coins\n⭐ EXP: %3",
      dailyClaimed: "🎁 Daily reward claimed!\n+%1 coins added.\n💰 New balance: %2 coins\n⏰ Next claim in 24 hours.",
      dailyWait:    "⏳ You already claimed your daily reward.\nNext claim in: **%1**.",
      giveNoTarget: "❌ Reply to a user's message to give them money.",
      giveSelf:     "❌ You can't give money to yourself.",
      giveNoAmount: "❌ Specify a valid amount greater than 0.",
      giveNoFunds:  "❌ Insufficient funds. Your balance: **%1** coins.",
      giveSuccess:  "✅ Sent **%1** coins to %2.\n💰 Your new balance: %3 coins.",
      topHeader:    "💰 *Top 10 Richest Users*\n\n",
      topRow:       "%1. %2 — 💵 %3 coins",
      noUsers:      "No economy data yet.",
    },
  },

  onStart: async function ({ event, message, args, getLang, usersData }) {
    const msg      = event.raw;
    const senderId = event.senderID;
    const subCmd   = args[0]?.toLowerCase();

    const sender = usersData.getOrCreate(senderId, {
      name: `${msg.from.first_name || ""}`.trim(),
    });

    // ── balance (default) ────────────────────────────────────────────────────
    if (!subCmd || subCmd === "bal" || subCmd === "balance") {
      return message.reply(
        getLang("balance")
          .replace("%1", sender.name || `User ${senderId}`)
          .replace("%2", (sender.money || 0).toLocaleString())
          .replace("%3", sender.exp   || 0)
      );
    }

    // ── daily ─────────────────────────────────────────────────────────────────
    if (subCmd === "daily") {
      const lastDaily = sender.lastDaily || 0;
      const now       = Date.now();
      const remaining = DAILY_COOLDOWN_MS - (now - lastDaily);

      if (remaining > 0) {
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        return message.reply(getLang("dailyWait").replace("%1", `${h}h ${m}m`));
      }

      const newBalance = (sender.money || 0) + DAILY_AMOUNT;
      usersData.update(senderId, { money: newBalance, lastDaily: now });

      return message.reply(
        getLang("dailyClaimed")
          .replace("%1", DAILY_AMOUNT.toLocaleString())
          .replace("%2", newBalance.toLocaleString())
      );
    }

    // ── give / pay ────────────────────────────────────────────────────────────
    if (subCmd === "give" || subCmd === "pay") {
      if (!event.messageReply) return message.reply(getLang("giveNoTarget"));

      const targetId = String(msg.reply_to_message.from.id);
      if (targetId === senderId) return message.reply(getLang("giveSelf"));

      const amount = parseInt(args[1] || args[0] === "give" ? args[1] : args[0], 10);
      if (!amount || amount <= 0) return message.reply(getLang("giveNoAmount"));

      if ((sender.money || 0) < amount) {
        return message.reply(getLang("giveNoFunds").replace("%1", (sender.money || 0).toLocaleString()));
      }

      const target     = usersData.getOrCreate(targetId, {
        name: `${msg.reply_to_message.from.first_name || ""}`.trim(),
      });
      const newSender  = (sender.money  || 0) - amount;
      const newTarget  = (target.money  || 0) + amount;

      usersData.update(senderId, { money: newSender });
      usersData.update(targetId, { money: newTarget });

      return message.reply(
        getLang("giveSuccess")
          .replace("%1", amount.toLocaleString())
          .replace("%2", target.name || `User ${targetId}`)
          .replace("%3", newSender.toLocaleString())
      );
    }

    // ── top leaderboard ───────────────────────────────────────────────────────
    if (subCmd === "top") {
      const all = Object.values(usersData.getAll());
      if (!all.length) return message.reply(getLang("noUsers"));

      const sorted = all.sort((a, b) => (b.money || 0) - (a.money || 0)).slice(0, 10);
      const rows   = sorted.map((u, i) =>
        getLang("topRow")
          .replace("%1", i + 1)
          .replace("%2", u.name || `User ${u.id}`)
          .replace("%3", (u.money || 0).toLocaleString())
      ).join("\n");

      return message.reply(getLang("topHeader") + rows);
    }

    // Fallback — show balance
    return message.reply(
      getLang("balance")
        .replace("%1", sender.name || `User ${senderId}`)
        .replace("%2", (sender.money || 0).toLocaleString())
        .replace("%3", sender.exp   || 0)
    );
  },
};
