"use strict";

const axios = require("axios");

const API_BASE = "https://mahabub-nirob-simisimi.onrender.com";

// ── Add your greetings here ───────────────────────────────────────────────────
const GREETINGS = [
  "𝗵𝗲 𝗯𝗼𝘁 𝗯𝗼𝘁 𝗰𝗵𝗶𝗹𝗹 𝗯𝗿𝗼!",
  "I love you 💝",
  "🌻🌺💚 আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহি ওয়া বারাকাতুহু",
  "কি গো সোনা আমাকে ডাকছ কেনো",
  "আহ শোনা আমার আমাকে এতো ডাকছো কেনো আসো",
  "jang bal falaba 🙂",
  "iss ato dako keno lojja lage to 🫦🙈",
  "suna tomare amar valo lage 🙈😽",
  "Hello there! 👋",
  "What's up? 😊"
];

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  config: {
    name:      "bot",
    aliases:   ["sim", "chat"],
    version:   "3.1",
    author:    "Mahabub",
    usePrefix: false,
    role:      0,
    category:  "fun",
    countDown: 3,
    description: { en: "Chat with Simsimi AI" },
    guide: {
      en:
        "{pn}             — random greeting\n" +
        "{pn} <message>   — chat with the bot",
    },
  },

  langs: {
    en: {
      error: "⚠️ Something went wrong, try again later.",
      typing: "⏳ Thinking...",
    },
  },

  // helper to normalize message id from different platform shapes
  _getMessageIdFromSent(sent) {
    return sent?.messageID ?? sent?.messageId ?? sent?.mid ?? sent?.id ?? null;
  },

  // helper to get reply-to id from an incoming event (platform dependent)
  _getReplyToIdFromEvent(event) {
    const mr = event?.messageReply ?? event?.message_reply ?? event?.replyTo ?? event?.reply_to ?? null;
    if (!mr) return null;
    return mr?.messageID ?? mr?.messageId ?? mr?.mid ?? mr?.id ?? null;
  },

  onStart: async function ({ event, message, args, getLang, setPendingReply }) {
    const uid   = event.senderID;
    const query = args.join(" ").trim();

    // ── /bot (no args) → random greeting ─────────────────────────────────────
    if (!query) {
      try {
        const rand = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
        const sent = await message.reply(rand);

        const messageID = this._getMessageIdFromSent(sent);
        if (sent) setPendingReply("bot", { author: uid, messageID });

      } catch (e) {
        console.error("❌ bot greeting error:", e?.message ?? e);
        return message.reply(getLang("error"));
      }
      return;
    }

    // ── /bot <message> → API response ─────────────────────────────────────────
    try {
      await message.action("typing");

      const res  = await axios.get(`${API_BASE}/ask`, {
        params:  { q: query, uid },
        timeout: 15000,
      });

      const reply = res.data?.reply || res.data || getLang("error");
      const sent  = await message.reply(reply);

      const messageID = this._getMessageIdFromSent(sent);
      if (sent) setPendingReply("bot", { author: uid, messageID });

    } catch (e) {
      console.error("❌ bot error:", e?.message ?? e);
      const errorMsg = e.response?.status === 503 
        ? "API temporarily down, try again later 🌐"
        : getLang("error");
      return message.reply(errorMsg);
    }
  },

  // User replies to bot's message → keep conversation going ───────────────────
  onReply: async function ({ event, message, getLang, pendingData, setPendingReply }) {
    if (!pendingData || pendingData.author !== event.senderID) return;

    if (pendingData.messageID) {
      const incomingReplyToId = this._getReplyToIdFromEvent(event);
      if (!incomingReplyToId || incomingReplyToId !== pendingData.messageID) {
        return;
      }
    }

    const uid   = event.senderID;
    const query = event.body?.trim();
    if (!query) return;

    try {
      await message.action("typing");

      const res   = await axios.get(`${API_BASE}/ask`, {
        params:  { q: query, uid },
        timeout: 15000,
      });

      const reply = res.data?.reply || res.data || getLang("error");
      const sent  = await message.reply(reply);

      const messageID = this._getMessageIdFromSent(sent);
      if (sent) setPendingReply("bot", { author: uid, messageID });

    } catch (e) {
      console.error("❌ bot reply error:", e?.message ?? e);
      const errorMsg = e.response?.status === 503 
        ? "API temporarily down, try again later 🌐"
        : getLang("error");
      return message.reply(errorMsg);
    }
  },
};
