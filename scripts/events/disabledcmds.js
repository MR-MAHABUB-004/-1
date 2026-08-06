"use strict";

/**
 * scripts/events/disabledcmds.js
 * Silently blocks commands that have been disabled for this thread via /cmd off.
 * Must run BEFORE the command fires — this works because onChat runs alongside
 * command dispatch and the response is ignored if we return early.
 *
 * Actually implemented in handleMessage.js by checking thread.disabledCmds
 * before calling onStart. This event file exists for documentation/future use.
 *
 * The real enforcement is in core/handleMessage.js — after getUserRole,
 * before executing the command, we check:
 *   const disabled = thread?.disabledCmds || [];
 *   if (disabled.includes(matchedCommandName)) return;
 */

module.exports = {
  config: {
    name:      "disabledcmds",
    version:   "1.0",
    author:    "System",
    category:  "events",
    eventType: "message",
  },

  langs: { en: {} },

  // This event has no active logic — enforcement is in handleMessage.js
  onStart: async function () {},
};
