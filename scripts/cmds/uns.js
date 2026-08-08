"use strict";

module.exports = {
  config: {
    name:      "uns",
    aliases:   ["unsend", "delmsg"],
    version:   "1.0.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "utility",
    countDown: 5,
    description: { en: "বটের কোনো মেসেজে reply করে সেটা মুছে ফেলুন (unsend)" },
    guide:       { en: "বটের যেকোনো মেসেজে reply করে {pn} লিখুন" },
  },

  langs: {
    en: {
      noReply:
        "❌ যে মেসেজটা unsend করতে চান, সেটাতে reply করে {pn} লিখুন।",

      notBot:
        "⚠️ শুধু বটের নিজের পাঠানো মেসেজ unsend করা যায়।",

      failed:
        "❌ মেসেজটা মুছা যায়নি — হয়তো অনেক পুরোনো বা আগেই মুছে ফেলা হয়েছে।",
    },
  },

  onStart: async function ({ api, event, message, getLang, prefix }) {
    const chatId  = event.threadID;
    const replied = event.messageReply;

    if (!replied) {
      return message.reply(
        getLang("noReply").replace("{pn}", prefix + this.config.name)
      );
    }

    // Confirm the replied-to message was actually sent by the bot, using
    // the same sent-message tracker that powers /clear (see GoatBot.js).
    const tracked = (global.sentMessages && global.sentMessages.get(String(chatId))) || [];

    if (!tracked.includes(replied.messageID)) {
      return message.reply(getLang("notBot"));
    }

    try {
      await api.deleteMessage(chatId, replied.messageID);

      // Drop it from tracking so /clear doesn't try it again.
      global.sentMessages.set(
        String(chatId),
        tracked.filter((id) => id !== replied.messageID)
      );

      // Clean up — also remove the "/uns" trigger message itself.
      await message.delete().catch(() => {});
    } catch (_) {
      return message.reply(getLang("failed"));
    }
  },
};
