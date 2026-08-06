"use strict";

/**
 * scripts/events/_TEMPLATE.js
 * ─────────────────────────────────────────────────────────────────────────────
 * TEMPLATE — Copy and rename to create your own event handler.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * eventType options:
 *   "message"        — fires on every incoming text/media message
 *   "join"           — fires when new_chat_members arrives
 *   "leave"          — fires when left_chat_member arrives
 *   "callback_query" — fires when an inline button is pressed
 *   "*"              — fires on all of the above
 */

module.exports = {
  config: {
    name:      "myevent",
    version:   "1.0",
    author:    "YourName",
    category:  "events",
    eventType: "message",   // change to: join | leave | callback_query | *
  },

  langs: {
    en: {
      // define strings here
    },
  },

  // ── onStart ───────────────────────────────────────────────────────────────
  // Same ctx as commands, plus:
  //   event.newMembers   — array of User objects  (eventType: "join")
  //   event.leftMember   — User object            (eventType: "leave")
  //   event.callbackData — button data string     (eventType: "callback_query")

  onStart: async function ({ api, event, message, threadsData, usersData, globalData, getLang }) {
    // Your event logic here
  },
};
