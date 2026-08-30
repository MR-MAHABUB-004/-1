"use strict";

const axios = require("axios");

const API_BASE = "https://mahabub-apis.onrender.com/mahabub/simsimi";

// ── Fetch a random unanswered question from API ───────────────────────────────
async function getRandomQuestion() {
  try {
    const res = await axios.get(API_BASE, {
      params: { action: "next" },
      timeout: 15000,
    });

    const data = res.data;
    // Be tolerant of slightly different field names in the response.
    return (
      (data && (data.question || data.ques || data.q)) || null
    );
  } catch (e) {
    console.error("NT getRandomQuestion error:", e.message);
    return null;
  }
}

async function teach(question, answer) {
  return axios.get(API_BASE, {
    params: { action: "teach", q: question, ans: answer },
    timeout: 15000,
  });
}

const ANSWER_TIMEOUT_MS = 60 * 1000;

// If nobody answers a question within ANSWER_TIMEOUT_MS, unsend it so the
// chat doesn't fill up with stale unanswered prompts.
function scheduleQuestionTimeout(api, chatId, msgId) {
  setTimeout(async () => {
    try {
      await api.deleteMessage(chatId, msgId);
    } catch (_) {
      // Already answered/deleted, or too old to delete — fine either way.
    }
  }, ANSWER_TIMEOUT_MS);
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  config: {
    name:      "nt",
    aliases:   ["newteach", "teach"],
    version:   "4.2.0",
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

  onStart: async function ({ api, event, message, args, getLang, setPendingReply, usersData }) {
    const text = args.join(" ").trim();

    try {
      // ── Manual teach: nt ask=Q$ans=A or ask=Q&ans=A ───────────────────────
      if (text.startsWith("ask=") && (text.includes("$ans=") || text.includes("&ans="))) {
        const match = text.match(/ask=(.+?)(?:\$ans=|&ans=)(.+)/);
        if (!match) return message.reply(getLang("badFormat"));

        const question = match[1].trim();
        const answer   = match[2].trim();
        if (!question || !answer) return message.reply(getLang("missingQA"));

        await teach(question, answer);

        return message.reply(
          getLang("taught").replace("%1", question).replace("%2", answer)
        );
      }

      // ── Random question mode ───────────────────────────────────────────────
      const question = await getRandomQuestion();
      if (!question) return message.reply(getLang("noQuestion"));

      const sent = await message.reply(getLang("question").replace("%1", question));

      // Register onReply — fires only when the user Telegram-replies to
      // this specific question message (see core/handleMessage.js).
      if (sent) {
        setPendingReply("nt", {
          author:    event.senderID,
          question,
          messageID: sent.message_id,
        });
        scheduleQuestionTimeout(api, event.threadID, sent.message_id);
      }

    } catch (e) {
      console.error("nt onStart error:", e.message);
      return message.reply(getLang("error"));
    }
  },

  onReply: async function ({ api, event, message, getLang, pendingData, setPendingReply, usersData }) {
    // Only the user who triggered the question can answer
    if (pendingData.author !== event.senderID) return;

    const answer = event.body?.trim();
    if (!answer) return;

    const chatId = event.threadID;

    try {
      // Save the answer to the API
      await teach(pendingData.question, answer);

      // Reward the user with money (usersData methods are async — must await!)
      const user = await usersData.getOrCreate(event.senderID);
      const updatedUser = await usersData.update(event.senderID, {
        money: (user.money || 0) + 100,
      });
      const name = user.name || `User ${event.senderID}`;

      // The question has now been answered — clear it out of the chat
      // instead of letting it (and the 60s timer scheduled for it) linger.
      // Deleting twice (here and from the timer) is harmless — the second
      // call just fails silently.
      if (pendingData.messageID) {
        try {
          await api.deleteMessage(chatId, pendingData.messageID);
        } catch (_) {}
      }

      const savedMsg = await message.reply(
        getLang("saved")
          .replace("%1", pendingData.question)
          .replace("%2", answer)
          .replace("%3", (updatedUser.money || 0).toLocaleString())
          .replace("%4", name)
      );

      // Immediately serve the next question and keep the chain going
      const nextQuestion = await getRandomQuestion();
      if (!nextQuestion) return;

      const sent = await message.reply(getLang("question").replace("%1", nextQuestion));

      if (sent) {
        setPendingReply("nt", {
          author:    event.senderID,
          question:  nextQuestion,
          messageID: sent.message_id,
        });
        scheduleQuestionTimeout(api, chatId, sent.message_id);
      }

      // Clean up the "✅ Reply saved!" confirmation shortly after, so the
      // chat doesn't pile up with old confirmations.
      if (savedMsg) {
        setTimeout(async () => {
          try {
            await api.deleteMessage(chatId, savedMsg.message_id);
          } catch (_) {}
        }, 4000);
      }

    } catch (e) {
      console.error("nt onReply error:", e.message);
      return message.reply(getLang("error"));
    }
  },
};
