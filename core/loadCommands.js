"use strict";

/**
 * core/loadCommands.js
 * Scans scripts/cmds/ and registers every command into global.GoatBot.commands
 * Mirrors GoatBot V2 command loading with:
 *   - config.name
 *   - config.aliases
 *   - config.role
 *   - config.usePrefix
 *   - config.countDown
 *   - config.category
 *   - onStart({ api, event, message, args, threadsData, usersData, globalData, role, getLang })
 *   - onChat  ({ api, event, message, args, threadsData, usersData, globalData, role, getLang })
 *   - onReply ({ api, event, message, args, ... })
 *   - onReaction({ ... })
 */

const fs   = require("fs");
const path = require("path");
const log  = require("../logger/log.js");

const CMDS_DIR = path.join(__dirname, "../scripts/cmds");

function loadCommands() {
  const { commands, aliases, onChat, onReply, onReaction } = global.GoatBot;

  if (!fs.existsSync(CMDS_DIR)) {
    fs.mkdirSync(CMDS_DIR, { recursive: true });
    log.warn("LOADER", `Created empty cmds dir at ${CMDS_DIR}`);
    return;
  }

  const files = fs.readdirSync(CMDS_DIR).filter(f => f.endsWith(".js"));

  for (const file of files) {
    const filePath = path.join(CMDS_DIR, file);
    try {
      // Clear cache so hot-reload works
      delete require.cache[require.resolve(filePath)];
      const cmd = require(filePath);

      if (!cmd.config || !cmd.config.name) {
        log.warn("LOADER", `Skipped ${file} — missing config.name`);
        continue;
      }

      const name = cmd.config.name.toLowerCase();
      commands.set(name, cmd);

      // Register aliases
      if (Array.isArray(cmd.config.aliases)) {
        for (const alias of cmd.config.aliases) {
          aliases.set(alias.toLowerCase(), name);
        }
      }

      // Register onChat handlers
      if (typeof cmd.onChat === "function") {
        onChat.push({ name, fn: cmd.onChat });
      }

      // Register onReply handlers
      if (typeof cmd.onReply === "function") {
        onReply.set(name, cmd.onReply);
      }

      // Register onReaction handlers
      if (typeof cmd.onReaction === "function") {
        onReaction.set(name, cmd.onReaction);
      }

      log.success("LOADER", `Loaded command: ${name}${cmd.config.aliases?.length ? ` (aliases: ${cmd.config.aliases.join(", ")})` : ""}`);
    } catch (e) {
      log.error("LOADER", `Failed to load ${file}: ${e.message}`);
    }
  }

  log.info("LOADER", `Total commands loaded: ${commands.size}`);
}

module.exports = { loadCommands };
