"use strict";
const axios = require("axios");
const fs    = require("fs");
const path  = require("path");
const yts   = require("yt-search");

if (!global.ytCache) global.ytCache = new Map();

async function processVideo(youtubeUrl) {
  const res = await axios.post(
    "https://app.ytdown.to/proxy.php",
    new URLSearchParams({ url: youtubeUrl }),
    {
      headers: {
        "authority":        "app.ytdown.to",
        "accept":           "*/*",
        "content-type":     "application/x-www-form-urlencoded; charset=UTF-8",
        "origin":           "https://app.ytdown.to",
        "referer":          "https://app.ytdown.to/en24/",
        "user-agent":       "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
        "x-requested-with": "XMLHttpRequest"
      },
      timeout: 30000
    }
  );
  return res.data.api;
}

async function pollUntilReady(mediaUrl, maxWait = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res  = await axios.get(mediaUrl, { timeout: 15000 });
    const data = res.data;
    if (data.status === "completed" && data.fileUrl && data.fileUrl !== "Waiting...")
      return data;
    if (data.status === "error" || data.status === "failed")
      throw new Error(`Processing failed: ${data.status}`);
    await new Promise(r => setTimeout(r, 3000));
  }
  throw new Error("Timeout — processing too slow.");
}

module.exports = {
  config: {
    name:        "video",
    aliases:     ["yt", "ytdl"],
    version:     "3.1.0",
    author:      "MR᭄﹅ MAHABUB﹅ メꪜ",
    usePrefix:   true,
    role:        0,
    countDown:   10,
    category:    "media",
    description: { en: "Download YouTube videos or audio." },
    guide:       { en: "{pn} <name or YouTube URL>" }
  },

  // ─── onStart ────────────────────────────────────────────────────────────────
  onStart: async function ({ api, event, message, args }) {
    const { threadID } = event;
    const input = args.join(" ").trim();

    if (!input) {
      return message.reply(
        "📌 ব্যবহার:\n.video Tum Hi Ho\n.video https://youtu.be/..."
      );
    }

    const waitMsg = await api.sendMessage(threadID, "🔍 খোঁজা হচ্ছে...");

    try {
      const isUrl = /youtu(be\.com|\.be)/i.test(input);

      if (isUrl) {
        let videoTitle = input;
        let duration   = "?";
        try {
          const m = input.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
          if (m) {
            const info = await yts({ videoId: m[1] });
            videoTitle = info?.title || input;
            duration   = info?.duration?.timestamp || "?";
          }
        } catch (_) {}

        await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});
        return this.processAndShow(api, event, message, input, videoTitle, duration);

      } else {
        await api.editMessageText(
          `🔍 *"${input}"* YouTube-এ খোঁজা হচ্ছে...`,
          { chat_id: threadID, message_id: waitMsg.message_id, parse_mode: "Markdown" }
        ).catch(() => {});

        const r       = await yts(input);
        const results = (r.videos || []).slice(0, 5);

        if (!results.length) throw new Error("কোনো ভিডিও পাওয়া যায়নি।");

        // Single result — skip the list
        if (results.length === 1) {
          await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});
          return this.processAndShow(
            api, event, message,
            results[0].url,
            results[0].title,
            results[0].duration?.timestamp || "?"
          );
        }

        await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});

        // Build search results list with inline buttons
        let msg = `🔍 *"${input}"* — Results:\n${"━".repeat(20)}\n`;
        results.forEach((v, i) => {
          msg += `*${i + 1}.* ${v.title}\n   ⏱ ${v.duration?.timestamp || "?"} | 👁 ${v.views?.toLocaleString() || "?"}\n\n`;
        });
        msg += "━".repeat(20);

        const btnRows = [];
        for (let i = 0; i < results.length; i += 2) {
          const row = [{ text: `▶️ ${i + 1}. ${results[i].title.slice(0, 25)}`, callback_data: `yts:${i}` }];
          if (results[i + 1]) {
            row.push({ text: `▶️ ${i + 2}. ${results[i + 1].title.slice(0, 25)}`, callback_data: `yts:${i + 1}` });
          }
          btnRows.push(row);
        }

        const selMsg = await api.sendMessage(threadID, msg, {
          parse_mode:   "Markdown",
          reply_markup: { inline_keyboard: btnRows }
        });

        // Cache results keyed by the list message ID
        global.ytCache.set(`ytsearch_${threadID}`, {
          results,
          msgId: selMsg.message_id
        });
      }

    } catch (err) {
      await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});
      message.reply(`❌ ${err.message}`);
    }
  },

  // ─── onCallbackQuery ────────────────────────────────────────────────────────
  // callback_data formats:
  //   yts:<idx>       — user picked search result #idx
  //   ytdl:<idx>      — user picked quality/format #idx
  onCallbackQuery: async function ({ api, event, message, callbackData }) {
    const { threadID } = event;

    // ── Stage 1: search result selection ──────────────────────────────────────
    if (callbackData.startsWith("yts:")) {
      const idx    = parseInt(callbackData.split(":")[1]);
      const cached = global.ytCache.get(`ytsearch_${threadID}`);

      if (!cached) {
        return message.reply("❌ Session শেষ। আবার .video চালান।");
      }

      const video = cached.results[idx];
      if (!video) return message.reply("❌ ভিডিও পাওয়া যায়নি।");

      await api.deleteMessage(threadID, cached.msgId).catch(() => {});
      global.ytCache.delete(`ytsearch_${threadID}`);

      const waitMsg = await api.sendMessage(
        threadID,
        `⚙️ *"${video.title}"* process হচ্ছে...`,
        { parse_mode: "Markdown" }
      );

      return this.processAndShow(
        api, event, message,
        video.url,
        video.title,
        video.duration?.timestamp || "?",
        waitMsg.message_id
      );
    }

    // ── Stage 2: quality/format selection ─────────────────────────────────────
    if (callbackData.startsWith("ytdl:")) {
      const idx    = parseInt(callbackData.split(":")[1]);
      const cached = global.ytCache.get(`ytitem_${threadID}_${idx}`);

      if (!cached) {
        return message.reply("❌ Session শেষ। আবার .video চালান।");
      }

      // Remove quality list message
      await api.deleteMessage(threadID, cached.qualityMsgId).catch(() => {});
      global.ytCache.delete(`ytitem_${threadID}_${idx}`);

      return this.downloadItem(api, threadID, message, cached.item, cached.title, cached.duration);
    }
  },

  // ─── processAndShow — call API, render quality/format list ──────────────────
  processAndShow: async function (api, event, message, youtubeUrl, videoTitle, duration, existingWaitMsgId = null) {
    const { threadID } = event;

    let waitMsgId;
    if (existingWaitMsgId) {
      waitMsgId = existingWaitMsgId;
      await api.editMessageText(
        `⚙️ *"${videoTitle}"*\nServer-এ process হচ্ছে...`,
        { chat_id: threadID, message_id: waitMsgId, parse_mode: "Markdown" }
      ).catch(() => {});
    } else {
      const m   = await api.sendMessage(
        threadID,
        `⚙️ *"${videoTitle}"*\nServer-এ process হচ্ছে...`,
        { parse_mode: "Markdown" }
      );
      waitMsgId = m.message_id;
    }

    try {
      const apiData = await processVideo(youtubeUrl);
      if (!apiData || apiData.status !== "ok")
        throw new Error(apiData?.message || "API error");

      const title      = apiData.title || videoTitle;
      const thumbnail  = apiData.imagePreviewUrl || null;
      const items      = apiData.mediaItems || [];
      const videoItems = items.filter(i => i.type === "Video");
      const audioItems = items.filter(i => i.type === "Audio");

      if (!videoItems.length && !audioItems.length)
        throw new Error("কোনো media পাওয়া যায়নি।");

      await api.deleteMessage(threadID, waitMsgId).catch(() => {});

      // Build quality list text + buttons
      let msg = `🎬 *${title}*\n⏱ ${duration}\n${"━".repeat(20)}\n`;
      const allItems = [];
      const btnRows  = [];

      if (videoItems.length) {
        msg += `📹 *Video:*\n`;
        const vidBtns = [];
        videoItems.forEach(item => {
          const idx  = allItems.length;
          const size = item.mediaFileSize || "?";
          const res  = item.mediaRes || item.mediaQuality || "?";
          msg += `  *${idx + 1}.* ${res} — ${size}\n`;
          vidBtns.push({ text: `🎬 ${res} (${size})`, callback_data: `ytdl:${idx}` });
          allItems.push(item);
        });
        for (let i = 0; i < vidBtns.length; i += 2) {
          const row = [vidBtns[i]];
          if (vidBtns[i + 1]) row.push(vidBtns[i + 1]);
          btnRows.push(row);
        }
      }

      if (audioItems.length) {
        msg += `\n🎵 *Audio:*\n`;
        const audBtns = [];
        audioItems.forEach(item => {
          const idx  = allItems.length;
          const size = item.mediaFileSize || "?";
          const ext  = item.mediaExtension || "M4A";
          const q    = item.mediaQuality   || "?";
          msg += `  *${idx + 1}.* ${ext} ${q} — ${size}\n`;
          audBtns.push({ text: `🎵 ${ext} ${q} (${size})`, callback_data: `ytdl:${idx}` });
          allItems.push(item);
        });
        for (let i = 0; i < audBtns.length; i += 2) {
          const row = [audBtns[i]];
          if (audBtns[i + 1]) row.push(audBtns[i + 1]);
          btnRows.push(row);
        }
      }

      msg += "━".repeat(20);

      // Send quality list (with thumbnail if available)
      let qualityMsg;
      try {
        qualityMsg = thumbnail
          ? await api.sendPhoto(threadID, thumbnail, {
              caption:      msg,
              parse_mode:   "Markdown",
              reply_markup: { inline_keyboard: btnRows }
            })
          : await api.sendMessage(threadID, msg, {
              parse_mode:   "Markdown",
              reply_markup: { inline_keyboard: btnRows }
            });
      } catch (_) {
        qualityMsg = await api.sendMessage(threadID, msg, {
          parse_mode:   "Markdown",
          reply_markup: { inline_keyboard: btnRows }
        });
      }

      // Cache each item — include quality message ID so we can delete it on selection
      allItems.forEach((item, idx) => {
        global.ytCache.set(`ytitem_${threadID}_${idx}`, {
          item,
          title,
          duration,
          qualityMsgId: qualityMsg.message_id
        });
      });

    } catch (err) {
      await api.deleteMessage(threadID, waitMsgId).catch(() => {});
      message.reply(`❌ ${err.message}`);
    }
  },

  // ─── downloadItem ────────────────────────────────────────────────────────────
  downloadItem: async function (api, threadID, message, item, title, duration) {
    const { mediaUrl, mediaFileSize, mediaExtension, mediaQuality, mediaRes, type } = item;
    const ext  = (mediaExtension || "mp4").toLowerCase();
    const qual = mediaRes || mediaQuality || "";

    const waitMsg = await api.sendMessage(
      threadID,
      `⏳ *"${title}"*\n${type === "Audio" ? "🎵" : "🎬"} ${qual} — ${mediaFileSize}\n🔄 Processing...`,
      { parse_mode: "Markdown" }
    );

    const tmpPath = path.join(__dirname, `ytdl_${Date.now()}.${ext}`);

    try {
      const result  = await pollUntilReady(mediaUrl);
      const sizeStr = result.fileSize || mediaFileSize || "0 MB";

      let sizeMB = 0;
      const m = sizeStr.match(/([\d.]+)\s*(MB|GB|KB)/i);
      if (m) {
        sizeMB = parseFloat(m[1]);
        const unit = m[2].toUpperCase();
        if (unit === "GB") sizeMB *= 1024;
        if (unit === "KB") sizeMB /= 1024;
      }

      const caption = `🎬 *${title}*\n📊 ${qual} — ${sizeStr}\n⏱ ${duration}`;
      const dlBtn   = [[{ text: "⬇️ Download Now", url: result.fileUrl }]];

      // Over 49 MB — just send the direct link
      if (sizeMB > 49) {
        await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});
        return api.sendMessage(
          threadID,
          `${caption}\n\n⚠️ ফাইল ৫০ MB-এর বড় (Telegram Limit), সরাসরি ডাউনলোড করুন।`,
          {
            parse_mode:   "Markdown",
            reply_markup: { inline_keyboard: dlBtn }
          }
        );
      }

      await api.editMessageText(
        `⏳ *"${title}"*\n📥 ডাউনলোড হচ্ছে... (${sizeStr})`,
        { chat_id: threadID, message_id: waitMsg.message_id, parse_mode: "Markdown" }
      ).catch(() => {});

      const response = await axios({
        method:       "GET",
        url:          result.fileUrl,
        responseType: "stream",
        timeout:      180000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36",
          "Referer":    "https://app.ytdown.to/"
        }
      });

      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(tmpPath);
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error",  reject);
        response.data.on("error", reject);
      });

      const stat = fs.statSync(tmpPath);
      if (stat.size < 1024) throw new Error("Empty file downloaded");

      await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});

      if (type === "Audio") {
        await api.sendAudio(threadID, fs.createReadStream(tmpPath), {
          caption,
          parse_mode:   "Markdown",
          title,
          reply_markup: { inline_keyboard: dlBtn }
        });
      } else {
        await api.sendVideo(threadID, fs.createReadStream(tmpPath), {
          caption,
          parse_mode:         "Markdown",
          supports_streaming: true,
          reply_markup:       { inline_keyboard: dlBtn }
        });
      }

    } catch (err) {
      await api.deleteMessage(threadID, waitMsg.message_id).catch(() => {});
      message.reply(`❌ ডাউনলোড ব্যর্থ: ${err.message}`);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  }
};
