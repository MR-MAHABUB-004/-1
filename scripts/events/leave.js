"use strict";

module.exports = {
  config: {
    name:      "leave",
    version:   "1.0",
    author:    "System",
    category:  "events",
    eventType: "leave",
  },

  langs: {
    en: {
      defaultMsg: "👋 *%1* has left the group.",
    },
  },

  onStart: async function ({ event, message, threadsData, getLang }) {
    const msg       = event.raw;
    const chatId    = String(msg.chat.id);
    const thread    = threadsData.get(chatId);
    const member    = event.leftMember;
    if (!member || member.is_bot) return;

    const name   = `${member.first_name || ""} ${member.last_name || ""}`.trim();
    const custom = thread?.leaveMsg;

    const text = custom
      ? custom.replace("{userName}", name).replace("{boxName}", msg.chat.title || "")
      : getLang("defaultMsg").replace("%1", name);

    await message.send(text, msg.chat.id);
  },
};
