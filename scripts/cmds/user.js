"use strict";

module.exports = {
  config: {
    name:      "user",
    aliases:   ["userinfo", "member"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "info",
    countDown: 5,
    description: { en: "View user data stored by the bot" },
    guide: {
      en:
        "{pn} — your data\n" +
        "{pn} (reply) — replied user's data\n" +
        "{pn} set <key> <value> — edit your own data (admin: any user)",
    },
  },

  langs: {
    en: {
      noData:    "❌ No data found for that user.",
      profile:   "👤 *User Data*\n🆔 ID: `%1`\n📛 Name: %2\n🔗 Username: %3\n⭐ EXP: %4\n💰 Money: %5\n💬 Messages: %6\n🕐 First seen: %7",
      setDone:   "✅ Set `%1` = `%2` for %3.",
      noAdmin:   "❌ Only bot admins can edit other users' data.",
      badKey:    "❌ Key must be `exp` or `money`.",
      badVal:    "❌ Value must be a number.",
    },
  },

  onStart: async function ({ api, event, message, args, role, getLang, usersData }) {
    const msg = event.raw;

    // ── set <key> <value> ─────────────────────────────────────────────────────
    if (args[0] === "set") {
      const key   = args[1]?.toLowerCase();
      const val   = parseFloat(args[2]);
      const allowed = ["exp", "money"];

      if (!allowed.includes(key)) return message.reply(getLang("badKey"));
      if (isNaN(val))             return message.reply(getLang("badVal"));

      // Non-admins can only edit themselves
      let targetId = event.senderID;
      if (event.messageReply) {
        if (role < 2) return message.reply(getLang("noAdmin"));
        targetId = String(msg.reply_to_message.from.id);
      }

      const user = usersData.getOrCreate(targetId);
      usersData.set(targetId, key, val);

      const name = user.name || `User ${targetId}`;
      return message.reply(
        getLang("setDone").replace("%1", key).replace("%2", val).replace("%3", name)
      );
    }

    // ── view profile ──────────────────────────────────────────────────────────
    let targetFrom = msg.from;
    let targetId   = event.senderID;

    if (event.messageReply) {
      targetFrom = msg.reply_to_message.from;
      targetId   = String(targetFrom.id);
    }

    const user = usersData.get(targetId);
    if (!user) return message.reply(getLang("noData"));

    const name     = user.name || `${targetFrom.first_name || ""}`.trim();
    const username = targetFrom.username ? `@${targetFrom.username}` : "none";
    const firstSeen = user.createdAt
      ? new Date(user.createdAt).toLocaleDateString("en-US")
      : "unknown";

    return message.reply(
      getLang("profile")
        .replace("%1", targetId)
        .replace("%2", name)
        .replace("%3", username)
        .replace("%4", user.exp    || 0)
        .replace("%5", user.money  || 0)
        .replace("%6", user.messageCount || 0)
        .replace("%7", firstSeen)
    );
  },
};
