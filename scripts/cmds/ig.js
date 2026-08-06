"use strict";

// ─── Islamic quotes (original by nayan, ported to Telegram) ──────────────────
const QUOTES = [
  "ღ••\n– কোনো নেতার পিছনে নয়.!!🤸‍♂️\n– মসজিদের ইমামের পিছনে দাড়াও জীবন বদলে যাবে ইনশাআল্লাহ.!!🖤🌻\n۵",
  "-!\n__আল্লাহর রহমত থেকে নিরাশ হওয়া যাবে না! আল্লাহ অবশ্যই তোমাকে ক্ষমা করে দিবেন☺️🌻\nসুরা যুমাহ্ আয়াত ৫২..৫৩💙🌸\n-!",
  "- ইসলাম অহংকার করতে শেখায় না!🌸\n\n- ইসলাম শুকরিয়া আদায় করতে শেখায়!🤲🕋🥀",
  "- বেপর্দা নারী যদি নায়িকা হতে পারে\n– তবে পর্দাশীল নারী গুলো সব ইসলামের শাহাজাদী🌺🥰\nমাশাল্লাহ।।",
  "┏━━━━ ﷽ ━━━━┓\n 🖤 স্মার্ট নয় ইসলামিক জীবন সঙ্গি খুঁজুন 🥰\n┗━━━━ ﷽ ━━━━┛",
  "ღ– যখন বান্দার জ্বর হয়😇\n🖤 তখন গুনাহ গুলো ঝড়ে পড়তে থাকে☺️\n– হযরত মুহাম্মদ (সাঃ)",
  "🍂🦋\n𝐇𝐚𝐩𝐩𝐢𝐧𝐞𝐬𝐬 𝐈𝐬 𝐄𝐧𝐣𝐨𝐲𝐢𝐧𝐠 𝐓𝐡𝐞 𝐋𝐢𝐭𝐭𝐥𝐞 𝐓𝐡𝐢𝐧𝐠𝐬 𝐈𝐧 𝐋𝐢𝐟𝐞♡🌸\n𝐀𝐥𝐡𝐚𝐦𝐝𝐮𝐥𝐢𝐥𝐥𝐚𝐡 𝐅𝐨𝐫 𝐄𝐯𝐞𝐫𝐲𝐭𝐡𝐢𝐧𝐠💗🥰",
  "💜🌈\n– তুমি আসক্ত হও🖤🌸✨\n– তবে নেশায় নয়, আল্লাহর ইবাদতে🖤🌸✨",
  "– হাসতে হাসতে একদিন😊\n– সবাইকে কাদিয়ে বিদায় নিবো🙂💔🥀",
  "🦋🥀\nহাজারো স্বপ্নের শেষ স্থান🙂🤲🥀\n♡ কবরস্থান ♡❤",
  "প্রসঙ্গ যখন ধর্ম নিয়ে🥰😊\nতখন আমাদের ইসলামই সেরা❤️\n𝐀𝐥𝐡𝐚𝐦𝐝𝐮𝐥𝐢𝐥𝐥𝐚𝐡🌸❤️",
  "🥀 কেউ পছন্দ না করলে কি যায় আসে🙂\n😇 আল্লাহ তো পছন্দ করেই বানিয়েছে♥️🥀\nAlhamdulillah🕋",
  "🌼 এত অহংকার করে লাভ নেই!🌺\nমৃত্যুটা নিশ্চিত, শুধু সময়টা অনিশ্চিত।🖤🙂",
  "🌻 ছিঁড়ে ফেলুন অতীতের সকল পাপের অধ্যায়।\nফিরে আসুন রবের ভালোবাসায়🖤🥀",
  "বুকে হাজারো কষ্ট নিয়ে আলহামদুলিল্লাহ বলাটা☺️\nআল্লাহর প্রতি অগাধ বিশ্বাসের নমুনা❤️🥀",
  "আল্লাহর ভালোবাসা পেতে চাও🤗\nতবে রাসুল (সা:) কে অনুসরণ করো🥰",
];

// ─── Random Islamic-themed images ─────────────────────────────────────────────
const IMAGES = [
  "https://i.postimg.cc/7LdGnyjQ/images-31.jpg",
  "https://i.postimg.cc/65c81ZDZ/images-30.jpg",
  "https://i.postimg.cc/Y0wvTzr6/images-29.jpg",
  "https://i.postimg.cc/1Rpnw2BJ/images-28.jpg",
  "https://i.postimg.cc/mgrPxDs5/images-27.jpg",
  "https://i.postimg.cc/yxXDK3xw/images-26.jpg",
  "https://i.postimg.cc/kXqVcsh9/muslim-boy-having-worship-praying-fasting-eid-islamic-culture-mosque-73899-1334.webp",
  "https://i.postimg.cc/hGzhj5h8/muslims-reading-from-quran-53876-20958.webp",
  "https://i.postimg.cc/x1Fc92jT/blue-mosque-istanbul-1157-8841.webp",
  "https://i.postimg.cc/j5y56nHL/muhammad-ali-pasha-cairo-219717-5352.webp",
  "https://i.postimg.cc/dVWyHfhr/images-1-21.jpg",
  "https://i.postimg.cc/q7MGgn3X/images-1-22.jpg",
  "https://i.postimg.cc/sX5CXtSh/images-1-16.jpg",
  "https://i.postimg.cc/66Rp2Pwz/images-1-17.jpg",
  "https://i.postimg.cc/Qtzh9pY2/images-1-18.jpg",
  "https://i.postimg.cc/MGrhdz0R/images-1-19.jpg",
  "https://i.postimg.cc/LsMSj9Ts/images-1-20.jpg",
  "https://i.postimg.cc/KzNXyttX/images-1-13.jpg",
];

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  config: {
    name:      `${global.GoatBot.config.prefix}`,
    aliases:   ["islam", "quote", "দোয়া"],  // Bengali alias too
    version:   "1.0.0",
    author:    "nayan (ported)",
    usePrefix: false,
    role:      0,
    category:  "fun",
    countDown: 5,
    description: {
      en: "Send a random Islamic quote with a beautiful image",
      bn: "একটি র‍্যান্ডম ইসলামিক উক্তি ও ছবি পাঠায়",
    },
    guide: {
      en: "{pn} — get a random Islamic quote with image",
    },
  },

  langs: {
    en: {
      error: "❌ Could not load image. Here's the quote anyway:\n\n%1",
    },
  },

  onStart: async function ({ message, getLang }) {
    const quote    = random(QUOTES);
    const imageUrl = random(IMAGES);

    // Wrap the quote in Islamic-style bracket just like the original
    const caption = `「 ${quote} 」`;

    try {
      // message.sendPhoto accepts a URL directly — no temp file needed on Telegram
      await message.sendPhoto(imageUrl, caption);
    } catch {
      // If image fails (dead link etc.), fall back to text-only
      await message.reply(getLang("error").replace("%1", caption));
    }
  },
};
