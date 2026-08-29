"use strict";

/**
 * scripts/cmds/song.js
 * ──────────────────────────────────────────────────────────────
 * Song search + download
 *   /song <name>  → shows matching results as buttons
 *   tap a button  → downloads and sends that track as audio
 *
 * Search:   yt-search (npm)
 * Download: scripts/cmds/API/song/song.js (in-process module)
 *
 * Callback format:
 *   song:pick:<token>
 * ──────────────────────────────────────────────────────────────
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const stream = require("stream");
const yts = require("yt-search");
const songApi = require("./API/song/song.js");

const finished = promisify(stream.finished);

// ---------------------------------------------------------------------------
// Callback data cache (same short-token pattern as apk.js)
// ---------------------------------------------------------------------------

const cbCache = new Map(); // token -> { videoId, title, author, duration, thumbnail }

function cacheData(payload) {
  const token =
    Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8);

  cbCache.set(token, payload);

  if (cbCache.size > 500) {
    const firstKey = cbCache.keys().next().value;
    cbCache.delete(firstKey);
  }

  return token;
}

function getCached(token) {
  return cbCache.get(token) || null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeFileName(name) {
  return String(name || "audio")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 100);
}

async function downloadFile(url, destPath) {
  const writer = fs.createWriteStream(destPath);

  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      timeout: 120000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
    });

    response.data.pipe(writer);
    await finished(writer);

    return destPath;
  } catch (error) {
    writer.destroy();
    try {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    } catch (_) {}
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Command configuration
// ---------------------------------------------------------------------------

module.exports = {
  config: {
    name: "song",
    aliases: ["ytsong", "gan"],
    version: "1.0.0",
    author: "Mahabub",
    usePrefix: true,
    role: 0,
    category: "media",
    countDown: 8,

    description: {
      en: "গানের নাম দিয়ে সার্চ করে ডাউনলোড করুন",
    },

    guide: {
      en: "{pn} <গানের নাম>\nউদাহরণ: {pn} Daulat Shohrat Kya Karni",
    },
  },

  langs: {
    en: {
      noQuery:
        "❌ একটা গানের নাম দিন।\nউদাহরণ: {pn} Daulat Shohrat Kya Karni",

      searching:
        "🔍 \"%1\" খোঁজা হচ্ছে...",

      searchError:
        "⚠️ সার্চ করতে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",

      noResults:
        "😔 \"%1\" নামে কোনো গান পাওয়া যায়নি।",

      resultsTitle:
        "🎵 \"%1\" এর সাথে মিলে যাওয়া গান — একটা বেছে নিন:",

      resultButton:
        "%1 • %2",

      sessionExpired:
        "⌛ এই সেশনের মেয়াদ শেষ। আবার সার্চ করুন {pn} <নাম> লিখে।",

      fetching:
        "🎵 লিংক প্রস্তুত করা হচ্ছে... (৩০-৬০ সেকেন্ড লাগতে পারে)",

      fetchError:
        "⚠️ এই গানের অডিও পাওয়া যায়নি। আরেকটা রেজাল্ট বেছে নিন বা আবার সার্চ করুন।",

      downloading:
        "⬇️ *%1*\n⏳ ডাউনলোড হচ্ছে, একটু অপেক্ষা করুন...",

      fileTooLarge:
        "📁 ফাইলের সাইজ টেলিগ্রামের ৫০ MB সীমার বেশি, তাই এখানে পাঠানো গেল না।\n\n🔗 সরাসরি লিংক:\n%1",

      sendFailed:
        "❌ অডিও পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    },
  },

  // =========================================================================
  // COMMAND — search
  // =========================================================================

  onStart: async function ({ message, args, getLang, prefix }) {
    const query = args.join(" ").trim();

    if (!query) {
      return message.reply(
        getLang("noQuery").replace("{pn}", prefix + this.config.name)
      );
    }

    const statusMsg = await message.reply(
      getLang("searching").replace("%1", query)
    );

    try {
      const result = await yts(query);
      const videos = (result && result.videos) || [];

      if (videos.length === 0) {
        return message.edit(
          statusMsg.message_id,
          getLang("noResults").replace("%1", query)
        );
      }

      const top = videos.slice(0, 6);

      const keyboard = top.map((v) => {
        const token = cacheData({
          videoId: v.videoId,
          title: v.title || "Unknown",
          author: (v.author && v.author.name) || "",
          duration: (v.seconds || (v.duration && v.duration.seconds)) || 0,
          thumbnail: v.thumbnail || null,
        });

        const label = getLang("resultButton")
          .replace("%1", v.title || "Unknown")
          .replace("%2", v.timestamp || "?");

        return [
          {
            text: label.length > 60 ? label.slice(0, 57) + "..." : label,
            callback_data: `song:pick:${token}`,
          },
        ];
      });

      await message.edit(
        statusMsg.message_id,
        getLang("resultsTitle").replace("%1", query),
        { reply_markup: { inline_keyboard: keyboard } }
      );
    } catch (error) {
      console.error("[SONG SEARCH ERROR]", error);

      try {
        await message.edit(statusMsg.message_id, getLang("searchError"));
      } catch (_) {}
    }
  },

  // =========================================================================
  // CALLBACK QUERY — pick + download
  // =========================================================================

  onCallbackQuery: async function ({ event, api, getLang, callbackData, query }) {
    // Namespace guard — see apk.js/xnx.js for why this matters: the
    // framework broadcasts every callback to every command's handler.
    if (!callbackData || !callbackData.startsWith("song:")) return;

    const callbackQueryId = query && query.id;

    try {
      if (callbackQueryId) await api.answerCallbackQuery(callbackQueryId);
    } catch (_) {}

    try {
      const chatId = event.threadID;
      const msgId = event.messageID;

      const parts = callbackData.split(":");
      const action = parts[1] || "";
      const token = parts[2] || "";

      const notify = async (text, showAlert) => {
        if (!callbackQueryId) return;
        try {
          await api.answerCallbackQuery(callbackQueryId, {
            text,
            show_alert: !!showAlert,
          });
        } catch (_) {}
      };

      if (action !== "pick") return;

      const cached = getCached(token);

      if (!cached || !cached.videoId) {
        await notify(getLang("sessionExpired"), true);
        return;
      }

      const { videoId, title, author, duration, thumbnail } = cached;

      await notify(getLang("fetching"));

      try {
        await api.editMessageText(getLang("fetching"), {
          chat_id: chatId,
          message_id: msgId,
        });
      } catch (_) {}

      // ---------------------------------------------------------------
      // Resolve the direct audio URL
      // ---------------------------------------------------------------

      let audioUrl;

      try {
        const result = await songApi.getMp3(`https://youtu.be/${videoId}`);

        if (!result || !result.success || !result.data || !result.data.download_url) {
          throw new Error((result && result.error) || "No download_url");
        }
        audioUrl = result.data.download_url;
      } catch (error) {
        console.error("[SONG FETCH ERROR]", error.message);

        try {
          await api.editMessageText(getLang("fetchError"), {
            chat_id: chatId,
            message_id: msgId,
          });
        } catch (_) {}

        return;
      }

      try {
        await api.editMessageText(
          getLang("downloading").replace("%1", title),
          { chat_id: chatId, message_id: msgId, parse_mode: "Markdown" }
        );
      } catch (_) {}

      const tempDir = path.join(__dirname, "../temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const tempPath = path.join(
        tempDir,
        `song_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
      );

      try {
        // -------------------------------------------------------------
        // Size pre-check where possible
        // -------------------------------------------------------------

        try {
          const head = await axios.head(audioUrl, { timeout: 10000 });
          const sizeMB =
            parseInt(head.headers["content-length"] || "0", 10) / (1024 * 1024);

          if (sizeMB > 49) {
            return api.sendMessage(
              chatId,
              getLang("fileTooLarge").replace("%1", audioUrl)
            );
          }
        } catch (_) {}

        // -------------------------------------------------------------
        // Download
        // -------------------------------------------------------------

        await downloadFile(audioUrl, tempPath);

        const stat = fs.statSync(tempPath);
        const actualMB = stat.size / (1024 * 1024);

        if (actualMB > 49) {
          fs.unlinkSync(tempPath);
          return api.sendMessage(
            chatId,
            getLang("fileTooLarge").replace("%1", audioUrl)
          );
        }

        // -------------------------------------------------------------
        // Thumbnail — Telegram's `thumb` param requires a local file/
        // stream, not a plain URL. Download it first; if that fails,
        // just skip the thumbnail rather than letting sendAudio crash.
        // -------------------------------------------------------------

        let thumbPath = null;
        if (thumbnail) {
          try {
            thumbPath = path.join(
              tempDir,
              `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
            );
            await downloadFile(thumbnail, thumbPath);
          } catch (_) {
            thumbPath = null;
          }
        }

        // -------------------------------------------------------------
        // Send audio
        // -------------------------------------------------------------

        const fileName = `${safeFileName(title)}.mp3`;
        const durationText = duration
          ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`
          : "?";

        await api.sendAudio(
          chatId,
          fs.createReadStream(tempPath),
          {
            title,
            performer: author || undefined,
            duration: duration || undefined,
            thumb: thumbPath || undefined,
            caption: `🎵 *${title}*${author ? `\n👤 ${author}` : ""}\n⏱ ${durationText}`,
            parse_mode: "Markdown",
          },
          { filename: fileName }
        );

        if (thumbPath) {
          try {
            fs.unlinkSync(thumbPath);
          } catch (_) {}
        }

        try {
          await api.deleteMessage(chatId, msgId);
        } catch (_) {}
      } catch (error) {
        console.error("[SONG DOWNLOAD ERROR]", error.message);

        try {
          await api.editMessageText(getLang("sendFailed"), {
            chat_id: chatId,
            message_id: msgId,
          });
        } catch (_) {}
      } finally {
        try {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch (_) {}
      }
    } catch (outerError) {
      console.error("[SONG CALLBACK ERROR]", outerError);
    }
  },
};
