"use strict";

/**
 * core/forceJoin.js
 * ─────────────────────────────────────────────────────────────────────────────
 * "Must join our channel to use the bot" gate.
 *
 * Reads settings from config.json → forceJoin:
 * {
 *   "enabled":         true,
 *   "channelUsername": "@anhatayba1",   // used for the getChatMember API call
 *   "channelUrl":      "https://t.me/anhatayba1",
 *   "cacheSeconds":    60                // how long a "joined" result is trusted
 * }
 *
 * Bot admins (config.adminBot) always bypass this check.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const log = require("../logger/log.js");

// Short-lived cache so we don't hammer getChatMember on every single message.
// Only successful "joined" results are cached — a "not joined" result is
// always re-checked live so a user who just joined isn't stuck waiting.
const membershipCache = new Map(); // userId -> expiresAt (ms)

function isAdminBot(config, userId) {
  return (config.adminBot || []).map(String).includes(String(userId));
}

function getForceJoinConfig(config) {
  const fj = config.forceJoin || {};
  return {
    enabled:         !!fj.enabled,
    channelUsername: fj.channelUsername || "",
    channelUrl:      fj.channelUrl || "",
    cacheSeconds:    fj.cacheSeconds ?? 60,
  };
}

/**
 * Live check against Telegram — is this user currently a member of the
 * configured channel?
 */
async function isChannelMember(bot, channelUsername, userId) {
  try {
    const member = await bot.getChatMember(channelUsername, userId);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch (err) {
    // Common causes: bot isn't an admin in the channel, or the channel
    // username is wrong. Fail closed (treat as "not joined") but log loudly
    // so the misconfiguration gets noticed instead of silently locking
    // everyone out forever.
    log.error("FORCEJOIN", `getChatMember failed for ${userId}: ${err.message || err}`);
    return false;
  }
}

/**
 * checkForceJoin(bot, config, userId)
 * Returns true if the user is allowed through (joined, is admin, or the
 * gate is disabled). Uses a short cache for positive results.
 */
async function checkForceJoin(bot, config, userId) {
  const fj = getForceJoinConfig(config);
  if (!fj.enabled || !fj.channelUsername) return true;
  if (isAdminBot(config, userId)) return true;

  const cached = membershipCache.get(String(userId));
  if (cached && cached > Date.now()) return true;

  const joined = await isChannelMember(bot, fj.channelUsername, userId);
  if (joined) {
    membershipCache.set(String(userId), Date.now() + fj.cacheSeconds * 1000);
  }
  return joined;
}

/** Drop a user from the cache (e.g. after a failed re-verify) */
function clearCache(userId) {
  membershipCache.delete(String(userId));
}

function buildJoinPrompt(config) {
  const fj = getForceJoinConfig(config);
  return {
    text:
      "🔒 *Access Restricted*\n\n" +
      "You need to join our channel before you can use this bot.\n\n" +
      "1️⃣ Tap *Join Channel* below\n" +
      "2️⃣ Come back and tap *✅ I've Joined*",
    opts: {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📢 Join Channel", url: fj.channelUrl || `https://t.me/${fj.channelUsername.replace(/^@/, "")}` }],
          [{ text: "✅ I've Joined", callback_data: "fj_verify" }],
        ],
      },
    },
  };
}

module.exports = {
  checkForceJoin,
  isChannelMember,
  clearCache,
  buildJoinPrompt,
  getForceJoinConfig,
  isAdminBot,
};
