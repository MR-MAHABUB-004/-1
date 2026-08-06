# 🐐 GoatBot-Style Telegram Bot Framework

A fully modular Telegram bot framework that mirrors **GoatBot V2**'s architecture — commands, events, per-thread database, prefix system, roles, onReply, onChat, and more.

---

## 📁 Project Structure

```
telegram-goatbot/
│
├── GoatBot.js              ← Main entry point
├── index.js                ← Auto-restart wrapper
├── config.json             ← Bot configuration
│
├── core/
│   ├── database.js         ← JSON database (threads, users, global)
│   ├── utils.js            ← Global utilities (global.utils)
│   ├── handleMessage.js    ← Main message dispatcher
│   ├── loadCommands.js     ← Command loader
│   └── loadEvents.js       ← Event loader
│
├── scripts/
│   ├── cmds/               ← YOUR COMMANDS go here
│   │   ├── _TEMPLATE.js    ← Copy this to make a new command
│   │   ├── help.js
│   │   ├── info.js
│   │   ├── uid.js
│   │   ├── prefix.js
│   │   ├── kick.js
│   │   ├── tag.js
│   │   ├── thread.js
│   │   ├── rank.js
│   │   ├── guessnumber.js
│   │   ├── broadcast.js
│   │   └── reload.js
│   │
│   └── events/             ← YOUR EVENTS go here
│       ├── _TEMPLATE.js    ← Copy this to make a new event
│       ├── welcome.js
│       └── leave.js
│
├── database/               ← Auto-created JSON files
│   ├── threads.json        ← Per-chat settings
│   ├── users.json          ← Per-user data
│   └── global.json         ← Shared key-value store
│
└── logger/
    └── log.js              ← Coloured logger
```

---

## ⚙️ Setup

**1. Install dependencies**
```bash
npm install
```

**2. Edit `config.json`**
```json
{
  "botToken":  "YOUR_TELEGRAM_BOT_TOKEN",
  "botName":   "MyBot",
  "prefix":    "/",
  "adminBot":  ["YOUR_TELEGRAM_USER_ID"]
}
```

Get your bot token from [@BotFather](https://t.me/BotFather).  
Get your user ID from [@userinfobot](https://t.me/userinfobot).

**3. Start the bot**
```bash
node index.js        # with auto-restart
# or
node GoatBot.js      # direct
```

---

## 🧩 Creating a Command

Copy `scripts/cmds/_TEMPLATE.js` and fill it in:

```js
module.exports = {
  config: {
    name:      "greet",
    aliases:   ["hi", "hello"],
    usePrefix: true,          // /greet or just greet
    role:      0,             // 0=everyone  1=group-admin  2=bot-admin
    category:  "fun",
    countDown: 3,             // cooldown seconds
    description: { en: "Greet a user" },
    guide:       { en: "{pn} <name>" },
  },

  langs: {
    en: {
      greet: "👋 Hello, %1!",
      noArg: "❌ Tell me a name.",
    },
  },

  onStart: async function ({ message, args, getLang }) {
    if (!args[0]) return message.reply(getLang("noArg"));
    return message.reply(getLang("greet").replace("%1", args[0]));
  },
};
```

Drop it in `scripts/cmds/` — it loads automatically on next start (or `/reload`).

---

## 🔁 Multi-Turn Commands (onReply)

```js
onStart: async function ({ message, getLang, setPendingReply }) {
  setPendingReply("mycommand", { step: 1 });
  return message.reply("What is your name?");
},

onReply: async function ({ event, message, getLang, pendingData, setPendingReply }) {
  if (pendingData.step === 1) {
    setPendingReply("mycommand", { step: 2, name: event.body });
    return message.reply(`Hi ${event.body}! How old are you?`);
  }
  return message.reply(`Got it: ${pendingData.name}, age ${event.body}`);
},
```

---

## 📡 Creating an Event

```js
module.exports = {
  config: {
    name:      "antispam",
    eventType: "message",    // message | join | leave | callback_query | *
  },
  onStart: async function ({ event, message, threadsData }) {
    // runs on every message
  },
};
```

---

## 🗄️ Database API

```js
// In any command — threadsData, usersData, globalData are injected

// Get a record (returns null if not found)
const thread = threadsData.get(event.threadID);

// Get or create with defaults
const user = usersData.getOrCreate(event.senderID, { name: "Unknown" });

// Set a single key
threadsData.set(event.threadID, "prefix", "!");

// Update multiple keys at once
usersData.update(event.senderID, { exp: 100, money: 500 });

// Delete a record
globalData.delete("someKey");

// Get all records
const allUsers = usersData.getAll(); // returns plain object { id: record }
```

---

## 🔑 Permission Roles

| Role | Who |
|------|-----|
| `0`  | Everyone |
| `1`  | Group admins (or bot admins) |
| `2`  | Bot admins only (`adminBot` in config.json) |

---

## 💬 message API (inside commands)

```js
message.reply(text)                   // reply to triggering message
message.send(text, chatId?)           // send to any chat
message.sendPhoto(urlOrFileId, caption?)
message.sendVideo(urlOrFileId, caption?)
message.sendDocument(source, caption?)
message.sendAudio(source, caption?)
message.sendSticker(source)
message.edit(messageId, newText)
message.delete(messageId?)
message.action("typing")              // show "Bot is typing..."
message.react("👍")                   // emoji reaction (Bot API 7.0+)
```

---

## 🌐 Dashboard

Visit `http://localhost:3000` for a live stats page.  
API endpoint: `GET /api/stats`

---

## 📣 Broadcast

From any command:
```js
const { sent, failed } = await global.broadcast("Hello everyone!");
```

---

## 🔄 Hot Reload

```
/reload          → reload all commands and events
/reload greet    → reload only the greet command
```

No restart needed.
