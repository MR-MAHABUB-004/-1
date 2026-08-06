"use strict";

module.exports = {
  config: {
    name:      "approve",
    aliases:   ["unapprove"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      2,         // bot admin only
    category:  "admin",
    countDown: 5,
    description: { en: "Approve or unapprove a chat (used when config.approval = true)" },
    guide: {
      en:
        "{pn}            — approve this chat\n" +
        "{pn} <chat_id>  — approve a specific chat\n" +
        "unapprove       — remove approval\n" +
        "{pn} list       — show all approved chats",
    },
  },

  langs: {
    en: {
      approved:   "✅ Chat `%1` approved.",
      unapproved: "🔴 Chat `%1` unapproved.",
      alreadyOn:  "⚠️ This chat is already approved.",
      notOn:      "⚠️ This chat is not in the approved list.",
      list:       "📋 *Approved Chats (%1)*\n\n%2",
      listEmpty:  "📭 No chats approved yet.",
    },
  },

  onStart: async function ({ event, message, args, getLang, globalData }) {
    const isUnapprove = event.body?.toLowerCase().includes("unapprove");
    const sub         = args[0]?.toLowerCase();

    // ── List ──────────────────────────────────────────────────────────────────
    if (sub === "list") {
      const rec      = await globalData.get("approved") || {};
      const approved = Array.isArray(rec.approved) ? rec.approved : [];
      if (!approved.length) return message.reply(getLang("listEmpty"));
      return message.reply(
        getLang("list")
          .replace("%1", approved.length)
          .replace("%2", approved.map((id, i) => `${i + 1}. \`${id}\``).join("\n"))
      );
    }

    const targetId = args[0] || event.threadID;

    // Load current approved list
    const rec      = await globalData.get("approved") || {};
    const approved = Array.isArray(rec.approved) ? [...rec.approved] : [];

    if (isUnapprove) {
      if (!approved.includes(String(targetId))) {
        return message.reply(getLang("notOn"));
      }
      const updated = approved.filter(id => id !== String(targetId));
      await globalData.set("approved", { ...rec, approved: updated });
      return message.reply(getLang("unapproved").replace("%1", targetId));
    }

    // Approve
    if (approved.includes(String(targetId))) {
      return message.reply(getLang("alreadyOn"));
    }
    approved.push(String(targetId));
    await globalData.set("approved", { ...rec, approved });
    return message.reply(getLang("approved").replace("%1", targetId));
  },
};
