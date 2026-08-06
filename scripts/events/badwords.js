"use strict";

/**
 * scripts/events/badwords.js
 * Automatically deletes messages containing banned words.
 * Admins are exempt. Configurable per-thread via threadsData.
 *
 * Per-thread config (via /thread set or direct DB):
 *   thread.badwords       — string[]  list of banned words
 *   thread.badwordsAction — "delete" | "warn" | "both"  (default: "both")
 *   thread.badwordsEnabled — boolean (default: false)
 */

module.exports = {
  config: {
    name:      "badwords",
    version:   "1.0",
    author:    "System",
    category:  "events",
    eventType: "message",
  },

  langs: {
    en: {
      warning: "⚠️ %1, please avoid using inappropriate language.",
    },
  },

  onStart: async function ({ api, event, message, threadsData, role, getLang }) {
    if (!event.isGroup) return;
    if (role >= 1) return;   // admins are exempt

    const thread = threadsData.get(event.threadID);
    if (!thread?.badwordsEnabled) return;

    const bannedWords = Array.isArray(thread.badwords) ? thread.badwords : [];
    if (!bannedWords.length) return;

    const text  = event.body.toLowerCase();
    const found = bannedWords.some(word =>
      new RegExp(`\\b${word.toLowerCase()}\\b`).test(text)
    );

    if (!found) return;

    const action    = thread.badwordsAction || "both";
    const msg       = event.raw;
    const firstName = msg.from?.first_name || "User";

    if (action === "delete" || action === "both") {
      try { await api.deleteMessage(event.threadID, event.messageID); } catch {}
    }

    if (action === "warn" || action === "both") {
      await message.send(
        getLang("warning").replace("%1", firstName),
        event.threadID
      );
    }
  },
};
