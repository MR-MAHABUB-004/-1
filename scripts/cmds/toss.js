"use strict";

module.exports = {
  config: {
    name:      "toss",
    aliases:   ["coin", "flip", "dice", "roll"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "game",
    countDown: 2,
    description: { en: "Flip a coin or roll a dice" },
    guide: {
      en:
        "{pn}         — flip a coin\n" +
        "{pn} dice     — roll a 6-sided dice\n" +
        "{pn} dice 20  — roll a custom-sided dice (e.g. d20)\n" +
        "{pn} bet <amount> heads/tails — bet money on coin flip",
    },
  },

  langs: {
    en: {
      heads:    "🪙 *Coin Flip* — **Heads!**",
      tails:    "🪙 *Coin Flip* — **Tails!**",
      dice:     "🎲 *Dice Roll* (d%1) — **%2!**",
      betWin:   "🪙 *Coin Flip* — **%1!**\n\n✅ You won! +%2 coins\n💰 Balance: %3 coins",
      betLose:  "🪙 *Coin Flip* — **%1!**\n\n❌ You lost! -%2 coins\n💰 Balance: %3 coins",
      betNoFunds: "❌ Insufficient funds. Your balance: %1 coins.",
      betBadAmt:  "❌ Bet amount must be greater than 0.",
      betBadSide: "❌ Choose `heads` or `tails`.",
    },
  },

  onStart: async function ({ event, message, args, getLang, usersData }) {
    const msg    = event.raw;
    const sub    = args[0]?.toLowerCase();

    // ── Dice roll ─────────────────────────────────────────────────────────────
    if (sub === "dice" || sub === "roll") {
      const sides = parseInt(args[1]) || 6;
      const capped = Math.min(Math.max(sides, 2), 1000);
      const result = Math.floor(Math.random() * capped) + 1;
      return message.reply(
        getLang("dice").replace("%1", capped).replace("%2", result)
      );
    }

    // ── Bet ───────────────────────────────────────────────────────────────────
    if (sub === "bet") {
      const amount = parseInt(args[1]);
      const side   = args[2]?.toLowerCase();

      if (!amount || amount <= 0) return message.reply(getLang("betBadAmt"));
      if (!["heads","tails"].includes(side)) return message.reply(getLang("betBadSide"));

      const userId = event.senderID;
      const user   = usersData.getOrCreate(userId, {
        name: `${msg.from.first_name || ""}`.trim(),
      });

      if ((user.money || 0) < amount) {
        return message.reply(getLang("betNoFunds").replace("%1", (user.money || 0).toLocaleString()));
      }

      const outcome = Math.random() < 0.5 ? "heads" : "tails";
      const won     = outcome === side;
      const newBal  = (user.money || 0) + (won ? amount : -amount);
      usersData.set(userId, "money", newBal);

      const outcomeLabel = outcome.charAt(0).toUpperCase() + outcome.slice(1);
      if (won) {
        return message.reply(
          getLang("betWin")
            .replace("%1", outcomeLabel)
            .replace("%2", amount.toLocaleString())
            .replace("%3", newBal.toLocaleString())
        );
      } else {
        return message.reply(
          getLang("betLose")
            .replace("%1", outcomeLabel)
            .replace("%2", amount.toLocaleString())
            .replace("%3", newBal.toLocaleString())
        );
      }
    }

    // ── Simple coin flip ─────────────────────────────────────────────────────
    const result = Math.random() < 0.5 ? "heads" : "tails";
    return message.reply(getLang(result));
  },
};
