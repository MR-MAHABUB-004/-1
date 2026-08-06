"use strict";
const axios = require("axios");
const fs    = require("fs");
const path  = require("path");

if (!global.videoCache) global.videoCache = new Map();

const LONG_VIDEO_MINUTES = 10;

function parseDurationToMinutes(d) {
  if (!d) return 0;
  const p = d.split(":").map(Number);
  if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
  if (p.length === 2) return p[0] + p[1] / 60;
  return 0;
}

async function fetchWithRetry(url, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, {
        params,
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
      });
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
}

module.exports = {
  config: {
    name:        "xnx",
    aliases:     ["xnxx"],
    version:     "13.0.0",
    author:      "MR᭄﹅ MAHABUB﹅ メꪜ",
    usePrefix:   true,
    role:        0,
    countDown:   5,
    category:    "media",
    description: { en: "Search videos with thumbnails, click a title button to download." },
    guide:       { en: "{pn} <query>" }
  },

  // ─── onStart ────────────────────────────────────────────────────────────────
  onStart: async function ({ api, event, message, args }) {
    const { threadID } = event;
    const query = args.join(" ").trim();

    if (!query) {
      return message.reply(
        "📌 ব্যবহার:\n.xnx <নাম> — সার্চ করুন\nটাইটেল বাটনে ক্লিক করুন ডাউনলোড করতে"
      );
    }

    await this.deleteSessionMessages(message, threadID);
    return this.handleSearch(api, message, threadID, query, 1);
  },

  // ─── onCallbackQuery ────────────────────────────────────────────────────────
  // Fires when user taps any inline button sent by this command.
  // callback_data format:
  //   xnx:pg:<page>:<query>   — pagination
  //   xnx:dl:<num>            — download video #num
  onCallbackQuery: async function ({ api, event, message, callbackData }) {
    const { threadID } = event;
    const parts  = callbackData.split(":");
    const action = parts[1];

    if (action === "pg") {
      const page  = parseInt(parts[2]);
      const query = parts.slice(3).join(":");
      await this.deleteSessionMessages(message, threadID);
      return this.handleSearch(api, message, threadID, query, page);
    }

    if (action === "dl") {
      const num     = parseInt(parts[2]);
      const vidData = global.videoCache.get(`v_${threadID}_${num}`);
      if (!vidData) return message.reply(`❌ ${num} নম্বর ভিডিও ক্যাশে নেই বা সেশন শেষ।`);
      await this.deleteSessionMessages(message, threadID);
      return this.downloadAndSend(api, message, threadID, vidData);
    }
  },

  // ─── Helpers ────────────────────────────────────────────────────────────────
  deleteSessionMessages: async function (message, threadID) {
    const ids = global.videoCache.get(`msgs_${threadID}`) || [];
    for (const msgId of ids) {
      await message.delete(msgId).catch(() => {});
    }
    global.videoCache.delete(`msgs_${threadID}`);
    global.videoCache.delete(`ses_${threadID}`);
  },

  saveMsgId: function (threadID, msgId) {
    const ids = global.videoCache.get(`msgs_${threadID}`) || [];
    ids.push(msgId);
    global.videoCache.set(`msgs_${threadID}`, ids);
  },

  // ─── Search + thumbnails + title buttons ────────────────────────────────────
  handleSearch: async function (api, message, threadID, query, page) {
    const loadMsg = await api.sendMessage(
      threadID,
      `🔍 *"${query}"* — Page ${page} লোড হচ্ছে...`,
      { parse_mode: "Markdown" }
    );

    try {
      const res  = await fetchWithRetry(
        "https://page-browser.vercel.app/api/q",
        { q: query, page }
      );
      const data = res.data;

      await api.deleteMessage(threadID, loadMsg.message_id).catch(() => {});

      if (!data?.status || !Array.isArray(data.videos) || !data.videos.length) {
        return message.reply(`❌ Page ${page} — কোনো ভিডিও পাওয়া যায়নি।`);
      }

      const videos  = data.videos.slice(0, 10);
      const hasNext = !!data.next;
      const hasPrev = page > 1;

      // Session + video cache
      global.videoCache.set(`ses_${threadID}`, { query, page });
      videos.forEach((vid, i) => {
        const mins = parseDurationToMinutes(vid.duration);
        global.videoCache.set(`v_${threadID}_${i + 1}`, {
          title:     vid.title     || `Video ${i + 1}`,
          video_url: vid.video_url || null,
          referer:   vid.link      || "https://www.desitales2.com/",
          duration:  vid.duration  || "?",
          views:     vid.views     || "?",
          rating:    vid.rating    || "?",
          thumbnail: vid.thumbnail || null,
          isLong:    mins >= LONG_VIDEO_MINUTES
        });
      });

      // ── Thumbnails as media group ──
      const withThumb = videos.filter(v => v.thumbnail);
      if (withThumb.length) {
        try {
          const mediaGroup = withThumb.map(vid => {
            const num  = videos.indexOf(vid) + 1;
            const icon = parseDurationToMinutes(vid.duration) >= LONG_VIDEO_MINUTES ? "🌐" : "📥";
            return {
              type:       "photo",
              media:      vid.thumbnail,
              caption:    `*${num}.* ${icon} ${vid.title || "?"}\n⏱ ${vid.duration || "?"} | 👁 ${vid.views || "?"} | ⭐ ${vid.rating || "?"}`,
              parse_mode: "Markdown"
            };
          });
          const albumMsgs = await api.sendMediaGroup(threadID, mediaGroup);
          if (Array.isArray(albumMsgs)) {
            albumMsgs.forEach(m => this.saveMsgId(threadID, m.message_id));
          }
        } catch (_) {
          // Fallback: send one by one
          for (let i = 0; i < videos.length; i++) {
            if (!videos[i].thumbnail) continue;
            try {
              const s = await api.sendPhoto(threadID, videos[i].thumbnail, {
                caption:    `*${i + 1}.* ${videos[i].title || "?"}\n⏱ ${videos[i].duration || "?"}`,
                parse_mode: "Markdown"
              });
              this.saveMsgId(threadID, s.message_id);
            } catch (_) {}
          }
        }
      }

      // ── Title buttons (one row per video) ──
      const videoRows = videos.map((vid, i) => {
        const num  = i + 1;
        const icon = parseDurationToMinutes(vid.duration) >= LONG_VIDEO_MINUTES ? "🌐" : "📥";
        return [{ text: `${icon} ${vid.title || `Video ${num}`}`, callback_data: `xnx:dl:${num}` }];
      });

      // ── Navigation buttons ──
      const navRow = [];
      const safeQ  = query.length > 30 ? query.slice(0, 30) : query;
      if (hasPrev) navRow.push({ text: `⬅️ Page ${page - 1}`, callback_data: `xnx:pg:${page - 1}:${safeQ}` });
      if (hasNext) navRow.push({ text: `Page ${page + 1} ➡️`, callback_data: `xnx:pg:${page + 1}:${safeQ}` });
      if (navRow.length) videoRows.push(navRow);

      const sentList = await api.sendMessage(
        threadID,
        `📋 *"${query}"* — Page ${page}\n${"━".repeat(20)}\n⬇️ *ডাউনলোড করতে টাইটেলে ক্লিক করুন:*`,
        {
          parse_mode:   "Markdown",
          reply_markup: { inline_keyboard: videoRows }
        }
      );
      this.saveMsgId(threadID, sentList.message_id);

    } catch (err) {
      await api.deleteMessage(threadID, loadMsg.message_id).catch(() => {});
      console.error("[XNX Error]", err.message);
      message.reply(`❌ Error: ${err.message}`);
    }
  },

  // ─── Download ────────────────────────────────────────────────────────────────
  downloadAndSend: async function (api, message, threadID, vidData) {
    const { title, video_url, referer, isLong, duration } = vidData;

    if (!video_url) return message.reply("❌ ডাউনলোড লিঙ্ক পাওয়া যায়নি।");

    if (isLong) {
      return api.sendMessage(
        threadID,
        `🎬 *${title}*\n⏱ ${duration}\n⚠️ ফাইল অনেক বড়, সরাসরি দেখুন।`,
        {
          parse_mode:   "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "🌐 Watch", url: video_url }]] }
        }
      );
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Referer":    referer,
      "Origin":     "https://www.desitales2.com",
      "Accept":     "video/*,*/*;q=0.9"
    };

    const waitMsg = await api.sendMessage(
      threadID,
      `⏳ *"${title}"*\nডাউনলোড হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।`,
      { parse_mode: "Markdown" }
    );

    const tmpPath = path.join(__dirname, `xnx_${Date.now()}.mp4`);

    try {
      // Size pre-check
      try {
        const head   = await axios.head(video_url, { headers, timeout: 10000 });
        const sizeMB = parseInt(head.headers["content-length"] || "0") / (1024 * 1024);
        if (sizeMB > 49) {
          await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});
          return api.sendMessage(
            threadID,
            `⚠️ *${sizeMB.toFixed(1)} MB* — Telegram সীমা ৫০ MB`,
            {
              parse_mode:   "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "🌐 Watch", url: video_url }]] }
            }
          );
        }
      } catch (_) {}

      // Download
      const response = await axios({
        method:       "GET",
        url:          video_url,
        responseType: "stream",
        headers,
        timeout:      180000,
        maxRedirects: 10
      });

      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);

      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(tmpPath);
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error",  reject);
        response.data.on("error", reject);
      });

      const stat = fs.statSync(tmpPath);
      if (stat.size < 1024) throw new Error("CDN blocked — empty response");

      const actualMB = stat.size / (1024 * 1024);
      if (actualMB > 49) {
        fs.unlinkSync(tmpPath);
        await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});
        return api.sendMessage(
          threadID,
          `⚠️ *${actualMB.toFixed(1)} MB* — Telegram সীমা ৫০ MB`,
          {
            parse_mode:   "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "🌐 Watch", url: video_url }]] }
          }
        );
      }

      await api.sendVideo(threadID, fs.createReadStream(tmpPath), {
        caption:            `🎬 *${title}*`,
        parse_mode:         "Markdown",
        supports_streaming: true
      });

      await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});

    } catch (err) {
      console.error("[XNX Download Error]", err.message);
      await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});
      api.sendMessage(threadID, `❌ ডাউনলোড ব্যর্থ।`, {
        parse_mode:   "Markdown",
        reply_markup: { inline_keyboard: [[{ text: "🌐 Watch", url: video_url }]] }
      });
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }
};
