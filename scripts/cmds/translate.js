"use strict";

const https = require("https");

// Uses the free LibreTranslate public instance — no API key needed
const LIBRE_URL = "https://libretranslate.com/translate";

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data   = JSON.stringify(body);
    const parsed = new URL(url);
    const opts   = {
      hostname: parsed.hostname,
      path:     parsed.pathname,
      method:   "POST",
      headers:  {
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, res => {
      let buf = "";
      res.on("data", c => buf += c);
      res.on("end", () => {
        try { resolve(JSON.parse(buf)); }
        catch { reject(new Error("Invalid JSON response")); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

module.exports = {
  config: {
    name:      "translate",
    aliases:   ["tr", "tl"],
    version:   "1.0",
    author:    "System",
    usePrefix: true,
    role:      0,
    category:  "utility",
    countDown: 5,
    description: { en: "Translate text to any language using LibreTranslate" },
    guide: {
      en:
        "{pn} <lang> <text> — translate text\n" +
        "{pn} <lang> (reply) — translate a replied message\n" +
        "Examples: {pn} bn Hello | {pn} fr Good morning\n" +
        "Common codes: en=English, bn=Bengali, fr=French, es=Spanish, ar=Arabic, hi=Hindi",
    },
  },

  langs: {
    en: {
      noText:    "❌ Provide text or reply to a message to translate.",
      noLang:    "❌ Provide a target language code (e.g. `bn`, `fr`, `es`).",
      wait:      "🌐 Translating...",
      result:    "🌐 *Translation*\n🔤 Original (%1):\n%2\n\n🔡 Translated (%3):\n%4",
      error:     "❌ Translation failed: %1",
    },
  },

  onStart: async function ({ event, message, args, getLang }) {
    const msg = event.raw;

    if (!args[0]) return message.reply(getLang("noLang"));

    const targetLang = args[0].toLowerCase();
    let   textToTranslate;

    if (event.messageReply) {
      textToTranslate = event.messageReply.body;
    } else {
      textToTranslate = args.slice(1).join(" ");
    }

    if (!textToTranslate) return message.reply(getLang("noText"));

    const waiting = await message.reply(getLang("wait"));

    try {
      const result = await post(LIBRE_URL, {
        q:      textToTranslate,
        source: "auto",
        target: targetLang,
        format: "text",
      });

      if (result.error) throw new Error(result.error);

      const translated   = result.translatedText;
      const detectedLang = result.detectedLanguage?.language || "auto";

      // Delete the "translating…" message if possible
      try { await message.delete(waiting.message_id); } catch {}

      return message.reply(
        getLang("result")
          .replace("%1", detectedLang)
          .replace("%2", textToTranslate)
          .replace("%3", targetLang)
          .replace("%4", translated)
      );
    } catch (e) {
      try { await message.delete(waiting.message_id); } catch {}
      return message.reply(getLang("error").replace("%1", e.message));
    }
  },
};
