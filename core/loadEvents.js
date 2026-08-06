"use strict";

/**
 * core/loadEvents.js
 * Scans scripts/events/ and registers every event handler into
 * global.GoatBot.eventCommands.
 *
 * Event modules export:
 *   config.name
 *   config.eventType  — "message" | "join" | "leave" | "callback_query" | "*"
 *   onStart({ api, event, message, threadsData, usersData, globalData, getLang })
 */

const fs   = require("fs");
const path = require("path");
const log  = require("../logger/log.js");

const EVENTS_DIR = path.join(__dirname, "../scripts/events");

function loadEvents() {
  const { eventCommands } = global.GoatBot;

  if (!fs.existsSync(EVENTS_DIR)) {
    fs.mkdirSync(EVENTS_DIR, { recursive: true });
    log.warn("LOADER", `Created empty events dir at ${EVENTS_DIR}`);
    return;
  }

  const files = fs.readdirSync(EVENTS_DIR).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const filePath = path.join(EVENTS_DIR, file);
    try {
      delete require.cache[require.resolve(filePath)];
      const ev = require(filePath);

      if (!ev.config || !ev.config.name) {
        log.warn("LOADER", `Skipped event ${file} — missing config.name`);
        continue;
      }

      const name = ev.config.name.toLowerCase();
      eventCommands.set(name, ev);

      log.success("LOADER", `Loaded event: ${name}`);
    } catch (e) {
      log.error("LOADER", `Failed to load event ${file}: ${e.message}`);
    }
  }

  log.info("LOADER", `Total events loaded: ${eventCommands.size}`);
}

module.exports = { loadEvents };
