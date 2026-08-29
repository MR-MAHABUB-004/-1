"use strict";

/**
 * scripts/cmds/API/song/song.js
 * ──────────────────────────────────────────────────────────────
 * In-process YouTube → MP3 resolver.
 *
 * This is the same logic that used to live behind the standalone
 * express server (http://51.68.34.78:20279/api/mp3) — extracted
 * into a plain module so commands can call it directly with
 * require() instead of making an HTTP round-trip to an external
 * box. No server, no port, no network hop for our own bot.
 *
 * Usage (from scripts/cmds/song.js):
 *   const song = require("./API/song/song.js");
 *   const result = await song.getMp3("https://youtu.be/VIDEO_ID");
 *   // result: { success: true, data: { title, author, thumbnail,
 *   //           download_url, format, duration, filesize,
 *   //           processing_time, attempts } }
 *   // or:     { success: false, error: "..." }
 * ──────────────────────────────────────────────────────────────
 */

const axios = require("axios");

const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";

// =========================
// Helper: Extract YouTube ID
// =========================
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// =========================
// Helper: Get Video Info
// =========================
async function getVideoInfo(videoId) {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?type=json&url=https://youtu.be/${videoId}`;

    const response = await axios.get(oembedUrl, {
      timeout: 15000,
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch video info");
  }
}

// =========================
// Helper: Initiate Download
// =========================
async function initiateDownload(videoUrl, format = "mp3") {
  try {
    const encodedUrl = encodeURIComponent(videoUrl);

    let apiFormat = format;
    if (format === "4k") apiFormat = "2160";
    else if (format === "8k") apiFormat = "4320";
    else if (format === "webm_audio") apiFormat = "webm";

    const downloadUrl = `https://p.lbserver.xyz/api/v2/download?button=1&format=${apiFormat}&iframe_source=&url=${encodedUrl}`;

    const response = await axios.get(downloadUrl, {
      timeout: 60000,
      headers: {
        authority: "p.lbserver.xyz",
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        origin: "https://loader.to",
        pragma: "no-cache",
        referer: "https://loader.to/",
        "sec-ch-ua": '"Chromium";v="139", "Not;A=Brand";v="99"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "user-agent": UA,
      },
    });

    return response.data;
  } catch (error) {
    throw new Error("Failed to initiate download");
  }
}

// =========================
// Helper: Check Progress
// =========================
async function checkProgress(progressUrl, { maxAttempts = 200, intervalMs = 3000 } = {}) {
  let attemptCount = 0;

  while (attemptCount < maxAttempts) {
    try {
      attemptCount++;

      const response = await axios.get(progressUrl, {
        timeout: 30000,
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Origin: "https://loader.to",
          Referer: "https://loader.to/",
        },
      });

      const data = response.data;

      if (data && data.success === 1 && data.download_url) {
        return { ...data, attempts: attemptCount };
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error("Timed out waiting for download to be ready");
}

// =========================
// Main entry point — mirrors the old /api/mp3 response shape
// =========================
async function getMp3(videoUrl, opts = {}) {
  const startTime = Date.now();

  try {
    if (!videoUrl) {
      return { success: false, error: "URL parameter is required" };
    }

    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      return { success: false, error: "Invalid YouTube URL" };
    }

    const videoInfo = await getVideoInfo(videoId);
    const downloadInit = await initiateDownload(videoUrl, "mp3");

    if (!downloadInit || !downloadInit.success) {
      return { success: false, error: "Failed to start download process" };
    }

    if (!downloadInit.progress_url) {
      return { success: false, error: "Progress URL was not returned" };
    }

    const finalResult = await checkProgress(downloadInit.progress_url, opts);
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    return {
      success: true,
      data: {
        title: finalResult.title || videoInfo.title,
        author: videoInfo.author_name,
        thumbnail: finalResult.thumbnail_url || videoInfo.thumbnail_url,
        download_url: finalResult.download_url,
        format: finalResult.format || "mp3",
        duration: finalResult.info?.duration || null,
        filesize: finalResult.info?.filesize || null,
        processing_time: processingTime,
        attempts: finalResult.attempts,
      },
    };
  } catch (error) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    return {
      success: false,
      error: error.message || "Internal error",
      processing_time: processingTime,
    };
  }
}

module.exports = {
  getMp3,
  extractVideoId,
  getVideoInfo,
  initiateDownload,
  checkProgress,
};
