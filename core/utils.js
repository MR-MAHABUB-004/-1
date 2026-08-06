"use strict";

/**
 * core/utils.js
 * Global utilities injected as global.utils — mirrors GoatBot's utils.js.
 */

const fs     = require("fs");
const path   = require("path");
const config = require("../config.json");

// ── PREFIX ────────────────────────────────────────────────────────────────────
/**
 * getPrefix(threadId) — returns the prefix for a given thread.
 * Falls back to global config prefix.
 */
function getPrefix(threadId) {
  try {
    const { threadsData } = require("./database.js");
    const thread = threadsData.get(threadId);
    return (thread && thread.prefix) ? thread.prefix : config.prefix;
  } catch {
    return config.prefix;
  }
}

// ── FORMATTING ────────────────────────────────────────────────────────────────
function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(" ");
}

function formatNumber(n) {
  return Number(n).toLocaleString("en-US");
}

// ── LANG HELPER ───────────────────────────────────────────────────────────────
/**
 * makeLangGetter(langs, lang)
 * Returns a getLang(key, ...args) function that resolves %1 %2 placeholders.
 */
function makeLangGetter(langs, lang = "en") {
  const dict = langs[lang] || langs["en"] || {};
  return function getLang(key, ...args) {
    let str = dict[key] || key;
    args.forEach((val, i) => {
      str = str.replace(new RegExp(`%${i + 1}`, "g"), val);
    });
    return str;
  };
}

// ── PERMISSION ROLES ──────────────────────────────────────────────────────────
// Role 0 = everyone
// Role 1 = group admin
// Role 2 = bot admin (adminBot in config)
// Role 3 = operator (same as adminBot[0])

function isAdminBot(userId) {
  return config.adminBot.map(String).includes(String(userId));
}

async function isGroupAdmin(bot, chatId, userId) {
  try {
    const member = await bot.getChatMember(chatId, userId);
    return ["administrator", "creator"].includes(member.status);
  } catch {
    return false;
  }
}

async function getUserRole(bot, msg) {
  const userId  = String(msg.from.id);
  const chatId  = msg.chat.id;
  const isAdmin = isAdminBot(userId);
  if (isAdmin) return 2;
  const isGrpAdmin = await isGroupAdmin(bot, chatId, msg.from.id);
  if (isGrpAdmin) return 1;
  return 0;
}

// ── MESSAGE HELPERS ───────────────────────────────────────────────────────────
/**
 * buildMessageAPI(bot, msg)
 * Returns a GoatBot-style `message` object for use inside commands.
 *
 * Mirrors:
 *   message.reply(text, opts?)
 *   message.send(text, targetChatId?, opts?)
 *   message.react(emoji)
 *   message.edit(messageId, text, opts?)
 *   message.delete(messageId?)
 *   message.sendPhoto(source, caption?, opts?)
 *   message.sendVideo(source, caption?, opts?)
 *   message.sendDocument(source, caption?, opts?)
 *   message.sendAudio(source, caption?, opts?)
 *   message.sendSticker(source)
 */
// If the message being replied to was deleted (or is otherwise gone), Telegram
// rejects the send with 400 "message to be replied not found". Rather than let
// that bubble up and swallow the whole command, retry once without the
// reply_to_message_id so the user still gets a response.
async function sendWithReplyFallback(sendFn, opts) {
  try {
    return await sendFn(opts);
  } catch (err) {
    const desc = err?.response?.body?.description || err?.message || "";
    if (opts.reply_to_message_id && /message to be replied not found/i.test(desc)) {
      const { reply_to_message_id, ...rest } = opts;
      return sendFn(rest);
    }
    throw err;
  }
}

function buildMessageAPI(bot, msg) {
  const chatId    = msg.chat.id;
  const msgId     = msg.message_id;

  return {
    // Reply to the triggering message
    async reply(text, opts = {}) {
      return sendWithReplyFallback(
        (o) => bot.sendMessage(chatId, text, o),
        { reply_to_message_id: msgId, parse_mode: "Markdown", ...opts }
      );
    },

    // Send to any chat (defaults to current)
    async send(text, targetChatId = chatId, opts = {}) {
      return bot.sendMessage(targetChatId, text, {
        parse_mode: "Markdown",
        ...opts,
      });
    },

    // React with emoji (Telegram reaction — requires Bot API 7.0+)
    async react(emoji) {
      try {
        await bot.setMessageReaction(chatId, msgId, [{ type: "emoji", emoji }]);
      } catch {
        // silently ignore if reactions not supported
      }
    },

    // Edit a previous bot message
    async edit(targetMessageId, text, opts = {}) {
      return bot.editMessageText(text, {
        chat_id:    chatId,
        message_id: targetMessageId,
        parse_mode: "Markdown",
        ...opts,
      });
    },

    // Delete a message (defaults to triggering message)
    async delete(targetMessageId = msgId) {
      return bot.deleteMessage(chatId, targetMessageId);
    },

    // Photo — accepts URL, file_id, or ReadStream
    async sendPhoto(source, caption = "", opts = {}) {
      return sendWithReplyFallback(
        (o) => bot.sendPhoto(chatId, source, o),
        { caption, reply_to_message_id: msgId, parse_mode: "Markdown", ...opts }
      );
    },

    // Video
    async sendVideo(source, caption = "", opts = {}) {
      return sendWithReplyFallback(
        (o) => bot.sendVideo(chatId, source, o),
        { caption, reply_to_message_id: msgId, parse_mode: "Markdown", ...opts }
      );
    },

    // Document / file
    async sendDocument(source, caption = "", opts = {}) {
      return sendWithReplyFallback(
        (o) => bot.sendDocument(chatId, source, o),
        { caption, reply_to_message_id: msgId, ...opts }
      );
    },

    // Audio
    async sendAudio(source, caption = "", opts = {}) {
      return sendWithReplyFallback(
        (o) => bot.sendAudio(chatId, source, o),
        { caption, reply_to_message_id: msgId, ...opts }
      );
    },

    // Sticker
    async sendSticker(source) {
      return sendWithReplyFallback(
        (o) => bot.sendSticker(chatId, source, o),
        { reply_to_message_id: msgId }
      );
    },

    // Chat action (typing, upload_photo, etc.)
    async action(action = "typing") {
      return bot.sendChatAction(chatId, action);
    },

    chatId,
    msgId,
  };
}

// ── EVENT OBJECT BUILDER ──────────────────────────────────────────────────────
/**
 * buildEventObject(msg)
 * Normalises a Telegram msg into GoatBot-style event fields.
 */
function buildEventObject(msg) {
  const text = msg.text || msg.caption || "";
  return {
    // GoatBot naming
    threadID:     String(msg.chat.id),
    senderID:     String(msg.from?.id || ""),
    messageID:    msg.message_id,
    body:         text,
    type:         msg.chat.type,            // private | group | supergroup | channel
    isGroup:      msg.chat.type !== "private",

    // Reply info
    messageReply: msg.reply_to_message ? {
      senderID:    String(msg.reply_to_message.from?.id || ""),
      body:        msg.reply_to_message.text || msg.reply_to_message.caption || "",
      messageID:   msg.reply_to_message.message_id,
      attachments: buildAttachments(msg.reply_to_message),
    } : null,

    // Attachments of current message
    attachments: buildAttachments(msg),

    // Mentions (entities with type "mention" or "text_mention")
    mentions: buildMentions(msg),

    // Raw Telegram message
    raw: msg,
  };
}

function buildAttachments(msg) {
  if (!msg) return [];
  const attachments = [];
  if (msg.photo)     attachments.push({ type: "photo",    url: null,  fileId: msg.photo[msg.photo.length - 1].file_id });
  if (msg.video)     attachments.push({ type: "video",    url: null,  fileId: msg.video.file_id });
  if (msg.audio)     attachments.push({ type: "audio",    url: null,  fileId: msg.audio.file_id });
  if (msg.voice)     attachments.push({ type: "voice",    url: null,  fileId: msg.voice.file_id });
  if (msg.document)  attachments.push({ type: "document", url: null,  fileId: msg.document.file_id });
  if (msg.sticker)   attachments.push({ type: "sticker",  url: null,  fileId: msg.sticker.file_id });
  return attachments;
}

function buildMentions(msg) {
  const mentions = {};
  const entities = msg.entities || msg.caption_entities || [];
  for (const entity of entities) {
    if (entity.type === "mention") {
      const username = (msg.text || "").substring(entity.offset, entity.offset + entity.length);
      mentions[username] = username;
    }
    if (entity.type === "text_mention" && entity.user) {
      mentions[String(entity.user.id)] = `${entity.user.first_name || ""}`.trim();
    }
  }
  return mentions;
}

// ── ESCAPES ───────────────────────────────────────────────────────────────────
function escapeMarkdown(text) {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, "\\$&");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  getPrefix,
  formatTime,
  formatNumber,
  makeLangGetter,
  isAdminBot,
  isGroupAdmin,
  getUserRole,
  buildMessageAPI,
  buildEventObject,
  buildAttachments,
  buildMentions,
  escapeMarkdown,
  escapeRegex,
};
