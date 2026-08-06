"use strict";

const Start = new Date();

module.exports = {
  config: {
    name:        "uptime",
    aliases:     ["up", "runtime"],
    version:     "1.0",
    author:      "Mahabub",
    usePrefix:   true,
    role:        0,
    countDown:   3,
    category:    "info",
    description: { en: "Check the bot's runtime duration." },
    guide:       { en: "{pn}" }
  },

  onStart: async function ({ api, event, message }) {
    const { threadID, messageID } = event;
    const now     = new Date();
    const totalMs = now - Start;

    const totalSec = Math.floor(totalMs / 1000);
    const totalMin = Math.floor(totalSec / 60);
    const totalHr  = Math.floor(totalMin / 60);
    const days     = Math.floor(totalHr  / 24);

    const uptimeMessage =
      `𝗔𝗰𝘁𝗶𝘃𝗲 ⚙️: ` +
      `${days} 𝗱𝗮𝘆(𝘀), ` +
      `${totalHr  % 24} 𝗵𝗼𝘂𝗿(𝘀), ` +
      `${totalMin % 60} 𝗺𝗶𝗻𝘂𝘁𝗲(𝘀), ` +
      `${totalSec % 60} 𝘀𝗲𝗰𝗼𝗻𝗱(𝘀).`;

    return api.sendMessage(
      threadID,
      uptimeMessage,
      {
        reply_to_message_id: messageID,
        reply_markup: {
          inline_keyboard: [
            [{ text: "𝗕𝗼𝘁 𝗢𝘄𝗻𝗲𝗿", url: "https://t.me/MAHABUB_RAHMAN777" }]
          ]
        }
      }
    );
  }
};
