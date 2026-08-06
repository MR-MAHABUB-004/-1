"use strict";

/**
 * scripts/cmds/guessnumber.js
 * Demonstrates onReply — a multi-turn command that waits for user replies.
 */

// In-memory game store: "chatId:userId" → { target, attempts }
const games = new Map();

module.exports = {
  config: {
    name:      "guessnumber",
    aliases:   ["guess", "gn"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "game",
    countDown: 3,
    description: { en: "Guess a random number between 1 and 100" },
    guide:       { en: "{pn} — start a new game" },
  },

  langs: {
    en: {
      start:    "🎮 I'm thinking of a number between 1 and 100.\nReply with your guess!",
      tooHigh:  "📈 Too high! Try lower. (Attempt %1)",
      tooLow:   "📉 Too low! Try higher. (Attempt %1)",
      correct:  "🎉 Correct! The number was *%1*.\nYou got it in *%2 attempts*!",
      notNum:   "❌ Please reply with a valid number.",
      alreadyOn: "⚠️ You already have a game running. Reply with your guess!",
    },
  },

  onStart: async function ({ event, message, getLang, setPendingReply }) {
    const key = `${event.threadID}:${event.senderID}`;
    if (games.has(key)) {
      return message.reply(getLang("alreadyOn"));
    }

    const target = Math.floor(Math.random() * 100) + 1;
    games.set(key, { target, attempts: 0 });

    // Tell the framework to route the next reply from this user to onReply
    setPendingReply("guessnumber", { key });

    return message.reply(getLang("start"));
  },

  onReply: async function ({ event, message, getLang, setPendingReply, pendingData }) {
    const key  = pendingData.key || `${event.threadID}:${event.senderID}`;
    const game = games.get(key);
    if (!game) return;

    const guess = parseInt(event.body.trim(), 10);
    if (isNaN(guess)) {
      setPendingReply("guessnumber", { key }); // keep waiting
      return message.reply(getLang("notNum"));
    }

    game.attempts++;

    if (guess > game.target) {
      setPendingReply("guessnumber", { key });
      return message.reply(getLang("tooHigh").replace("%1", game.attempts));
    }
    if (guess < game.target) {
      setPendingReply("guessnumber", { key });
      return message.reply(getLang("tooLow").replace("%1", game.attempts));
    }

    // Correct
    games.delete(key);
    return message.reply(
      getLang("correct")
        .replace("%1", game.target)
        .replace("%2", game.attempts)
    );
  },
};
