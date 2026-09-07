"use strict";

/**
 * scripts/cmds/cmd.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Ported from the Facebook GoatBot V2 "cmd" command to this Telegram
 * GoatBot-style framework (node-telegram-bot-api). Lets a bot admin
 * load / reload / unload command files, and install new ones from a URL
 * or from pasted code, without restarting the bot.
 *
 * Differences from the original Facebook version (framework has no 1:1
 * equivalent for these, so they're adapted):
 *   - api/event/message/threadsData/usersData/globalData come from this
 *     framework's ctx object (see core/handleMessage.js), not fca-unofficial.
 *   - There's no configCommands.json / envConfig / envGlobal system here,
 *     so that part of the original is dropped — install/load simply
 *     registers the command into global.GoatBot.commands (mirrors
 *     core/loadCommands.js exactly).
 *   - Facebook's "react to confirm overwrite" flow is replaced with this
 *     framework's native setPendingReply/onReply confirmation (the user
 *     Telegram-replies "yes" to the bot's prompt).
 *   - "unload" is in-memory only for this session — like the rest of this
 *     framework (see reload.js), a full /reload or bot restart re-scans
 *     scripts/cmds/ and will bring the file back.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const axios = require("axios");
const { execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");

const CMDS_DIR = __dirname; // scripts/cmds — this file's own folder

// Node builtins never need `npm install`
const BUILTIN_MODULES = [
	"fs", "path", "child_process", "http", "https", "os", "crypto",
	"util", "events", "stream", "url", "querystring", "assert", "zlib"
];

function getDomain(url) {
	const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/im;
	const match = url.match(regex);
	return match ? match[1] : null;
}

function isURL(str) {
	try {
		new URL(str);
		return true;
	}
	catch (e) {
		return false;
	}
}

module.exports = {
	config: {
		name: "cmd",
		version: "2.0",
		author: "NTKhang (ported to Telegram)",
		usePrefix: true,
		role: 2,
		category: "admin",
		countDown: 5,
		description: {
			vi: "Quản lý các tệp lệnh của bạn",
			en: "Manage your command files"
		},
		guide: {
			vi: "   {pn} load <tên file lệnh>"
				+ "\n   {pn} loadAll"
				+ "\n   {pn} unload <tên file lệnh>"
				+ "\n   {pn} install <url> <tên file lệnh>: Tải xuống và cài đặt một tệp lệnh từ một url, url là đường dẫn đến tệp lệnh (raw)"
				+ "\n   {pn} install <tên file lệnh> <code>: Tải xuống và cài đặt một tệp lệnh từ một code, code là mã của lệnh",
			en: "   {pn} load <command file name>"
				+ "\n   {pn} loadAll"
				+ "\n   {pn} unload <command file name>"
				+ "\n   {pn} install <url> <command file name>: Download and install a command file from a url, url is the path to the file (raw)"
				+ "\n   {pn} install <command file name> <code>: Download and install a command file from a code, code is the code of the command"
		}
	},

	langs: {
		vi: {
			missingFileName: "⚠️ | Vui lòng nhập vào tên lệnh bạn muốn reload",
			loaded: "✅ | Đã load command \"%1\" thành công",
			loadedError: "❌ | Load command \"%1\" thất bại với lỗi\n%2: %3",
			loadedSuccess: "✅ | Đã load thành công (%1) command",
			loadedFail: "❌ | Load thất bại (%1) command\n%2",
			missingCommandNameUnload: "⚠️ | Vui lòng nhập vào tên lệnh bạn muốn unload",
			unloaded: "✅ | Đã unload command \"%1\" thành công (sẽ được nạp lại nếu bot reload/restart)",
			unloadedError: "❌ | Unload command \"%1\" thất bại với lỗi\n%2: %3",
			missingUrlCodeOrFileName: "⚠️ | Vui lòng nhập vào url hoặc code và tên file lệnh bạn muốn cài đặt",
			missingFileNameInstall: "⚠️ | Vui lòng nhập vào tên file để lưu lệnh (đuôi .js)",
			invalidUrl: "⚠️ | Vui lòng nhập vào url hợp lệ",
			invalidUrlOrCode: "⚠️ | Không thể lấy được mã lệnh",
			alreadExist: "⚠️ | File lệnh đã tồn tại, bạn có chắc chắn muốn ghi đè lên file lệnh cũ không?\n*Reply* tin nhắn này với \"yes\" để tiếp tục",
			cancelled: "🚫 | Đã huỷ cài đặt",
			installed: "✅ | Đã cài đặt command \"%1\" thành công, file lệnh được lưu tại %2",
			installedError: "❌ | Cài đặt command \"%1\" thất bại với lỗi\n%2: %3",
			invalidSyntax: "⚠️ | Sai cú pháp\n\n%1"
		},
		en: {
			missingFileName: "⚠️ | Please enter the command name you want to reload",
			loaded: "✅ | Loaded command \"%1\" successfully",
			loadedError: "❌ | Failed to load command \"%1\" with error\n%2: %3",
			loadedSuccess: "✅ | Loaded successfully (%1) command",
			loadedFail: "❌ | Failed to load (%1) command\n%2",
			missingCommandNameUnload: "⚠️ | Please enter the command name you want to unload",
			unloaded: "✅ | Unloaded command \"%1\" successfully (will come back on the next /reload or restart)",
			unloadedError: "❌ | Failed to unload command \"%1\" with error\n%2: %3",
			missingUrlCodeOrFileName: "⚠️ | Please enter the url or code and command file name you want to install",
			missingFileNameInstall: "⚠️ | Please enter the file name to save the command (with .js extension)",
			invalidUrl: "⚠️ | Please enter a valid url",
			invalidUrlOrCode: "⚠️ | Unable to get command code",
			alreadExist: "⚠️ | The command file already exists, are you sure you want to overwrite the old command file?\n*Reply* to this message with \"yes\" to continue",
			cancelled: "🚫 | Install cancelled",
			installed: "✅ | Installed command \"%1\" successfully, the command file is saved at %2",
			installedError: "❌ | Failed to install command \"%1\" with error\n%2: %3",
			invalidSyntax: "⚠️ | Wrong syntax\n\n%1"
		}
	},

	onStart: async function ({ args, message, event, getLang, setPendingReply, prefix }) {
		const { loadScripts, unloadScripts } = global.utils;

		// ── load <name> ──────────────────────────────────────────────────────
		if (args[0] === "load" && args.length === 2) {
			if (!args[1])
				return message.reply(getLang("missingFileName"));

			const infoLoad = loadScripts(args[1]);
			if (infoLoad.status === "success")
				return message.reply(getLang("loaded", infoLoad.name));
			else
				return message.reply(getLang("loadedError", infoLoad.name, infoLoad.error.name, infoLoad.error.message));
		}

		// ── loadAll  /  load <name1> <name2> ... ────────────────────────────
		else if (
			(args[0] || "").toLowerCase() === "loadall"
			|| (args[0] === "load" && args.length > 2)
		) {
			const fileNeedToLoad = (args[0] || "").toLowerCase() === "loadall" ?
				fs.readdirSync(CMDS_DIR)
					.filter(file =>
						file.endsWith(".js") &&
						!file.match(/^_TEMPLATE\.js$/i) &&
						!file.match(/\.dev\.js$/)
					)
					.map(item => item.slice(0, -3)) :
				args.slice(1);

			const arraySuccess = [];
			const arrayFail = [];

			for (const fileName of fileNeedToLoad) {
				const infoLoad = loadScripts(fileName);
				if (infoLoad.status === "success")
					arraySuccess.push(fileName);
				else
					arrayFail.push(` ❗ ${fileName} => ${infoLoad.error.name}: ${infoLoad.error.message}`);
			}

			let msg = "";
			if (arraySuccess.length > 0)
				msg += getLang("loadedSuccess", arraySuccess.length);
			if (arrayFail.length > 0)
				msg += (msg ? "\n" : "") + getLang("loadedFail", arrayFail.length, arrayFail.join("\n"));

			return message.reply(msg || getLang("loadedSuccess", 0));
		}

		// ── unload <name> ────────────────────────────────────────────────────
		else if (args[0] === "unload") {
			if (!args[1])
				return message.reply(getLang("missingCommandNameUnload"));

			const infoUnload = unloadScripts(args[1]);
			return infoUnload.status === "success" ?
				message.reply(getLang("unloaded", infoUnload.name)) :
				message.reply(getLang("unloadedError", infoUnload.name, infoUnload.error.name, infoUnload.error.message));
		}

		// ── install <url|code> <fileName> ───────────────────────────────────
		else if (args[0] === "install") {
			let url = args[1];
			let fileName = args[2];
			let rawCode;

			if (!url || !fileName)
				return message.reply(getLang("missingUrlCodeOrFileName"));

			// allow either order: "install <file.js> <url>" or "install <url> <file.js>"
			if (url.endsWith(".js") && !isURL(url)) {
				const tmp = fileName;
				fileName = url;
				url = tmp;
			}

			if (url && url.match(/(https?:\/\/(?:www\.|(?!www)))/)) {
				if (!fileName || !fileName.endsWith(".js"))
					return message.reply(getLang("missingFileNameInstall"));

				const domain = getDomain(url);
				if (!domain)
					return message.reply(getLang("invalidUrl"));

				if (domain === "pastebin.com") {
					const regex = /https:\/\/pastebin\.com\/(?!raw\/)(.*)/;
					if (url.match(regex))
						url = url.replace(regex, "https://pastebin.com/raw/$1");
					if (url.endsWith("/"))
						url = url.slice(0, -1);
				}
				else if (domain === "github.com") {
					const regex = /https:\/\/github\.com\/(.*)\/blob\/(.*)/;
					if (url.match(regex))
						url = url.replace(regex, "https://raw.githubusercontent.com/$1/$2");
				}

				try {
					rawCode = (await axios.get(url)).data;
				}
				catch (e) {
					return message.reply(getLang("invalidUrlOrCode"));
				}

				if (domain === "savetext.net") {
					const $ = cheerio.load(rawCode);
					rawCode = $("#content").text();
				}

				if (typeof rawCode !== "string")
					rawCode = String(rawCode);
			}
			else {
				// code pasted directly in the message
				const body = event.body || "";
				const lastArg = args[args.length - 1];

				if (lastArg && lastArg.endsWith(".js")) {
					fileName = lastArg;
					const idxInstall = body.toLowerCase().indexOf("install");
					const idxFileName = body.lastIndexOf(fileName);
					rawCode = (idxInstall !== -1 && idxFileName !== -1 && idxFileName > idxInstall) ?
						body.slice(idxInstall + "install".length, idxFileName).trim() :
						"";
				}
				else if (args[1] && args[1].endsWith(".js")) {
					fileName = args[1];
					const idxFileName = body.indexOf(fileName);
					rawCode = idxFileName !== -1 ?
						body.slice(idxFileName + fileName.length).trim() :
						"";
				}
				else
					return message.reply(getLang("missingFileNameInstall"));
			}

			if (!rawCode)
				return message.reply(getLang("invalidUrlOrCode"));

			const destPath = path.join(CMDS_DIR, fileName);

			if (fs.existsSync(destPath)) {
				const sent = await message.reply(getLang("alreadExist"));
				if (sent && sent.message_id) {
					setPendingReply("cmd", {
						type: "install",
						author: event.senderID,
						fileName,
						rawCode,
						messageID: sent.message_id
					});
				}
				return;
			}

			const infoLoad = loadScripts(fileName, rawCode);
			return infoLoad.status === "success" ?
				message.reply(getLang("installed", infoLoad.name, `/scripts/cmds/${fileName}`)) :
				message.reply(getLang("installedError", infoLoad.name, infoLoad.error.name, infoLoad.error.message));
		}

		else {
			const guideText = (this.config.guide[global.GoatBot.config.language] || this.config.guide.en)
				.replace(/{pn}/g, `${prefix}${this.config.name}`)
				.replace(/{p}/g, prefix);
			return message.reply(getLang("invalidSyntax", guideText));
		}
	},

	// Fires when the user Telegram-replies "yes" to the "already exists,
	// overwrite?" prompt from the install flow above.
	onReply: async function ({ event, message, pendingData, getLang }) {
		if (!pendingData || pendingData.type !== "install")
			return;
		if (String(pendingData.author) !== String(event.senderID))
			return;

		const answer = (event.body || "").trim().toLowerCase();
		if (!["yes", "y", "confirm", "ok"].includes(answer))
			return message.reply(getLang("cancelled"));

		const { loadScripts } = global.utils;
		const infoLoad = loadScripts(pendingData.fileName, pendingData.rawCode);
		return infoLoad.status === "success" ?
			message.reply(getLang("installed", infoLoad.name, `/scripts/cmds/${pendingData.fileName}`)) :
			message.reply(getLang("installedError", infoLoad.name, infoLoad.error.name, infoLoad.error.message));
	}
};

// ─────────────────────────────────────────────────────────────────────────────
// global.utils.loadScripts / unloadScripts
// Mirrors core/loadCommands.js registration exactly (commands / aliases /
// onChat / onReply / onReaction) so a hot-loaded command behaves identically
// to one loaded at boot.
// ─────────────────────────────────────────────────────────────────────────────
const packageAlready = [];

function loadScripts(fileName, rawCode) {
	const { commands, aliases, onChat, onReply, onReaction } = global.GoatBot;
	const baseName = fileName.endsWith(".js") ? fileName.slice(0, -3) : fileName;
	const pathCommand = path.join(CMDS_DIR, `${baseName}.js`);

	try {
		if (rawCode)
			fs.writeFileSync(pathCommand, rawCode);

		if (!fs.existsSync(pathCommand)) {
			const err = new Error(`Command file "${baseName}.js" not found`);
			err.name = "FileNotFound";
			throw err;
		}

		// ————————————————— CHECK PACKAGE ————————————————— //
		const regExpCheckPackage = /require(\s+|)\((\s+|)[`'"]([^`'"]+)[`'"](\s+|)\)/g;
		const contentFile = fs.readFileSync(pathCommand, "utf8");
		let allPackage = contentFile.match(regExpCheckPackage);
		if (allPackage) {
			allPackage = allPackage
				.map(p => p.match(/[`'"]([^`'"]+)[`'"]/)[1])
				.filter(p => !p.startsWith(".") && !p.startsWith("/"));

			for (let packageName of allPackage) {
				if (packageName.startsWith("@"))
					packageName = packageName.split("/").slice(0, 2).join("/");
				else
					packageName = packageName.split("/")[0];

				if (BUILTIN_MODULES.includes(packageName))
					continue;

				if (!packageAlready.includes(packageName)) {
					packageAlready.push(packageName);
					if (!fs.existsSync(path.join(process.cwd(), "node_modules", packageName))) {
						try {
							execSync(`npm install ${packageName} --save`, { stdio: "pipe" });
						}
						catch (error) {
							throw new Error(`Can't install package ${packageName}`);
						}
					}
				}
			}
		}

		// ———————————————— GET OLD COMMAND (for clean reload) ———————————————— //
		let oldCommand = null;
		if (require.cache[require.resolve(pathCommand)]) {
			try { oldCommand = require(pathCommand); } catch (e) { oldCommand = null; }
		}
		const oldCommandName = oldCommand?.config?.name?.toLowerCase();

		if (oldCommand?.config?.aliases) {
			let oldAliases = oldCommand.config.aliases;
			if (typeof oldAliases === "string")
				oldAliases = [oldAliases];
			for (const alias of oldAliases)
				aliases.delete(alias.toLowerCase());
		}
		if (oldCommandName) {
			const idxOnChat = onChat.findIndex(item => item.name === oldCommandName);
			if (idxOnChat !== -1)
				onChat.splice(idxOnChat, 1);
			onReply.delete(oldCommandName);
			onReaction.delete(oldCommandName);
		}

		delete require.cache[require.resolve(pathCommand)];

		// ———————————————— GET NEW COMMAND ———————————————— //
		const command = require(pathCommand);
		command.location = pathCommand;
		const configCommand = command.config;
		if (!configCommand || typeof configCommand != "object")
			throw new Error("config of command must be an object");
		if (!command.onStart)
			throw new Error("Function onStart is missing!");
		if (typeof command.onStart != "function")
			throw new Error("Function onStart must be a function!");
		if (!configCommand.name)
			throw new Error("Name of command is missing!");

		const scriptName = configCommand.name.toLowerCase();

		// ————————————————— CHECK ALIASES ————————————————— //
		if (configCommand.aliases) {
			let cmdAliases = configCommand.aliases;
			if (typeof cmdAliases === "string")
				cmdAliases = [cmdAliases];
			for (const alias of cmdAliases) {
				const aliasLower = alias.toLowerCase();
				if (cmdAliases.filter(a => a.toLowerCase() === aliasLower).length > 1)
					throw new Error(`alias "${alias}" is duplicated in command "${scriptName}"`);
				if (aliases.has(aliasLower) && aliases.get(aliasLower) !== scriptName)
					throw new Error(`alias "${alias}" already exists for command "${aliases.get(aliasLower)}"`);
				aliases.set(aliasLower, scriptName);
			}
		}

		commands.set(scriptName, command);

		if (typeof command.onChat === "function")
			onChat.push({ name: scriptName, fn: command.onChat });
		if (typeof command.onReply === "function")
			onReply.set(scriptName, command.onReply);
		if (typeof command.onReaction === "function")
			onReaction.set(scriptName, command.onReaction);

		return {
			status: "success",
			name: scriptName,
			command
		};
	}
	catch (err) {
		return {
			status: "failed",
			name: baseName,
			error: err
		};
	}
}

function unloadScripts(fileName) {
	const baseName = fileName.endsWith(".js") ? fileName.slice(0, -3) : fileName;
	const pathCommand = path.join(CMDS_DIR, `${baseName}.js`);

	try {
		if (!fs.existsSync(pathCommand)) {
			const err = new Error(`Command file "${baseName}.js" not found`);
			err.name = "FileNotFound";
			throw err;
		}

		let command = null;
		try { command = require(pathCommand); } catch (e) { command = null; }
		const commandName = command?.config?.name?.toLowerCase() || baseName.toLowerCase();

		const { commands, aliases, onChat, onReply, onReaction } = global.GoatBot;
		const registered = commands.get(commandName);

		if (registered?.config?.aliases) {
			let a = registered.config.aliases;
			if (typeof a === "string")
				a = [a];
			for (const alias of a)
				aliases.delete(alias.toLowerCase());
		}

		const idxOnChat = onChat.findIndex(item => item.name === commandName);
		if (idxOnChat !== -1)
			onChat.splice(idxOnChat, 1);
		onReply.delete(commandName);
		onReaction.delete(commandName);

		delete require.cache[require.resolve(pathCommand)];
		commands.delete(commandName);

		return {
			status: "success",
			name: commandName
		};
	}
	catch (err) {
		return {
			status: "failed",
			name: baseName,
			error: err
		};
	}
}

global.utils.loadScripts = loadScripts;
global.utils.unloadScripts = unloadScripts;
