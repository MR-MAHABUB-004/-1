"use strict";

/**

* scripts/cmds/start.js
* Welcome command
* New users will receive a welcome message and command guide.
  */

const BOT_NAME = "MAHABUB BOT";
const DEVELOPER_NAME = "MAHABUB BRO";

module.exports = {
config: {
name: "start",
aliases: ["hi", "hello", "menu"],
version: "1.0.0",
author: "System",
usePrefix: true,
role: 0,
category: "general",
countDown: 3,

description: {
  en: "Welcome and guide for new users"
},

guide: {
  en: "{pn}"
}

},

langs: {
en: {
welcome: "✨ %1 এ স্বাগতম! ✨\n\n",

  hello: "👋 হ্যালো *%1*! 😊\n\n",

  intro:
    "🤖 আমি তোমার জন্য বিভিন্ন কমান্ড ও ফিচার নিয়ে প্রস্তুত আছি।\n\n",

  help:
    "📚 *সব কমান্ড দেখতে:*\n" +
    "👉 `{pn}help`\n\n",

  guide:
    "💡 *কমান্ড ব্যবহার করার নিয়ম:*\n" +
    "কমান্ডের আগে Prefix ব্যবহার করতে হবে।\n" +
    "উদাহরণ: `{pn}help`\n\n",

  footer:
    "━━━━━━━━━━━━━━━━━━\n" +
    "🚀 *এখনই শুরু করতে `{pn}help` লিখো!*\n\n" +
    "© Developed by *%1*"
}

},

onStart: async function ({ message, event, getLang, prefix }) {
const firstName =
event?.senderName ||
event?.first_name ||
"বন্ধু";

let text = "";

// Welcome message
text += getLang("welcome").replace("%1", BOT_NAME);
text += getLang("hello").replace("%1", firstName);

// Bot introduction
text += getLang("intro");

// Help guide
text += getLang("help").replace(/{pn}/g, prefix);
text += getLang("guide").replace(/{pn}/g, prefix);

// Footer
text += getLang("footer")
  .replace(/{pn}/g, prefix)
  .replace("%1", DEVELOPER_NAME);

return message.reply(text, {
  parse_mode: "Markdown"
});

}
};
