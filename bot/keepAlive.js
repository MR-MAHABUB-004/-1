"use strict";

/**
 * bot/keepAlive.js
 * Pings the bot's own Express server every 14 minutes
 * to prevent Render free-tier from sleeping.
 *
 * Called from GoatBot.js after server starts.
 */

const https = require("https");
const http  = require("http");

function keepAlive(url) {
  if (!url) return;

  const interval = 14 * 60 * 1000; // 14 minutes

  setInterval(() => {
    try {
      const mod = url.startsWith("https") ? https : http;
      mod.get(url, res => {
        // silent — just keeping the server warm
      }).on("error", () => {});
    } catch {}
  }, interval);

  console.log(`♻️  Keep-alive ping set for: ${url} every 14 min`);
}

module.exports = { keepAlive };
