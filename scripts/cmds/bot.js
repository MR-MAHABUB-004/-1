"use strict";

const axios = require("axios");

const API_BASE = "https://mahabub-nirob-simisimi.onrender.com";

// ── Add your greetings here ───────────────────────────────────────────────────
const GREETINGS = [
  "𝗵𝗲 𝗯𝗼𝘁 𝗯𝗼𝘁 𝗰𝗵𝗶𝗹𝗹 𝗯𝗿𝗼!","I love you 💝", "🌻🌺💚-আসসালামু আলাইকুম ওয়া রাহমাতুল্লা[...]"
  " কি গো সোনা আমাকে ডাকছ কেনো","আহ শোনা আমার আমাকে এতো ডাক্তাছো কেনো আসো বুকে আ��[...]"
  "jang bal falaba🙂","iss ato dako keno lojja lage to 🫦🙈", "suna tomare amar valo lage,🙈😽",
  // add more below ↓
];

// ──────────────────────────────────────────────────────────────────────────────

module.exports = {
  config: {
    name:      "bot",
    aliases:   ["sim", "chat"],
    version:   "3.0",
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
    },
  },

  // helper to normalize message id from different platform shapes
  _getMessageIdFromSent(sent) {
    return sent?.messageID ?? sent?.messageId ?? sent?.mid ?? sent?.id ?? null;
  },

  // helper to get reply-to id from an incoming event (platform dependent)
  _getReplyToIdFromEvent(event) {
    // common possibilities: event.messageReply, event.messageReply.messageID, event.replyTo, event.reply_to
    const mr = event?.messageReply ?? event?.message_reply ?? event?.replyTo ?? event?.reply_to ?? null;
    if (!mr) return null;
    return mr?.messageID ?? mr?.messageId ?? mr?.mid ?? mr?.id ?? null;
  },

  onStart: async function ({ event, message, args, getLang, setPendingReply }) {
    const uid   = event.senderID;           // Telegram user ID or platform equivalent
    const query = args.join(" ").trim();

    // ── /bot (no args) → random greeting ─────────────────────────────────────
    if (!query) {
      try {
        const rand = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
        const sent = await message.reply(rand);

        // store author and the specific message id we just sent so replies must target that message
        const messageID = this._getMessageIdFromSent(sent);
        if (sent) setPendingReply("bot", { author: uid, messageID });

      } catch (e) {
        console.error("bot greeting error:", e?.message ?? e);
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

      const reply = res.data?.reply ?? getLang("error");
      const sent  = await message.reply(reply);

      const messageID = this._getMessageIdFromSent(sent);
      if (sent) setPendingReply("bot", { author: uid, messageID });

    } catch (e) {
      console.error("bot error:", e?.message ?? e);
      return message.reply(getLang("error"));
    }
  },

  // User replies to bot's message → keep conversation going ───────────────────
  onReply: async function ({ event, message, getLang, pendingData, setPendingReply }) {
    // only allow if pendingData exists and author matches the replier
    if (!pendingData || pendingData.author !== event.senderID) return;

    // If we stored the original bot messageID, require that the incoming message is a reply-to that message
    if (pendingData.messageID) {
      const incomingReplyToId = this._getReplyToIdFromEvent(event);
      if (!incomingReplyToId || incomingReplyToId !== pendingData.messageID) {
        // not a reply to the specific bot message -> ignore
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

      const reply = res.data?.reply ?? getLang("error");
      const sent  = await message.reply(reply);

      // update pending with the new message id so next reply must target this new bot message
      const messageID = this._getMessageIdFromSent(sent);
      if (sent) setPendingReply("bot", { author: uid, messageID });

    } catch (e) {
      console.error("bot reply error:", e?.message ?? e);
      return message.reply(getLang("error"));
    }
  },
};
