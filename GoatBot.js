"use strict";

process.on("uncaughtException",  err => log.error("PROCESS", err.message || err));
process.on("unhandledRejection", err => log.error("PROCESS", String(err)));

const fs      = require("fs");
const path    = require("path");
const os      = require("os");
const express = require("express");
const figlet  = require("figlet");
const chalk   = require("chalk");
const TelegramBot = require("node-telegram-bot-api");

const log    = require("./logger/log.js");
const config = require("./config.json");

// ── GLOBAL STATE ────────────────────────────────────────────────────────────
global.GoatBot = {
  startTime:     Date.now(),
  commands:      new Map(),
  eventCommands: new Map(),
  aliases:       new Map(),
  onChat:        [],
  onReply:       new Map(),
  onReaction:    new Map(),
  config,
  bot:           null,
};

global.utils        = require("./core/utils.js");
global._reactTargets = new Map(); // stores msgId → senderId for reactBy:kick

// ── VALIDATE ────────────────────────────────────────────────────────────────
if (!config.botToken || config.botToken === "YOUR_BOT_TOKEN_HERE") {
  console.error(chalk.red("\n❌  Set your bot token in config.json\n"));
  process.exit(1);
}

// ── LOAD COMMANDS + EVENTS ──────────────────────────────────────────────────
const { loadCommands } = require("./core/loadCommands.js");
const { loadEvents }   = require("./core/loadEvents.js");
loadCommands();
loadEvents();

// ── START BOT ───────────────────────────────────────────────────────────────
let bot;
if (config.useWebhook && config.webhookUrl) {
  log.info("BOT", "Webhook mode");
  bot = new TelegramBot(config.botToken);
  bot.setWebHook(`${config.webhookUrl.replace(/\/$/, "")}/bot${config.botToken}`);
} else {
  log.info("BOT", "Polling mode");
  bot = new TelegramBot(config.botToken, {
    polling: true,
    // Enable message_reaction updates
    allowed_updates: [
      "message", "callback_query", "message_reaction",
      "my_chat_member", "chat_member",
    ],
  });
}

global.GoatBot.bot = bot;
global.bot         = bot;

// ── HANDLERS ────────────────────────────────────────────────────────────────
const {
  handleMessage,
  handleCallbackQuery,
  handleJoin,
  handleLeave,
  handleReaction,
} = require("./core/handleMessage.js");

bot.on("message",          msg      => handleMessage(bot, msg));
bot.on("new_chat_members", msg      => handleJoin(bot, msg));
bot.on("left_chat_member", msg      => handleLeave(bot, msg));
bot.on("callback_query",   query    => handleCallbackQuery(bot, query));
bot.on("message_reaction", reaction => handleReaction(bot, reaction));
bot.on("polling_error",    err      => log.error("POLLING", err.code || err.message));

// Store sender IDs so reactBy:kick can find who sent a message
bot.on("message", msg => {
  if (!msg?.from || !msg?.message_id) return;
  const key = `reactTarget:${msg.chat.id}:${msg.message_id}`;
  global._reactTargets.set(key, String(msg.from.id));
  // Keep map from growing unbounded — cap at 500 entries
  if (global._reactTargets.size > 500) {
    const firstKey = global._reactTargets.keys().next().value;
    global._reactTargets.delete(firstKey);
  }
});

// ── BROADCAST ───────────────────────────────────────────────────────────────
const { threadsData, usersData } = require("./core/database.js");

global.broadcast = async function(text, opts = {}) {
  const all = Object.values(await threadsData.getAll());
  let sent = 0, failed = 0;
  for (const chat of all) {
    try {
      await bot.sendMessage(chat.id, text, { parse_mode: "Markdown", ...opts });
      sent++;
      await new Promise(r => setTimeout(r, 50));
    } catch { failed++; }
  }
  log.info("BROADCAST", `sent:${sent} failed:${failed}`);
  return { sent, failed };
};

// ── EXPRESS ─────────────────────────────────────────────────────────────────
const app  = express();
const port = process.env.PORT || config.port || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

if (config.useWebhook) {
  app.post(`/bot${config.botToken}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  });
}

app.get("/ping", (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// ── ENHANCED /api/stats ─────────────────────────────────────────────────────
app.get("/api/stats", async (req, res) => {
  const uptimeSec = Math.floor((Date.now() - global.GoatBot.startTime) / 1000);
  const d = Math.floor(uptimeSec / 86400), h = Math.floor((uptimeSec % 86400) / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60), s = uptimeSec % 60;

  if (!global._botInfo) {
    try { global._botInfo = await bot.getMe(); } catch { global._botInfo = {}; }
  }

  const allChats  = Object.values(await threadsData.getAll());
  const allUsers  = Object.values(await usersData.getAll());
  const totalMem  = os.totalmem(), usedMem = totalMem - os.freemem();

  // Build safe user list for dashboard (no sensitive data)
  const userList = allUsers.slice(0, 50).map(u => ({
    id:           u.id,
    first_name:   u.name         || "Unknown",
    username:     u.username     || null,
    messageCount: u.messageCount || 0,
    last_seen:    u.updatedAt    || u.lastSeen || Math.floor(Date.now() / 1000),
  })).sort((a, b) => b.last_seen - a.last_seen);

  // Build safe chat list
  const chatList = allChats.slice(0, 100).map(c => ({
    id:          c.id,
    title:       c.title || "Unknown",
    type:        c.type  || "private",
    last_activity: c.updatedAt || Math.floor(Date.now() / 1000),
  }));

  res.json({
    ok:       true,
    uptime:   `${d}d ${h}h ${m}m ${s}s`,
    bot:      {
      username:   global._botInfo.username,
      id:         global._botInfo.id,
      first_name: global._botInfo.first_name,
    },
    counts:   {
      total:  allChats.length,
      groups: allChats.filter(c => c.type !== "private").length,
      users:  allChats.filter(c => c.type === "private").length,
    },
    commands: global.GoatBot.commands.size,
    events:   global.GoatBot.eventCommands.size,
    memory:   { used: Math.round(usedMem / 1024 / 1024), total: Math.round(totalMem / 1024 / 1024) },
    users:    userList,
    chats:    chatList,
    config: {
      botName:          config.botName,
      prefix:           config.prefix,
      language:         config.language,
      cooldownDefault:  config.cooldownDefault,
      port:             config.port,
      api:              config.api,
      dbName:           config.dbName,
      webhookUrl:       config.webhookUrl,
      useWebhook:       config.useWebhook,
      adminBot:         config.adminBot,
      whiteListMode:    config.whiteListMode,
      blackList:        config.blackList,
      // ── Toggle booleans (were missing — caused switches to reset on refresh) ──
      blackListActive:  config.blackListActive  ?? false,
      autoRestart:      config.autoRestart      ?? false,
      messageLogging:   config.messageLogging   ?? false,
    },
  });
});

// ── /api/toggle (POST) — toggle settings ────────────────────────────────────
app.post("/api/toggle", async (req, res) => {
  try {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ ok: false, error: "key required" });

    const updates = {};
    
    // Handle different setting keys
    if (key === "whiteListMode.enabled" || key === "whiteListMode") {
      updates.whiteListMode = { ...config.whiteListMode, enabled: value };
    } else if (key === "autoRestart") {
      updates.autoRestart = value;
    } else if (key === "messageLogging") {
      updates.messageLogging = value;
    } else if (key === "blackListActive") {
      updates.blackListActive = value;
    } else {
      updates[key] = value;
    }

    // Update config.json
    const cfgPath = path.join(__dirname, "config.json");
    const newConfig = { ...config, ...updates };
    fs.writeFileSync(cfgPath, JSON.stringify(newConfig, null, 2), "utf8");
    Object.assign(config, newConfig);

    log.success("CONFIG", `Toggle ${key} = ${value}`);
    res.json({ ok: true, setting: key, value });
  } catch (e) {
    log.error("TOGGLE", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── /api/config (POST) — write config.json ──────────────────────────────────
app.post("/api/config", async (req, res) => {
  try {
    const updates = req.body || {};
    // Merge safely — never overwrite botToken from dashboard
    const safe = { ...config, ...updates };
    safe.botToken = config.botToken; // always keep original token
    const cfgPath = path.join(__dirname, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify(safe, null, 2), "utf8");
    // Hot-patch running config
    Object.assign(config, safe);
    log.success("CONFIG", "config.json updated via dashboard");
    res.json({ ok: true });
  } catch (e) {
    log.error("CONFIG", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── /api/broadcast (POST) — send message to all chats ────────────────────────
app.post("/api/broadcast", async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ ok: false, error: "message required" });
    log.info("BROADCAST", `Dashboard broadcast: "${message.slice(0, 60)}…"`);
    const result = await global.broadcast(message);
    res.json({ ok: true, count: result.sent, sent: result.sent, failed: result.failed });
  } catch (e) {
    log.error("BROADCAST", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── /api/dl (GET) — proxy video download info ───────────────────────────────
app.get("/api/dl", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ ok: false, error: "url required" });
  try {
    const axios  = require("axios");
    const apiUrl = `https://mahabub-aldl.vercel.app/api/dl?url=${encodeURIComponent(url)}`;
    const r      = await axios.get(apiUrl, { timeout: 15000 });
    res.json({ ok: true, ...r.data });
  } catch (e) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

// ── /api/whitelist (GET) — list allowed chat IDs ──────────────────────────
app.get("/api/whitelist", (req, res) => {
  res.json({ ok: true, allowedChatIds: config.whiteListMode?.allowedChatIds || [] });
});

// ── /api/whitelist (POST) — add a chat ID ─────────────────────────────────
app.post("/api/whitelist", (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "id required" });
    const list = config.whiteListMode?.allowedChatIds || [];
    const strId = String(id);
    if (!list.includes(strId)) list.push(strId);
    config.whiteListMode = { ...config.whiteListMode, allowedChatIds: list };
    const cfgPath = path.join(__dirname, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf8");
    res.json({ ok: true, allowedChatIds: list });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── /api/whitelist (DELETE) — remove a chat ID ────────────────────────────
app.delete("/api/whitelist/:id", (req, res) => {
  try {
    const strId = String(req.params.id);
    const list = (config.whiteListMode?.allowedChatIds || []).filter(x => x !== strId);
    config.whiteListMode = { ...config.whiteListMode, allowedChatIds: list };
    const cfgPath = path.join(__dirname, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf8");
    res.json({ ok: true, allowedChatIds: list });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── /api/blacklist (GET) — list blocked users/chats ───────────────────────
app.get("/api/blacklist", (req, res) => {
  res.json({ ok: true, users: config.blackList?.users || [], chats: config.blackList?.chats || [] });
});

// ── /api/blacklist (POST) — add a user or chat ID ─────────────────────────
app.post("/api/blacklist", (req, res) => {
  try {
    const { id, type } = req.body || {};
    if (!id || !type) return res.status(400).json({ ok: false, error: "id and type required" });
    const bl = { users: [...(config.blackList?.users || [])], chats: [...(config.blackList?.chats || [])] };
    const strId = String(id);
    if (type === "user"  && !bl.users.includes(strId)) bl.users.push(strId);
    if (type === "chat"  && !bl.chats.includes(strId)) bl.chats.push(strId);
    config.blackList = bl;
    const cfgPath = path.join(__dirname, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf8");
    res.json({ ok: true, ...bl });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── /api/blacklist (DELETE) — remove a user or chat ID ────────────────────
app.delete("/api/blacklist/:id/:type", (req, res) => {
  try {
    const strId = String(req.params.id);
    const { type } = req.params;
    const bl = { users: [...(config.blackList?.users || [])], chats: [...(config.blackList?.chats || [])] };
    if (type === "user") bl.users = bl.users.filter(x => x !== strId);
    if (type === "chat") bl.chats = bl.chats.filter(x => x !== strId);
    config.blackList = bl;
    const cfgPath = path.join(__dirname, "config.json");
    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), "utf8");
    res.json({ ok: true, ...bl });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── /api/restart (POST) — graceful restart ──────────────────────────────────
app.post("/api/restart", (req, res) => {
  log.warn("PROCESS", "Restart requested from dashboard");
  res.json({ ok: true, message: "Restarting…" });
  setTimeout(() => process.exit(2), 500); // exit(2) triggers index.js auto-restart
});

app.get("/", (req, res) => {
  const p = path.join(__dirname, "public", "index.html");
  if (fs.existsSync(p)) return res.sendFile(p);
  res.send(`<h2>✅ ${config.botName} is running</h2>`);
});

app.listen(port, () => {
  log.success("SERVER", `Dashboard on port ${port}`);
  const { keepAlive } = require("./bot/keepAlive.js");
  keepAlive(config.webhookUrl || `http://localhost:${port}/ping`);
});

// ── BANNER ──────────────────────────────────────────────────────────────────
figlet(config.botName || "GoatBot", { font: "Slant" }, (err, data) => {
  if (!err) console.log(chalk.cyan.bold(data));
  log.success("BOOT", `${config.botName} — ${global.GoatBot.commands.size} cmds | ${global.GoatBot.eventCommands.size} events`);
});
