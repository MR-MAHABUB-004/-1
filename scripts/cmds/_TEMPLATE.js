"use strict";

/**
 * scripts/cmds/example.js
 * ─────────────────────────────────────────────────────────────────────────────
 * TEMPLATE — Copy this file and rename it to build your own command.
 * Every property and hook is documented below.
 * ─────────────────────────────────────────────────────────────────────────────
 */

module.exports = {

  // ── REQUIRED: config ───────────────────────────────────────────────────────
  config: {
    name:      "example",           // Primary command name (must be unique)
    aliases:   ["ex", "demo"],      // Alternative triggers (optional)
    version:   "1.0",
    author:    "YourName",

    usePrefix: true,                // true  → requires prefix  (e.g. /example)
                                    // false → no prefix needed (e.g. "example")

    role: 0,
    // 0 = everyone
    // 1 = group admin (or bot admin)
    // 2 = bot admin only (adminBot in config.json)

    category:  "other",
    // Shown in /help  — pick any: info | admin | game | economy | media | other

    countDown: 3,                   // Cooldown in seconds per user

    description: {
      en: "A short description of what this command does",
    },

    guide: {
      // {pn} = prefix + name  e.g.  /example
      // {p}  = just the prefix
      en: "{pn} — basic usage\n{pn} <arg> — usage with argument",
    },
  },

  // ── OPTIONAL: langs ────────────────────────────────────────────────────────
  // Define all user-facing strings here.
  // Use %1 %2 ... as positional placeholders.
  langs: {
    en: {
      hello:   "👋 Hello, %1!",
      noArgs:  "❌ Please provide an argument.",
      success: "✅ Done: %1",
    },
  },

  // ── REQUIRED: onStart ─────────────────────────────────────────────────────
  // Fires when a user triggers this command.
  //
  // Destructured params:
  //   api          — the raw TelegramBot instance
  //   event        — normalised event object (see below)
  //   message      — helper API (reply, send, sendPhoto, etc.)
  //   args         — string[] of words after the command name
  //   role         — user's role level (0/1/2)
  //   getLang      — (key, ...replacements) → translated string
  //   prefix       — active prefix for this chat
  //   threadsData  — database model for chat settings
  //   usersData    — database model for user data
  //   globalData   — database model for shared global data
  //   setPendingReply(cmdName, extra) — register next reply from this user
  //
  // event fields:
  //   event.threadID     — chat ID string
  //   event.senderID     — sender user ID string
  //   event.messageID    — message ID number
  //   event.body         — full message text
  //   event.isGroup      — boolean
  //   event.mentions     — { userId: displayName }
  //   event.messageReply — null | { senderID, body, attachments[] }
  //   event.attachments  — [{ type, fileId }]
  //   event.raw          — raw Telegram message object

  onStart: async function ({ event, message, args, getLang, setPendingReply }) {
    if (!args[0]) {
      return message.reply(getLang("noArgs"));
    }

    const name = args[0];

    // message.reply(text)                     — reply to triggering msg
    // message.send(text, chatId?)             — send anywhere
    // message.sendPhoto(source, caption?)     — URL / file_id / stream
    // message.sendVideo(source, caption?)
    // message.sendDocument(source, caption?)
    // message.sendAudio(source, caption?)
    // message.sendSticker(source)
    // message.edit(messageId, newText)
    // message.delete(messageId?)
    // message.action("typing")

    // To wait for user's next reply, call setPendingReply:
    // setPendingReply("example", { anyExtra: "data" });

    return message.reply(getLang("hello").replace("%1", name));
  },

  // ── OPTIONAL: onChat ──────────────────────────────────────────────────────
  // Fires on EVERY message (not just commands). Good for passive features
  // like XP gain, auto-reactions, spam filters, etc.
  // IMPORTANT: keep this fast — it runs on every single message.

  onChat: async function ({ event, message, threadsData, usersData }) {
    // Example: log every message silently
    // const user = usersData.getOrCreate(event.senderID);
    // usersData.set(event.senderID, "messageCount", (user.messageCount || 0) + 1);
  },

  // ── OPTIONAL: onReply ─────────────────────────────────────────────────────
  // Fires when the user replies to a bot message AFTER setPendingReply() was called.
  // pendingData contains the extra object you passed to setPendingReply.

  onReply: async function ({ event, message, args, getLang, pendingData, setPendingReply }) {
    // event.body contains what the user typed
    // Call setPendingReply again to keep the conversation going
    return message.reply(getLang("success").replace("%1", event.body));
  },

  // ── OPTIONAL: onCallbackQuery ─────────────────────────────────────────────
  // Fires when the user taps an inline keyboard button in a message from THIS command.
  // callbackData is the data string on the button.

  onCallbackQuery: async function ({ event, message, callbackData }) {
    // await message.reply(`You pressed: ${callbackData}`);
  },
};
