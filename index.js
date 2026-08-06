"use strict";

/**
 * index.js  — Auto-restart wrapper (mirrors GoatBot V2 index.js)
 * If GoatBot.js exits with code 2, it restarts automatically.
 */

const { spawn } = require("child_process");
const chalk     = require("chalk");

function start() {
  console.log(chalk.yellow("▶  Starting GoatBot..."));
  const child = spawn("node", ["GoatBot.js"], {
    cwd:   __dirname,
    stdio: "inherit",
    shell: false,
  });

  child.on("close", code => {
    if (code === 2) {
      console.log(chalk.yellow("🔄  Restarting..."));
      start();
    } else {
      console.log(chalk.red(`✖  Process exited with code ${code}`));
    }
  });
}

start();
