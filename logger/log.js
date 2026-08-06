"use strict";

const chalk = require("chalk");

const LEVELS = {
  info:    { color: "cyan",    label: "INFO"  },
  success: { color: "green",   label: "OK"    },
  warn:    { color: "yellow",  label: "WARN"  },
  error:   { color: "red",     label: "ERROR" },
  cmd:     { color: "magenta", label: "CMD"   },
  event:   { color: "blue",    label: "EVENT" },
};

function log(level, context, message) {
  const { color, label } = LEVELS[level] || LEVELS.info;
  const ts  = new Date().toLocaleTimeString("en-US", { hour12: false });
  const tag = chalk[color].bold(`[${label}]`);
  const ctx = context ? chalk.gray(`(${context})`) : "";
  console.log(`${chalk.gray(ts)} ${tag} ${ctx} ${message}`);
}

module.exports = {
  info:    (ctx, msg) => log("info",    ctx, msg),
  success: (ctx, msg) => log("success", ctx, msg),
  warn:    (ctx, msg) => log("warn",    ctx, msg),
  error:   (ctx, msg) => log("error",   ctx, msg),
  cmd:     (ctx, msg) => log("cmd",     ctx, msg),
  event:   (ctx, msg) => log("event",   ctx, msg),
};
