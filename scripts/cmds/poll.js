"use strict";

module.exports = {
  config: {
    name:      "poll",
    aliases:   ["vote"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "utility",
    countDown: 10,
    description: { en: "Create a native Telegram poll" },
    guide: {
      en:
        "{pn} <question> | <opt1> | <opt2> [| opt3 ...]\n" +
        "Example: {pn} Best language? | Python | JavaScript | Go",
    },
  },

  langs: {
    en: {
      noArgs:    "❌ Usage: `/poll Question? | Option 1 | Option 2`",
      tooFew:    "❌ Need at least 2 options.",
      tooMany:   "❌ Maximum 10 options.",
      notGroup:  "❌ Polls only work in groups.",
    },
  },

  onStart: async function ({ api, event, message, args, getLang }) {
    if (!event.isGroup) return message.reply(getLang("notGroup"));

    const fullText = args.join(" ");
    const parts    = fullText.split("|").map(s => s.trim()).filter(Boolean);

    if (parts.length < 3) return message.reply(getLang("noArgs"));

    const question = parts[0];
    const options  = parts.slice(1);

    if (options.length < 2)  return message.reply(getLang("tooFew"));
    if (options.length > 10) return message.reply(getLang("tooMany"));

    await api.sendPoll(event.threadID, question, options, {
      is_anonymous: false,
      allows_multiple_answers: false,
    });
  },
};
