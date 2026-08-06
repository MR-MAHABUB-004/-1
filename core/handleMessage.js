"use strict";

/**
 * core/handleMessage.js
 * Main message dispatcher — GoatBot V2 style for Telegram.
 */

const log  = require("../logger/log.js");
const {
  getPrefix,
  getUserRole,
  buildMessageAPI,
  buildEventObject,
  makeLangGetter,
  escapeRegex,
} = require("./utils.js");
const { threadsData, usersData, globalData } = require("./database.js");
const config = require("../config.json");

// ── COOLDOWN STORE ────────────────────────────────────────────────────────────
const cooldowns = new Map();

function checkCooldown(userId, cmdName, seconds) {
  const key  = `${userId}:${cmdName}`;
  const last = cooldowns.get(key) || 0;
  const now  = Date.now();
  const diff = now - last;
  if (diff < seconds * 1000) return Math.ceil((seconds * 1000 - diff) / 1000);
  cooldowns.set(key, now);
  return 0;
}

// ── PENDING REPLY MAP ─────────────────────────────────────────────────────────
// key: "chatId:userId"  →  { commandName, author, ...extra }
// Fires on the user's NEXT message — no Telegram reply needed (like GoatBot)
const pendingReplies = new Map();

function setPendingReply(chatId, userId, cmdName, extra = {}) {
  pendingReplies.set(`${chatId}:${userId}`, { commandName: cmdName, ...extra });
}

function getPendingReply(chatId, userId) {
  return pendingReplies.get(`${chatId}:${userId}`) || null;
}

function clearPendingReply(chatId, userId) {
  pendingReplies.delete(`${chatId}:${userId}`);
}

// ── SAFE EXECUTOR ─────────────────────────────────────────────────────────────
async function safeRun(label, fn) {
  try {
    await fn();
  } catch (err) {
    log.error(label, err.message || String(err));
  }
}

// ── MAIN HANDLER ─────────────────────────────────────────────────────────────
async function handleMessage(bot, msg) {
  if (!msg || !msg.from) return;

  const chatId = String(msg.chat.id);
  const userId = String(msg.from.id);
  const text   = msg.text || msg.caption || "";

  // ── 1. Record session in DB ───────────────────────────────────────────────
  await threadsData.getOrCreate(chatId, {
    title:    msg.chat.title || msg.chat.first_name || "",
    type:     msg.chat.type,
    username: msg.chat.username || null,
  });

  const existingUser = await usersData.getOrCreate(userId, {
    name:     `${msg.from.first_name || ""} ${msg.from.last_name || ""}`.trim(),
    username: msg.from.username || null,
  });
  // Increment message count
  await usersData.update(userId, { messageCount: (existingUser.messageCount || 0) + 1 });

  // ── 2. Blacklist check ────────────────────────────────────────────────────
  const blacklistUsers = config.blackList?.users?.map(String) || [];
  const blacklistChats = config.blackList?.chats?.map(String) || [];
  if (blacklistUsers.includes(userId) || blacklistChats.includes(chatId)) return;

  // ── 3. Whitelist mode ─────────────────────────────────────────────────────
  if (config.whiteListMode?.enabled) {
    const allowed = config.whiteListMode.allowedChatIds?.map(String) || [];
    if (!allowed.includes(chatId) && !config.adminBot.map(String).includes(userId)) return;
  }

  // ── 4. Build GoatBot-style context objects ────────────────────────────────
  const event   = buildEventObject(msg);
  const message = buildMessageAPI(bot, msg);
  const role    = await getUserRole(bot, msg);
  const prefix  = getPrefix(chatId);

  const ctx = {
    api:   bot,
    event,
    message,
    role,
    threadsData,
    usersData,
    globalData,
    prefix,
    setPendingReply:   (cmdName, extra) => setPendingReply(chatId, userId, cmdName, extra),
    clearPendingReply: ()               => clearPendingReply(chatId, userId),
  };

  const { commands } = global.GoatBot;

  // ── 5. onReply — fires on user's NEXT message (no Telegram reply needed) ──
  //    This matches GoatBot behaviour exactly: setPendingReply() waits for
  //    any next message from that user in that chat, not a quoted reply.
  const pending = getPendingReply(chatId, userId);
  if (pending) {
    const cmd = commands.get(pending.commandName);
    if (cmd && typeof cmd.onReply === "function") {
      // Check if current text is a new command — if so, let it through instead
      const isNewCommand = [...commands.values()].some(c => {
        const names      = [c.config.name, ...(c.config.aliases || [])].map(n => n.toLowerCase());
        const escaped    = names.map(escapeRegex).join("|");
        const usePrefix  = c.config.usePrefix !== false;
        const pat        = usePrefix
          ? new RegExp(`^${escapeRegex(prefix)}\\s*(${escaped})(?:\\s|$)`, "i")
          : new RegExp(`^(${escaped})(?:\\s|$)`, "i");
        return pat.test(text);
      });

      if (!isNewCommand) {
        await safeRun(`onReply:${pending.commandName}`, async () => {
          const getLang = makeLangGetter(cmd.langs || {}, config.language);
          await cmd.onReply({
            ...ctx,
            getLang,
            args:        text.trim().split(/\s+/).filter(Boolean),
            pendingData: pending,
          });
        });
        // Note: commands call setPendingReply again to chain — we don't auto-clear
        // Only clear if the command didn't re-register
        if (getPendingReply(chatId, userId) === pending) {
          clearPendingReply(chatId, userId);
        }
        return;
      }

      // New command was typed — clear the pending reply
      clearPendingReply(chatId, userId);
    }
  }

  // ── 6. Command dispatch ───────────────────────────────────────────────────
  const { aliases } = global.GoatBot;

  for (const [name, cmd] of commands) {
    const cfg        = cmd.config;
    const usePrefix  = cfg.usePrefix !== false;
    const cmdNames   = [cfg.name, ...(cfg.aliases || [])].map(n => n.toLowerCase());
    const escaped    = cmdNames.map(escapeRegex).join("|");
    const pattern    = usePrefix
      ? new RegExp(`^${escapeRegex(prefix)}\\s*(${escaped})(?:\\s|$)`, "i")
      : new RegExp(`^(${escaped})(?:\\s|$)`, "i");

    if (!pattern.test(text)) continue;

    // Per-thread disabled commands
    const threadCfg    = await threadsData.get(chatId);
    const disabledCmds = threadCfg?.disabledCmds || [];
    if (disabledCmds.includes(name)) return;

    // Admin-only mode
    if (threadCfg?.adminOnly && role < 1) return;

    // Role check
    if (role < (cfg.role || 0)) {
      await message.reply("⛔ You don't have permission to use this command.");
      return;
    }

    // Cooldown
    const cdSeconds = cfg.countDown ?? config.cooldownDefault ?? 3;
    const remaining = checkCooldown(userId, name, cdSeconds);
    if (remaining > 0) {
      await message.reply(`⏳ Please wait *${remaining}s* before using \`${prefix}${name}\` again.`);
      break;
    }

    // Parse args — strip prefix + command name
    const args = text.replace(pattern, "").trim().split(/\s+/).filter(Boolean);
    const getLang = makeLangGetter(cmd.langs || {}, config.language);

    log.cmd(name, `${msg.chat.type} | user:${userId} | chat:${chatId}`);

    await safeRun(`cmd:${name}`, () => cmd.onStart?.({ ...ctx, args, getLang }));
    break;
  }

  // ── 7. onChat handlers ────────────────────────────────────────────────────
  // Re-check access gates so onChat/eventCommands don't bypass whitelist or adminOnly
  const _threadCfgForGates = await threadsData.get(chatId);
  if (config.whiteListMode?.enabled) {
    const allowed = config.whiteListMode.allowedChatIds?.map(String) || [];
    if (!allowed.includes(chatId) && !config.adminBot.map(String).includes(userId)) return;
  }
  if (_threadCfgForGates?.adminOnly && role < 1) return;

  const { onChat } = global.GoatBot;
  for (const { name, fn } of onChat) {
    const cmd     = commands.get(name);
    const getLang = makeLangGetter(cmd?.langs || {}, config.language);
    await safeRun(`onChat:${name}`, () => fn({ ...ctx, getLang }));
  }

  // ── 8. eventCommands with eventType: "message" ────────────────────────────
  const { eventCommands } = global.GoatBot;
  for (const [evName, ev] of eventCommands) {
    const evType = ev.config?.eventType || "message";
    if (evType !== "message" && evType !== "*") continue;
    const getLang = makeLangGetter(ev.langs || {}, config.language);
    await safeRun(`event:${evName}`, () => ev.onStart?.({ ...ctx, getLang }));
  }
}

// ── CALLBACK QUERY ────────────────────────────────────────────────────────────
async function handleCallbackQuery(bot, query) {
  const { data, message, from } = query;
  const chatId = String(message.chat.id);
  const userId = String(from.id);
  const role   = await getUserRole(bot, { from, chat: message.chat });

  const event  = buildEventObject(message);
  event.callbackData = data;
  const msgAPI = buildMessageAPI(bot, message);

  const ctx = {
    api: bot, event, message: msgAPI, role,
    threadsData, usersData, globalData, query,
    setPendingReply:   (cmdName, extra) => setPendingReply(chatId, userId, cmdName, extra),
    clearPendingReply: ()               => clearPendingReply(chatId, userId),
  };

  const { eventCommands, commands } = global.GoatBot;

  for (const [, ev] of eventCommands) {
    if (ev.config?.eventType !== "callback_query") continue;
    const getLang = makeLangGetter(ev.langs || {}, config.language);
    await safeRun(`cbq_event`, () => ev.onStart?.({ ...ctx, getLang, callbackData: data }));
  }

  for (const [, cmd] of commands) {
    if (typeof cmd.onCallbackQuery !== "function") continue;
    await safeRun(`cbq_cmd`, () => cmd.onCallbackQuery?.({ ...ctx, callbackData: data }));
  }

  bot.answerCallbackQuery(query.id).catch(() => {});
}

// ── JOIN / LEAVE ──────────────────────────────────────────────────────────────
async function handleJoin(bot, msg) {
  const { eventCommands } = global.GoatBot;
  const event   = buildEventObject(msg);
  event.newMembers = msg.new_chat_members;
  const message = buildMessageAPI(bot, msg);

  for (const [, ev] of eventCommands) {
    if (!["join", "*"].includes(ev.config?.eventType)) continue;
    const getLang = makeLangGetter(ev.langs || {}, config.language);
    await safeRun(`join`, () =>
      ev.onStart?.({ api: bot, event, message, threadsData, usersData, globalData, getLang })
    );
  }
}

async function handleLeave(bot, msg) {
  const { eventCommands } = global.GoatBot;
  const event   = buildEventObject(msg);
  event.leftMember = msg.left_chat_member;
  const message = buildMessageAPI(bot, msg);

  for (const [, ev] of eventCommands) {
    if (!["leave", "*"].includes(ev.config?.eventType)) continue;
    const getLang = makeLangGetter(ev.langs || {}, config.language);
    await safeRun(`leave`, () =>
      ev.onStart?.({ api: bot, event, message, threadsData, usersData, globalData, getLang })
    );
  }
}

module.exports = {
  handleMessage,
  handleCallbackQuery,
  handleJoin,
  handleLeave,
  setPendingReply,
  getPendingReply,
  clearPendingReply,
};