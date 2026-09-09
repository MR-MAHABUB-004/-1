"use strict";

/**
 * scripts/events/acslogoauto.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Automatic mode for the ACS logo template: when a chat has it turned on
 * (see {pn}acslogo on/off), any photo sent in that chat — no command
 * needed — is automatically wrapped in the ACS template and sent back.
 *
 * Skips:
 *  - messages that are also invoking a command (so `/acslogo` + photo
 *    caption doesn't generate the image twice)
 *  - chats that haven't turned this on (defaults to OFF — opt-in per chat
 *    via {pn}acslogo on)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const config = require("../../config.json");
const { runAcsLogo } = require("../cmds/acslogo.js");

module.exports = {
  config: {
    name: "acslogoauto",
    version: "1.0",
    author: "Mesbah Saxx (ported to Telegram)",
    category: "events",
    eventType: "message",
  },

  onStart: async function ({ api, event, message, threadsData }) {
    const photo = event.attachments.find((a) => a.type === "photo");
    if (!photo) return;

    // If this message is also a command invocation (e.g. "/acslogo" as the
    // photo's caption), let the command handle it instead of double-firing.
    const prefix = config.prefix || "/";
    if (event.body && event.body.trim().startsWith(prefix)) return;

    const thread = await threadsData.get(event.threadID);
    if (!thread?.data?.acsLogoAuto) return;

    await runAcsLogo({ api, event, message, fileId: photo.fileId });
  },
};
