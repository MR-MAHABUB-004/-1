"use strict";

const CHOICES  = ["rock", "paper", "scissors"];
const EMOJI    = { rock: "🪨", paper: "📄", scissors: "✂️" };
const BEATS    = { rock: "scissors", paper: "rock", scissors: "paper" };

module.exports = {
  config: {
    name:      "rps",
    aliases:   ["rockpaperscissors"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "game",
    countDown: 3,
    description: { en: "Play rock-paper-scissors against the bot" },
    guide:       { en: "{pn} <rock|paper|scissors>" },
  },

  langs: {
    en: {
      invalid: "❌ Choose: `rock`, `paper`, or `scissors`.",
      win:     "🎉 You win! %1 beats %2.",
      lose:    "😔 You lose! %1 beats %2.",
      tie:     "🤝 It's a tie! We both chose %1.",
      header:  "🎮 *Rock Paper Scissors*\n👤 You: %1\n🤖 Bot: %2\n\n",
    },
  },

  onStart: async function ({ message, args, getLang }) {
    const choice = args[0]?.toLowerCase();
    if (!CHOICES.includes(choice)) return message.reply(getLang("invalid"));

    const bot    = CHOICES[Math.floor(Math.random() * 3)];
    const header = getLang("header")
      .replace("%1", `${EMOJI[choice]} ${choice}`)
      .replace("%2", `${EMOJI[bot]} ${bot}`);

    if (choice === bot) {
      return message.reply(header + getLang("tie").replace("%1", choice));
    }
    if (BEATS[choice] === bot) {
      return message.reply(header + getLang("win").replace("%1", EMOJI[choice] + " " + choice).replace("%2", EMOJI[bot] + " " + bot));
    }
    return message.reply(header + getLang("lose").replace("%1", EMOJI[bot] + " " + bot).replace("%2", EMOJI[choice] + " " + choice));
  },
};
