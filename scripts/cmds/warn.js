"use strict";

const MAX_WARNINGS = 3; // auto-kick after this many

module.exports = {
  config: {
    name:      "warn",
    aliases:   ["warning", "unwarn", "warns"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      1,
    category:  "admin",
    countDown: 5,
    description: { en: "Warn a user — auto-kicks after 3 warnings" },
    guide: {
      en:
        "{pn} (reply) [reason] — warn a user\n" +
        "unwarn (reply) — remove last warning\n" +
        "warns (reply)  — check user's warnings",
    },
  },

  langs: {
    en: {
      notGroup:   "❌ Only usable in groups.",
      noTarget:   "❌ Reply to the user you want to warn.",
      cantWarnAdmin: "❌ Can't warn an admin.",
      warned:     "⚠️ *%1* has been warned.\nReason: %2\nWarnings: *%3/%4*",
      autoKick:   "🚫 *%1* has been kicked after reaching *%2* warnings.",
      unwarned:   "✅ Removed a warning from *%1*. Warnings: *%2/%3*",
      noWarnings: "✅ *%1* has no warnings.",
      warnsInfo:  "📋 *%1* — Warnings: *%2/%3*\n\n%4",
      warnsEmpty: "📋 *%1* has no warnings.",
      warnsRow:   "%1. %2 — _%3_",
    },
  },

  onStart: async function ({ api, event, message, args, getLang, threadsData, usersData }) {
    if (!event.isGroup) return message.reply(getLang("notGroup"));

    const msg    = event.raw;
    const chatId = String(msg.chat.id);
    const cmd    = msg.text?.split(" ")[0].replace(/\//, "").toLowerCase();

    if (!event.messageReply) return message.reply(getLang("noTarget"));

    const target     = msg.reply_to_message.from;
    const targetId   = String(target.id);
    const targetName = `${target.first_name || ""}`.trim();

    // Load warnings store from threadsData (per-chat)
    const thread   = threadsData.getOrCreate(chatId);
    const warnData = thread.warnings || {};
    const userWarn = warnData[targetId] || { count: 0, reasons: [] };

    // ── warns — view warnings ─────────────────────────────────────────────────
    if (cmd === "warns") {
      if (!userWarn.count) {
        return message.reply(getLang("warnsEmpty").replace("%1", targetName));
      }
      const rows = userWarn.reasons.map((r, i) =>
        getLang("warnsRow")
          .replace("%1", i + 1)
          .replace("%2", r.reason || "No reason")
          .replace("%3", new Date(r.date).toLocaleDateString())
      ).join("\n");

      return message.reply(
        getLang("warnsInfo")
          .replace("%1", targetName)
          .replace("%2", userWarn.count)
          .replace("%3", MAX_WARNINGS)
          .replace("%4", rows)
      );
    }

    // ── unwarn — remove a warning ──────────────────────────────────────────────
    if (cmd === "unwarn") {
      if (!userWarn.count) {
        return message.reply(getLang("noWarnings").replace("%1", targetName));
      }
      userWarn.count--;
      userWarn.reasons.pop();
      warnData[targetId] = userWarn;
      threadsData.set(chatId, "warnings", warnData);

      return message.reply(
        getLang("unwarned")
          .replace("%1", targetName)
          .replace("%2", userWarn.count)
          .replace("%3", MAX_WARNINGS)
      );
    }

    // ── warn ──────────────────────────────────────────────────────────────────
    // Check if target is admin
    try {
      const member = await api.getChatMember(msg.chat.id, targetId);
      if (["administrator", "creator"].includes(member.status)) {
        return message.reply(getLang("cantWarnAdmin"));
      }
    } catch {}

    const reason = args.join(" ") || "No reason provided";
    userWarn.count++;
    userWarn.reasons.push({ reason, date: Date.now() });
    warnData[targetId] = userWarn;
    threadsData.set(chatId, "warnings", warnData);

    // Auto-kick on max warnings
    if (userWarn.count >= MAX_WARNINGS) {
      try {
        await api.banChatMember(msg.chat.id, parseInt(targetId));
        await api.unbanChatMember(msg.chat.id, parseInt(targetId), { only_if_banned: true });
        // Reset warnings after kick
        delete warnData[targetId];
        threadsData.set(chatId, "warnings", warnData);
      } catch {}

      return message.reply(
        getLang("autoKick").replace("%1", targetName).replace("%2", MAX_WARNINGS)
      );
    }

    return message.reply(
      getLang("warned")
        .replace("%1", targetName)
        .replace("%2", reason)
        .replace("%3", userWarn.count)
        .replace("%4", MAX_WARNINGS)
    );
  },
};
