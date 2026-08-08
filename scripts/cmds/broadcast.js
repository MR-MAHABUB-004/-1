"use strict";

module.exports = {
  config: {
    name:      "broadcast",
    aliases:   ["bc", "announce"],
    version:   "2.0.0",
    author:    "System",
    usePrefix: true,
    role:      2,           // bot admin only
    category:  "admin",
    countDown: 10,
    description: { en: "সব চ্যাটে মেসেজ, ছবি বা ভিডিও ব্রডকাস্ট করুন" },
    guide:       { en: "{pn} <মেসেজ>\nঅথবা কোনো ছবি/ভিডিওতে reply করে {pn} <ক্যাপশন>" },
  },

  langs: {
    en: {
      noMsg:
        "❌ ব্রডকাস্ট করার জন্য একটা মেসেজ বা ক্যাপশন দিন।\nউদাহরণ: {pn} নতুন আপডেট এসেছে!\nঅথবা কোনো ছবি/ভিডিওতে reply করে {pn} লিখুন।",

      sending:
        "📡 সব চ্যাটে পাঠানো হচ্ছে...",

      done:
        "✅ ব্রডকাস্ট সম্পন্ন হয়েছে।\n✔️ পাঠানো হয়েছে: %1\n❌ ব্যর্থ হয়েছে: %2",

      unsupported:
        "⚠️ এই ধরনের ফাইল (%1) ব্রডকাস্টে সমর্থিত না। শুধু ছবি বা ভিডিও ব্যবহার করুন।",
    },
  },

  onStart: async function ({ event, message, args, getLang, prefix }) {
    const caption = args.join(" ").trim();

    // ---------------------------------------------------------------
    // Look for a photo/video/document on the replied-to message.
    // event.messageReply.attachments is built by core/utils.js's
    // buildEventObject() — each entry looks like { type, fileId }.
    // ---------------------------------------------------------------

    const replyAttachments = (event.messageReply && event.messageReply.attachments) || [];
    const media = replyAttachments.find(
      (a) => a.type === "photo" || a.type === "video" || a.type === "document"
    );

    // If they replied to something, but it's a type we can't broadcast
    // (sticker, voice note, etc.) — say so instead of silently ignoring it.
    if (!media && replyAttachments.length > 0) {
      return message.reply(getLang("unsupported", replyAttachments[0].type));
    }

    if (!media && !caption) {
      return message.reply(
        getLang("noMsg").replace(/{pn}/g, prefix + this.config.name + " ")
      );
    }

    await message.reply(getLang("sending"));

    const text = caption ? `📢 *ঘোষণা*\n\n${caption}` : "";

    const payload = media
      ? { type: media.type, fileId: media.fileId, caption: text }
      : { type: "text", text };

    const { sent, failed } = await global.broadcast(payload);

    return message.reply(getLang("done", sent, failed));
  },
};
