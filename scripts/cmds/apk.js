"use strict";

/**
 * scripts/cmds/apk.js
 * ──────────────────────────────────────────────────────────────
 * APK Downloader
 * Search, explore, and download Android applications
 * from the Mahabub API directly inside Telegram.
 *
 * Callback format (short tokens):
 *   apk:info:<token>
 *   apk:dl:<token>
 *   apk:ver:<token>
 * ──────────────────────────────────────────────────────────────
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const stream = require("stream");

const finished = promisify(stream.finished);

// ---------------------------------------------------------------------------
// Callback data cache
//
// Telegram limits callback_data to 64 bytes. We store the real payload
// in memory and put a short random token in the callback_data.
// ---------------------------------------------------------------------------

const cbCache = new Map(); // token -> { slug, title?, version?, size?, fileId? }

function cacheData(payload) {
  const token =
    Date.now().toString(36).slice(-4) +
    Math.random().toString(36).slice(2, 8);

  cbCache.set(token, payload);

  // Keep the cache from growing unbounded
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

function extractSlug(url) {
  if (!url) return "";
  const cleaned = String(url).replace(/\/+$/, "");
  const parts = cleaned.split("/");
  return parts[parts.length - 1] || "";
}

function parseSizeMB(sizeStr) {
  if (!sizeStr) return Infinity;

  const match = String(sizeStr).match(/^([\d.]+)\s*(MB|GB|KB)/i);
  if (!match) return Infinity;

  let num = parseFloat(match[1]);
  const unit = match[2].toUpperCase();

  if (unit === "GB") num *= 1024;
  if (unit === "KB") num /= 1024;

  return Math.round(num);
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
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
    } catch (_) {}

    throw error;
  }
}

function safeFileName(name) {
  return String(name || "application")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 100);
}

// ---------------------------------------------------------------------------
// Command configuration
// ---------------------------------------------------------------------------

module.exports = {
  config: {
    name: "apk",
    aliases: ["app", "apps", "downloadapk"],
    version: "2.0.3",
    author: "MR᭄﹅ MAHABUB﹅ メꪜ",

    usePrefix: true,
    role: 0,
    category: "media",
    countDown: 5,

    description: {
      en: "Android অ্যাপ সার্চ করুন এবং ডাউনলোড করুন।",
    },

    guide: {
      en: "{pn} <অ্যাপের নাম>\nউদাহরণ: {pn} capcut",
    },
  },

  langs: {
    en: {
      noQuery:
        "❌ অনুগ্রহ করে অ্যাপের নাম দিন।\nউদাহরণ: {pn} capcut",

      searching:
        "🔍 \"%1\" খোঁজা হচ্ছে...",

      searchError:
        "⚠️ সার্চ করতে সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",

      noResults:
        "😔 \"%1\" নামে কোনো অ্যাপ পাওয়া যায়নি।",

      resultsTitle:
        "📱 \"%1\" এর সাথে মিলে যাওয়া অ্যাপগুলো:",

      resultButton:
        "%1\n%2 • %3",

      infoLoading:
        "⏳ অ্যাপের বিস্তারিত তথ্য আনা হচ্ছে...",

      infoError:
        "⚠️ অ্যাপের তথ্য আনা যায়নি।",

      infoCaption:
        "*%1*\n\n" +
        "📌 ভার্সন: %2\n" +
        "📦 সাইজ: %3\n" +
        "📅 আপডেট হয়েছে: %4\n" +
        "🏷 ক্যাটাগরি: %5\n" +
        "⭐ রেটিং: %6/5 (%7 ভোট)\n\n" +
        "📝 *বিস্তারিত:*\n" +
        "%8\n\n" +
        "📄 %9",

      downloadButton:
        "⬇️ ডাউনলোড করুন (%1)",

      downloadOptions:
        "📥 একটি ভার্সন বেছে নিন:",

      versionButton:
        "%1 (%2)",

      preparing:
        "⏳ ডাউনলোড প্রস্তুত করা হচ্ছে, একটু অপেক্ষা করুন...",

      fileTooLarge:
        "📁 ফাইলের সাইজ (%1) টেলিগ্রামের ৫০ MB সীমার বেশি।\n\n🔗 সরাসরি লিংক:\n%2",

      downloadStarted:
        "📦 ডাউনলোড শুরু হয়েছে! ফাইল পাঠানো হচ্ছে...",

      fileSent:
        "✅ ফাইল সফলভাবে পাঠানো হয়েছে।",

      genericError:
        "❌ কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।",

      downloadFailed:
        "❌ ডাউনলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।",

      sessionExpired:
        "⌛ এই সেশনের মেয়াদ শেষ। আবার সার্চ করুন {pn} <নাম> লিখে।",
    },
  },

  // -------------------------------------------------------------------------
  // Local, self-contained language getter.
  //
  // The framework injects `getLang` into onStart, but it is NOT guaranteed
  // to be passed into onCallbackQuery (this differs per bot framework).
  // When that happens, any call to the injected `getLang` throws
  // "getLang is not a function", which silently kills the whole callback
  // handler before it can respond — this was the root cause of buttons
  // "not working" (they answered the tap but then crashed instantly).
  //
  // This helper falls back to reading directly from `this.langs.en` so the
  // command works whether or not the framework provides `getLang` here.
  // -------------------------------------------------------------------------
  _gl: function (injectedGetLang, key) {
    if (typeof injectedGetLang === "function") {
      try {
        const val = injectedGetLang(key);
        if (val) return val;
      } catch (_) {
        // fall through to local lookup
      }
    }
    return (this.langs.en && this.langs.en[key]) || key;
  },

  // =========================================================================
  // COMMAND
  // =========================================================================

  onStart: async function ({
    event,
    message,
    args,
    getLang,
    prefix,
  }) {
    const gl = (key) => this._gl(getLang, key);
    const query = args.join(" ").trim();

    if (!query) {
      return message.reply(
        gl("noQuery").replace(
          "{pn}",
          prefix + this.config.name
        )
      );
    }

    const statusMsg = await message.reply(
      gl("searching").replace("%1", query)
    );

    try {
      const searchUrl =
        `https://mahabub-ytmp3.vercel.app/api/search?k=` +
        encodeURIComponent(query);

      const { data } = await axios.get(searchUrl, {
        timeout: 10000,
      });

      if (
        !data ||
        !data.success ||
        !Array.isArray(data.results) ||
        data.results.length === 0
      ) {
        await message.edit(
          statusMsg.message_id,
          gl("noResults").replace("%1", query)
        );

        return;
      }

      // ---------------------------------------------------------------
      // Filter results – keep only apps whose title contains the query
      // ---------------------------------------------------------------

      const lowerQuery = query.toLowerCase();

      const filtered = data.results.filter((app) => {
        if (!app || !app.title) return false;

        return app.title
          .toLowerCase()
          .includes(lowerQuery);
      });

      if (filtered.length === 0) {
        await message.edit(
          statusMsg.message_id,
          gl("noResults").replace("%1", query)
        );

        return;
      }

      // ---------------------------------------------------------------
      // Build buttons – cache slug, title, version and size
      // ---------------------------------------------------------------

      const keyboard = filtered
        .slice(0, 6)
        .map((app) => {
          const slug = extractSlug(app.url);
          const token = cacheData({
            slug,
            title: app.title || "Unknown",
            version: app.version || "?",
            size: app.size || "?",
          });

          const label = gl("resultButton")
            .replace("%1", app.title || "Unknown")
            .replace("%2", app.version || "?")
            .replace("%3", app.size || "?");

          return [
            {
              text: label,
              callback_data: `apk:info:${token}`,
            },
          ];
        });

      await message.edit(
        statusMsg.message_id,
        gl("resultsTitle").replace("%1", query),
        {
          reply_markup: {
            inline_keyboard: keyboard,
          },
        }
      );
    } catch (error) {
      console.error("[APK SEARCH ERROR]", error);

      try {
        await message.edit(
          statusMsg.message_id,
          gl("searchError")
        );
      } catch (_) {}
    }
  },

  // =========================================================================
  // CALLBACK QUERY
  // =========================================================================

  onCallbackQuery: async function ({
    event,
    api,
    message,
    getLang,
    callbackData,
    query,
  }) {
    // ---------------------------------------------------------------
    // Namespace guard — the framework broadcasts every callback query
    // to every command's onCallbackQuery. Other commands (e.g. xnx)
    // reuse generic action names like "dl", so without this check we
    // would react to callback_data that isn't ours at all.
    // ---------------------------------------------------------------

    if (!callbackData || !callbackData.startsWith("apk:")) return;

    const gl = (key) => this._gl(getLang, key);

    // ---------------------------------------------------------------
    // Answer callback immediately (query.id is the correct callback id)
    // ---------------------------------------------------------------

    const callbackQueryId = query && query.id;

    try {
      if (callbackQueryId) {
        await api.answerCallbackQuery(callbackQueryId);
      }
    } catch (_) {}

    // Everything below is wrapped in try/catch so a single unexpected
    // error (bad API shape, network hiccup, etc.) can never silently
    // swallow the whole button response the way it did before.
    try {
      const chatId = event.threadID;
      const msgId = event.messageID;

      if (!callbackData) return;

      // ---------------------------------------------------------------
      // Parse callback:  apk:action:token
      // ---------------------------------------------------------------

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

      // =========================================================================
      // INFO
      // =========================================================================

      if (action === "info") {
        const cached = getCached(token);

        if (!cached || !cached.slug) {
          await notify(gl("sessionExpired"), true);
          return;
        }

        const slug = cached.slug;
        const title = cached.title || "Unknown";
        const version = cached.version || "?";
        const size = cached.size || "?";

        await notify(gl("infoLoading"));

        // Fetch extended info from the API (description, mod_info, screenshots...)
        let description = "No description available";
        let modInfo = "None";
        let ratingValue = "?";
        let ratingVotes = "?";
        let screenshots = [];
        let lastUpdated = "?";
        let category = "?";

        try {
          const infoUrl =
            `https://mahabub-ytmp3.vercel.app/api/info?slug=` +
            encodeURIComponent(slug);

          const { data: infoData } = await axios.get(infoUrl, {
            timeout: 10000,
          });

          if (infoData && infoData.success) {
            description = infoData.short_description
              ? infoData.short_description.substring(0, 300) +
                (infoData.short_description.length > 300 ? "..." : "")
              : "No description available";

            if (
              Array.isArray(infoData.mod_info) &&
              infoData.mod_info.length > 0
            ) {
              modInfo = infoData.mod_info.join("\n• ");
            }

            if (
              infoData.rating &&
              typeof infoData.rating === "object"
            ) {
              ratingValue = infoData.rating.value || "?";
              ratingVotes = infoData.rating.votes || "?";
            }

            if (Array.isArray(infoData.screenshots)) {
              screenshots = infoData.screenshots;
            }

            lastUpdated = infoData.last_updated || "?";
            category = infoData.category || "?";
          }
        } catch (err) {
          console.error("[APK INFO ERROR]", err);
          // Continue with default values, we already have title/version/size
        }

        // -----------------------------------------------------------
        // Build caption using cached title/version/size + API details
        // -----------------------------------------------------------

        const caption = gl("infoCaption")
          .replace("%1", title)
          .replace("%2", version)
          .replace("%3", size)
          .replace("%4", lastUpdated)
          .replace("%5", category)
          .replace("%6", ratingValue)
          .replace("%7", ratingVotes)
          .replace("%8", modInfo)
          .replace("%9", description);

        // -----------------------------------------------------------
        // Download button (new token for the download step)
        // -----------------------------------------------------------

        const dlToken = cacheData({ slug, title, version, size });

        const downloadButton = {
          text: gl("downloadButton").replace("%1", size),
          callback_data: `apk:dl:${dlToken}`,
        };

        // -----------------------------------------------------------
        // Remove previous search result
        // -----------------------------------------------------------

        try {
          await api.deleteMessage(chatId, msgId);
        } catch (_) {}

        // -----------------------------------------------------------
        // Send screenshot if available, otherwise plain text
        // -----------------------------------------------------------

        if (screenshots.length > 0 && screenshots[0]) {
          await api.sendPhoto(
            chatId,
            screenshots[0],
            {
              caption,
              reply_markup: {
                inline_keyboard: [[downloadButton]],
              },
              parse_mode: "Markdown",
            }
          );
        } else {
          await api.sendMessage(
            chatId,
            caption,
            {
              reply_markup: {
                inline_keyboard: [[downloadButton]],
              },
              parse_mode: "Markdown",
            }
          );
        }
      }

      // =========================================================================
      // DOWNLOAD OPTIONS (list of versions)
      // =========================================================================

      if (action === "dl") {
        const cached = getCached(token);

        if (!cached || !cached.slug) {
          await notify(gl("sessionExpired"), true);
          return;
        }

        const slug = cached.slug;

        await notify(gl("preparing"));

        try {
          const dlListUrl =
            `https://mahabub-ytmp3.vercel.app/api/download?slug=` +
            encodeURIComponent(slug);

          const { data } = await axios.get(dlListUrl, {
            timeout: 10000,
          });

          if (
            !data ||
            !data.success ||
            !Array.isArray(data.downloads) ||
            data.downloads.length === 0
          ) {
            throw new Error("No download versions found");
          }

          // -----------------------------------------------------------
          // Version buttons
          // -----------------------------------------------------------

          const buttons = [];

          for (const ver of data.downloads) {
            if (
              !ver ||
              !Array.isArray(ver.links) ||
              !ver.links[0] ||
              !ver.links[0].url
            ) {
              continue;
            }

            const link = ver.links[0].url;

            const fid = link
              .split("/")
              .filter(Boolean)
              .pop();

            if (!fid) continue;

            const verToken = cacheData({ slug, fileId: fid });

            const label = gl("versionButton")
              .replace("%1", ver.label || "Latest")
              .replace("%2", ver.links[0].size || "?");

            buttons.push([
              {
                text: label,
                callback_data: `apk:ver:${verToken}`,
              },
            ]);
          }

          if (buttons.length === 0) {
            throw new Error("No valid download links");
          }

          // -----------------------------------------------------------
          // Update message
          // -----------------------------------------------------------

          try {
            await api.editMessageCaption(
              gl("downloadOptions"),
              {
                chat_id: chatId,
                message_id: msgId,
                reply_markup: { inline_keyboard: buttons },
                parse_mode: "Markdown",
              }
            );
          } catch (_) {
            await api.editMessageText(
              gl("downloadOptions"),
              {
                chat_id: chatId,
                message_id: msgId,
                reply_markup: { inline_keyboard: buttons },
                parse_mode: "Markdown",
              }
            );
          }
        } catch (error) {
          console.error("[APK DOWNLOAD LIST ERROR]", error);

          await notify(gl("genericError"), true);
        }
      }

      // =========================================================================
      // VERSION DOWNLOAD
      // =========================================================================

      if (action === "ver") {
        const cached = getCached(token);

        if (!cached || !cached.slug || !cached.fileId) {
          await notify(gl("sessionExpired"), true);
          return;
        }

        const { slug, fileId } = cached;

        await notify(gl("preparing"));

        // ---------------------------------------------------------------
        // Update status
        // ---------------------------------------------------------------

        try {
          await api.editMessageCaption(
            gl("preparing"),
            {
              chat_id: chatId,
              message_id: msgId,
              reply_markup: undefined,
              parse_mode: "Markdown",
            }
          );
        } catch (_) {
          try {
            await api.editMessageText(
              gl("preparing"),
              {
                chat_id: chatId,
                message_id: msgId,
                reply_markup: undefined,
                parse_mode: "Markdown",
              }
            );
          } catch (_) {}
        }

        try {
          // -------------------------------------------------------------
          // Get final download URL
          // -------------------------------------------------------------

          const verUrl =
            `https://mahabub-ytmp3.vercel.app/api/download-version` +
            `?slug=${encodeURIComponent(slug)}` +
            `&fileId=${encodeURIComponent(fileId)}`;

          const { data } = await axios.get(verUrl, {
            timeout: 15000,
          });

          if (
            !data ||
            !data.success ||
            !data.download_url
          ) {
            throw new Error(
              "Invalid download information"
            );
          }

          // -------------------------------------------------------------
          // Check file size
          // -------------------------------------------------------------

          const fileSizeMB = parseSizeMB(
            data.file_size
          );

          if (fileSizeMB > 50) {
            await api.sendMessage(
              chatId,
              gl("fileTooLarge")
                .replace("%1", data.file_size || "Unknown")
                .replace("%2", data.download_url)
            );

            try {
              await api.editMessageCaption(
                "⬆️ Download link sent above.",
                {
                  chat_id: chatId,
                  message_id: msgId,
                  reply_markup: undefined,
                }
              );
            } catch (_) {}

            return;
          }

          // -------------------------------------------------------------
          // Temporary file
          // -------------------------------------------------------------

          const tempDir = path.join(
            __dirname,
            "../temp"
          );

          if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, {
              recursive: true,
            });
          }

          const tempPath = path.join(
            tempDir,
            `app_${Date.now()}_${Math.random()
              .toString(36)
              .slice(2)}.apk`
          );

          // -------------------------------------------------------------
          // Download
          // -------------------------------------------------------------

          await downloadFile(
            data.download_url,
            tempPath
          );

          // -------------------------------------------------------------
          // File name
          // -------------------------------------------------------------

          const appName = safeFileName(
            data.app_name || data.title || "Application"
          );

          const appVersion = safeFileName(
            data.version || "latest"
          );

          const fileName =
            `${appName}_${appVersion}.apk`;

          // -------------------------------------------------------------
          // Send document
          // -------------------------------------------------------------

          await api.sendDocument(
            chatId,
            tempPath,
            {
              caption:
                `📦 ${data.app_name || "Application"} ` +
                `${data.version || ""}\n\n` +
                `${data.description || ""}`,
            },
            {
              filename: fileName,
              contentType:
                "application/vnd.android.package-archive",
            }
          );

          // -------------------------------------------------------------
          // Cleanup
          // -------------------------------------------------------------

          try {
            fs.unlinkSync(tempPath);
          } catch (_) {}

          // -------------------------------------------------------------
          // Update message
          // -------------------------------------------------------------

          try {
            await api.editMessageCaption(
              gl("fileSent"),
              {
                chat_id: chatId,
                message_id: msgId,
                reply_markup: undefined,
              }
            );
          } catch (_) {
            try {
              await api.editMessageText(
                gl("fileSent"),
                {
                  chat_id: chatId,
                  message_id: msgId,
                  reply_markup: undefined,
                }
              );
            } catch (_) {}
          }
        } catch (error) {
          console.error(
            "[APK VERSION DOWNLOAD ERROR]",
            error
          );

          try {
            await api.sendMessage(
              chatId,
              gl("downloadFailed")
            );
          } catch (_) {}

          try {
            await api.editMessageCaption(
              gl("downloadFailed"),
              {
                chat_id: chatId,
                message_id: msgId,
                reply_markup: undefined,
              }
            );
          } catch (_) {}
        }
      }
    } catch (outerError) {
      // Last-resort safety net — this is what was previously missing
      // and is why a crash here produced no visible response at all.
      console.error("[APK CALLBACK ERROR]", outerError);
    }

    return;
  },
};
