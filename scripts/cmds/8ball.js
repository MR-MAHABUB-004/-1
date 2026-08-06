"use strict";

const ANSWERS = [
  // Positive
  "✅ It is certain.", "✅ Without a doubt.", "✅ Yes, definitely!",
  "✅ You may rely on it.", "✅ Most likely.", "✅ Signs point to yes.",
  // Neutral
  "🔮 Reply hazy, try again.", "🔮 Ask again later.", "🔮 Better not tell you now.",
  "🔮 Cannot predict now.", "🔮 Concentrate and ask again.",
  // Negative
  "❌ Don't count on it.", "❌ My reply is no.", "❌ My sources say no.",
  "❌ Outlook not so good.", "❌ Very doubtful.",
];

module.exports = {
  config: {
    name:      "8ball",
    aliases:   ["eightball", "ball"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "fun",
    countDown: 3,
    description: { en: "Ask the magic 8-ball a yes/no question" },
    guide:       { en: "{pn} <question>" },
  },

  langs: {
    en: {
      noQ:  "❌ Ask me a question!",
      resp: "🎱 *Question:* %1\n\n🔮 *Answer:* %2",
    },
  },

  onStart: async function ({ message, args, getLang }) {
    const question = args.join(" ").trim();
    if (!question) return message.reply(getLang("noQ"));

    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
    return message.reply(
      getLang("resp").replace("%1", question).replace("%2", answer)
    );
  },
};
