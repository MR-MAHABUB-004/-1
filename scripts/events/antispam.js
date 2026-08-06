"use strict";

/**
 * scripts/events/antispam.js
 * Mutes users who send too many messages in a short window.
 *
 * Per-thread config stored in threadsData:
 *   thread.antispam        — boolean (default: false)
 *   thread.antispamLimit   — messages allowed per window (default: 5)
 *   thread.antispamWindow  — window in seconds (default: 5)
 *   thread.antispamMute    — mute duration in seconds (default: 60)
 */

// In-memory rate tracking: "chatId:userId" → { count, windowStart }
const tracker = new Map();

module.exports = {
  config: {
    name:      "antispam",
    version:   "1.0",
    author:    "System",
    category:  "events",
    eventType: "message",
  },

  langs: {
    en: {
      muted: "🔇 %1 has been muted for %2 seconds for spamming.",
    },
  },

  onStart: async function ({ api, event, message, threadsData, role, getLang }) {
    if (!event.isGroup) return;
    if (role >= 1) return;  // admins exempt

    const thread = threadsData.get(event.threadID);
    if (!thread?.antispam) return;

    const limit  = thread.antispamLimit  || 5;
    const window = thread.antispamWindow || 5;   // seconds
    const mute   = thread.antispamMute   || 60;  // seconds

    const key = `${event.threadID}:${event.senderID}`;
    const now = Date.now();

    const record = tracker.get(key) || { count: 0, windowStart: now };

    // Reset window if expired
    if (now - record.windowStart > window * 1000) {
      record.count       = 1;
      record.windowStart = now;
    } else {
      record.count++;
    }

    tracker.set(key, record);

    if (record.count <= limit) return;

    // Mute the user
    const firstName = event.raw.from?.first_name || "User";
    try {
      await api.restrictChatMember(event.threadID, parseInt(event.senderID), {
        permissions: {
          can_send_messages:        false,
          can_send_media_messages:  false,
          can_send_other_messages:  false,
          can_add_web_page_previews: false,
        },
        until_date: Math.floor(Date.now() / 1000) + mute,
      });

      // Reset counter after mute
      tracker.delete(key);

      await message.send(
        getLang("muted").replace("%1", firstName).replace("%2", mute),
        event.threadID
      );
    } catch {
      // Bot may not have restrict permissions — silently ignore
    }
  },
};
