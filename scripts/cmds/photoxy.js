"use strict";

/**
 * scripts/cmds/photoxy.js
 * ──────────────────────────────────────────────────────────────
 * Text-effect image generator
 *   /photoxy <text>            → default effect (shadow)
 *   /photoxy <effect> <text>   → e.g. /photoxy love Sumu apu
 * ──────────────────────────────────────────────────────────────
 */

const axios = require("axios");

const API_BASE = "https://photogen-api-833c.onrender.com";
const FALLBACK_EFFECTS = ["love", "shadow", "water"]; // used only if the live fetch fails
const DEFAULT_EFFECT = "shadow";

async function fetchAvailableEffects() {
  try {
    const { data } = await axios.get(API_BASE, { timeout: 10000 });
    if (data && Array.isArray(data.availableEffects) && data.availableEffects.length > 0) {
      return data.availableEffects;
    }
  } catch (_) {
    // fall through to fallback list below
  }
  return FALLBACK_EFFECTS;
}

module.exports = {
  config: {
    name: "photoxy",
    aliases: ["texteffect", "txe"],
    version: "1.0.0",
    author: "System",
    usePrefix: true,
    role: 0,
    category: "media",
    countDown: 6,

    description: {
      en: "টেক্সট দিয়ে স্টাইলিশ ইমেজ বানান",
    },

    guide: {
      en:
        "{pn} <লেখা>                — ডিফল্ট effect দিয়ে বানায়\n" +
        "{pn} <effect> <লেখা>       — নির্দিষ্ট effect দিয়ে বানায়\n" +
        "{pn}                       — available effect-গুলো দেখায়\n" +
        "উদাহরণ: {pn} Sumu apu\n" +
        "উদাহরণ: {pn} love Sumu apu",
    },
  },

  langs: {
    en: {
      noQuery:
        "🎨 কিছু লেখা দিন।\nউদাহরণ: {pn} Sumu apu\n\nAvailable effects: %1",

      generating:
        "🎨 ইমেজ বানানো হচ্ছে...",

      failed:
        "❌ ইমেজ বানাতে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
    },
  },

  onStart: async function ({ api, event, message, args, getLang, prefix }) {
    const chatId = event.threadID;
    const raw = args.join(" ").trim();

    // Always pull the current effect list from the API itself, rather
    // than relying on a hardcoded/stale copy.
    const effects = await fetchAvailableEffects();

    if (!raw) {
      return message.reply(
        getLang("noQuery")
          .replace("{pn}", prefix + this.config.name)
          .replace("%1", effects.join(", "))
      );
    }

    // If the first word names a known effect, use it and treat the rest
    // as the text; otherwise use the default effect on the whole input.
    const firstWord = args[0].toLowerCase();
    let effect = effects.includes(DEFAULT_EFFECT) ? DEFAULT_EFFECT : effects[0];
    let text = raw;

    if (effects.includes(firstWord) && args.length > 1) {
      effect = firstWord;
      text = args.slice(1).join(" ").trim();
    }

    const statusMsg = await message.reply(getLang("generating"));

    try {
      const url =
        `${API_BASE}/api?effect=${encodeURIComponent(effect)}` +
        `&effectName=${encodeURIComponent(text)}`;

      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000,
        validateStatus: () => true,
      });

      const contentType = String(res.headers["content-type"] || "");

      if (res.status !== 200 || !contentType.startsWith("image/")) {
        // API returned an error / JSON instead of an image
        console.error(
          "[PHOTOXY ERROR] status:",
          res.status,
          "content-type:",
          contentType,
          "body:",
          Buffer.isBuffer(res.data) ? res.data.toString("utf8").slice(0, 300) : res.data
        );
        throw new Error("Non-image response from API");
      }

      const imageBuffer = Buffer.from(res.data);

      try {
        await api.deleteMessage(chatId, statusMsg.message_id);
      } catch (_) {}

      await api.sendPhoto(chatId, imageBuffer, {
        caption: `🎨 "${text}" — ${effect}`,
      });
    } catch (error) {
      console.error("[PHOTOXY ERROR]", error.message);

      try {
        await api.editMessageText(getLang("failed"), {
          chat_id: chatId,
          message_id: statusMsg.message_id,
        });
      } catch (_) {
        try {
          await message.reply(getLang("failed"));
        } catch (_) {}
      }
    }
  },
};
