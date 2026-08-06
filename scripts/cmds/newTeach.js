"use strict";

const axios = require("axios");

// ── API base (cached) ─────────────────────────────────────────────────────────
let _apiUrl = null;
async function getApiUrl() {
  if (_apiUrl) return _apiUrl;
  const res = await axios.get(
    "https://raw.githubusercontent.com/MR-MAHABUB-004/MAHABUB-BOT-STORAGE/refs/heads/main/APIURL.json"
  );
  _apiUrl = res.data.sim;
  return _apiUrl;
}

// ── Fetch a random unanswered question from API ───────────────────────────────
async function getRandomQuestion() {
  try {
    const apiUrl = await getApiUrl();
    const res    = await axios.get(`${apiUrl}/nt`);
    return res.data?.question || null;
  } catch (e) {
    console.error("NT getRandomQuestion error:", e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  config: {
    name:      "nt",
    aliases:   ["newteach", "teach"],
    version:   "4.1.0",
    author:    "MR᭄﹅ MAHABUB﹅ メꪜ",
    usePrefix: true,
    role:      0,
    category:  "chat",
    countDown: 5,
    description: { en: "Get a random question and teach the bot the answer — earn money!" },
    guide: {
      en:
        "{pn}                      — get a random question to answer\n" +
        "{pn} ask=Q$ans=A          — manually teach a Q&A\n" +
        "{pn} ask=Q&ans=A          — same with & separator",
    },
  },

  langs: {
    en: {
      badFormat:  "❌ Wrong format\nUse:\n`nt ask=Q$ans=A`\nor\n`nt ask=Q&ans=A`",
      missingQA:  "❌ Question or answer is missing.",
      taught:     "✅ Manually taught!\n\n🧠 Question:\n❝ %1 ❞\n\n💬 Answer:\n❝ %2 ❞",
      noQuestion: "❌ No question found from API.",
      question:   "🧠 *Next Question* 🤯\n\n❝ %1 ❞\n\n💬 Reply with your answer",
      saved:      "✅ Reply saved!\n\n🧠 Question:\n❝ %1 ❞\n\n💬 Answer:\n❝ %2 ❞\n\n💰 Reward: +100 Money\n💳 Balance: %3\n\n👤 Teacher: %4",
      error:      "❌ Something went wrong, try again.",
    },
  },

  onStart: async function ({ event, message, args, getLang, setPendingReply, usersData }) {
    const text = args.join(" ").trim();

    try {
      const apiUrl = await getApiUrl();

      // ── Manual teach: nt ask=Q$ans=A or ask=Q&ans=A ───────────────────────
      if (text.startsWith("ask=") && (text.includes("$ans=") || text.includes("&ans="))) {
        const match = text.match(/ask=(.+?)(?:\$ans=|&ans=)(.+)/);
        if (!match) return message.reply(getLang("badFormat"));

        const question = match[1].trim();
        const answer   = match[2].trim();
        if (!question || !answer) return message.reply(getLang("missingQA"));

        await axios.get(
          `${apiUrl}/teach?q=${encodeURIComponent(question)}&ans=${encodeURIComponent(answer)}`
        );

        return message.reply(
          getLang("taught").replace("%1", question).replace("%2", answer)
        );
      }

      // ── Random question mode ───────────────────────────────────────────────
      const question = await getRandomQuestion();
      if (!question) return message.reply(getLang("noQuestion"));

      await message.reply(getLang("question").replace("%1", question));

      // Register onReply — next reply from this user goes to onReply handler
      setPendingReply("nt", {
        author:   event.senderID,
        question,
      });

    } catch (e) {
      console.error("nt onStart error:", e.message);
      return message.reply(getLang("error"));
    }
  },

  onReply: async function ({ event, message, getLang, pendingData, setPendingReply, usersData }) {
    // Only the user who triggered the question can answer
    if (pendingData.author !== event.senderID) return;

    const answer = event.body?.trim();
    if (!answer) return;

    try {
      const apiUrl = await getApiUrl();

      // Save the answer to the API
      await axios.get(
        `${apiUrl}/teach?q=${encodeURIComponent(pendingData.question)}&ans=${encodeURIComponent(answer)}`
      );

      // Reward the user with money
      const user = usersData.getOrCreate(event.senderID);
      usersData.update(event.senderID, { money: (user.money || 0) + 100 });
      const updatedUser = usersData.get(event.senderID);
      const name        = user.name || `User ${event.senderID}`;

      await message.reply(
        getLang("saved")
          .replace("%1", pendingData.question)
          .replace("%2", answer)
          .replace("%3", (updatedUser.money || 0).toLocaleString())
          .replace("%4", name)
      );

      // Immediately serve the next question and keep chain going
      const nextQuestion = await getRandomQuestion();
      if (!nextQuestion) return;

      await message.reply(getLang("question").replace("%1", nextQuestion));

      setPendingReply("nt", {
        author:   event.senderID,
        question: nextQuestion,
      });

    } catch (e) {
      console.error("nt onReply error:", e.message);
      return message.reply(getLang("error"));
    }
  },
};
