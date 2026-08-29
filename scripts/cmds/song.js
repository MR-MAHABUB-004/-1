"use strict";

/**
 * scripts/cmds/song.js
 * ──────────────────────────────────────────────────────────────
 * Song search + direct download
 *   /song <name>  → finds the best-matching track and sends the
 *                   audio straight away — no results list, no
 *                   buttons to tap.
 *
 * Search:   yt-search (npm)
 * Download: scripts/cmds/API/song/song.js (in-process module)
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
      timeout: 300000,
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

// Very light relevance scoring on top of yt-search's own ordering
// (which is already relevance-sorted). This just nudges the pick
// away from obviously-wrong results — long lives/mixes, reaction
// videos, etc. — toward something that actually matches the query.
function pickBestMatch(videos, query) {
  const q = String(query || "").toLowerCase();
  const qWords = q.split(/\s+/).filter(Boolean);

  const BAD_HINTS = ["reaction", "live concert", "full concert", "trailer", "interview"];

  let best = null;
  let bestScore = -Infinity;

  videos.forEach((v, index) => {
    const title = String(v.title || "").toLowerCase();
    let score = 0;

    // yt-search already returns results in relevance order — reward
    // earlier positions, but not so heavily that a clearly-better
    // title match further down can't win.
    score -= index * 2;

    const matchedWords = qWords.filter((w) => title.includes(w)).length;
    score += matchedWords * 5;

    if (BAD_HINTS.some((h) => title.includes(h))) score -= 15;

    // Extremely long results are usually mixes/compilations, not the track itself
    const seconds = v.seconds || (v.duration && v.duration.seconds) || 0;
    if (seconds > 15 * 60) score -= 10;

    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  });

  return best || videos[0];
}

// ---------------------------------------------------------------------------
// Command configuration
// ---------------------------------------------------------------------------

module.exports = {
  config: {
    name: "song",
    aliases: ["ytsong", "gan"],
    version: "2.0.0",
    author: "Mahabub",
    usePrefix: true,
    role: 0,
    category: "media",
    countDown: 8,

    description: {
      en: "গানের নাম দিয়ে সার্চ করে সরাসরি অডিও পাঠায়",
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

      fetching:
        "🎵 *%1*\n⏳ লিংক প্রস্তুত করা হচ্ছে... (৩০-৬০ সেকেন্ড লাগতে পারে)",

      fetchError:
        "⚠️ এই গানের অডিও পাওয়া যায়নি। আবার চেষ্টা করুন বা অন্য নামে সার্চ করুন।",

      downloading:
        "⬇️ *%1*\n⏳ ডাউনলোড হচ্ছে, একটু অপেক্ষা করুন...",

      fileTooLarge:
        "📁 ফাইলের সাইজ টেলিগ্রামের ৫০ MB সীমার বেশি, তাই এখানে পাঠানো গেল না।\n\n🔗 সরাসরি লিংক:\n%1",

      sendFailed:
        "❌ অডিও পাঠাতে সমস্যা হয়েছে। আবার চেষ্টা করুন।",
    },
  },

  // =========================================================================
  // COMMAND — search, auto-pick best match, download + send
  // =========================================================================

  onStart: async function ({ event, message, api, args, getLang, prefix }) {
    const query = args.join(" ").trim();

    if (!query) {
      return message.reply(
        getLang("noQuery").replace("{pn}", prefix + this.config.name)
      );
    }

    const statusMsg = await message.reply(
      getLang("searching").replace("%1", query)
    );

    const chatId = event.threadID;
    const msgId = statusMsg.message_id;

    let picked;

    try {
      const result = await yts(query);
      const videos = (result && result.videos) || [];

      if (videos.length === 0) {
        return message.edit(
          msgId,
          getLang("noResults").replace("%1", query)
        );
      }

      picked = pickBestMatch(videos, query);
    } catch (error) {
      console.error("[SONG SEARCH ERROR]", error);

      try {
        await message.edit(msgId, getLang("searchError"));
      } catch (_) {}
      return;
    }

    const videoId = picked.videoId;
    const title = picked.title || "Unknown";
    const author = (picked.author && picked.author.name) || "";
    const duration = picked.seconds || (picked.duration && picked.duration.seconds) || 0;
    const thumbnail = picked.thumbnail || null;

    try {
      await message.edit(msgId, getLang("fetching").replace("%1", title));
    } catch (_) {}

    // -------------------------------------------------------------
    // Resolve the direct audio URL
    // -------------------------------------------------------------

    let audioUrl;

    try {
      const apiResult = await songApi.getMp3(`https://youtu.be/${videoId}`);

      if (!apiResult || !apiResult.success || !apiResult.data || !apiResult.data.download_url) {
        throw new Error((apiResult && apiResult.error) || "No download_url");
      }
      audioUrl = apiResult.data.download_url;
    } catch (error) {
      console.error("[SONG FETCH ERROR]", error.message);

      try {
        await message.edit(msgId, getLang("fetchError"));
      } catch (_) {}
      return;
    }

    try {
      await message.edit(msgId, getLang("downloading").replace("%1", title));
    } catch (_) {}

    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempPath = path.join(
      tempDir,
      `song_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
    );

    let thumbPath = null;

    try {
      // -------------------------------------------------------------
      // Size pre-check where possible
      // -------------------------------------------------------------

      try {
        const head = await axios.head(audioUrl, { timeout: 10000 });
        const sizeMB =
          parseInt(head.headers["content-length"] || "0", 10) / (1024 * 1024);

        if (sizeMB > 49) {
          return message.reply(getLang("fileTooLarge").replace("%1", audioUrl));
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
        return message.reply(getLang("fileTooLarge").replace("%1", audioUrl));
      }

      // -------------------------------------------------------------
      // Thumbnail — Telegram's `thumb` param requires a local file/
      // stream, not a plain URL. Download it first; if that fails,
      // just skip the thumbnail rather than letting sendAudio crash.
      // -------------------------------------------------------------

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
      // Send audio — using the raw bot API here (not message.sendAudio)
      // so we can pass title/performer/duration/thumb and a proper
      // filename via fileOptions, same as node-telegram-bot-api expects.
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

      try {
        await message.delete(msgId);
      } catch (_) {}
    } catch (error) {
      console.error("[SONG DOWNLOAD ERROR]", error.message);

      try {
        await message.edit(msgId, getLang("sendFailed"));
      } catch (_) {}
    } finally {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (_) {}
      if (thumbPath) {
        try {
          if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
        } catch (_) {}
      }
    }
  },
};
