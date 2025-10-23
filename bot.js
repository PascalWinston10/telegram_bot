// =============================
// ADMIN BOT (Promote/Demote/Greeting/Tagall)
// Telegram Bot Version
// =============================

// Menggunakan 'dotenv' untuk keamanan token
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

// === AMBIL TOKEN DARI FILE .env ===
const token = process.env.TELEGRAM_TOKEN;

// Validasi jika token tidak ditemukan
if (!token) {
  console.error("Kesalahan: TELEGRAM_TOKEN tidak ditemukan.");
  console.log("Silakan buat file .env dan tambahkan TELEGRAM_TOKEN=... Anda.");
  process.exit(1);
}

// Jalankan bot dengan polling
const bot = new TelegramBot(token, { polling: true });

// (TAMBAHAN BARU) Variabel untuk menyimpan member aktif per grup
const groupMembers = {};

// =============================
// Teks /start
// =============================
function sendStartMessage(chatId, chatType) {
  let text = `
🤖 Halo! Saya adalah Bot Admin.

Saya dapat membantu mengelola admin dan menyapa anggota baru di grup ini.

*Perintah yang tersedia:*
/promote - (Balas pesan user) untuk promote jadi admin.
/demote - (Balas pesan user) untuk demote admin.
/tagall [pesan] - (Admin) Mention semua member aktif.
/checkbot - Cek status dan hak akses bot di grup ini.
`;

  // Pesan berbeda jika di private chat
  if (chatType !== "group" && chatType !== "supergroup") {
    text =
      "🤖 Halo! Saya adalah bot admin. Tambahkan saya ke grup untuk menggunakan semua fitur.";
  }

  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

// =============================
// FUNGSI PROMOTE/DEMOTE MEMBER
// (Kode ini tidak berubah)
// =============================

// Fungsi untuk cek apakah bot adalah admin dengan hak promote
async function checkBotAdminRights(chatId) {
  try {
    const botInfo = await bot.getMe();
    const chatMember = await bot.getChatMember(chatId, botInfo.id);

    if (
      chatMember.status !== "administrator" &&
      chatMember.status !== "creator"
    ) {
      return { success: false, message: "Bot bukan admin di grup ini!" };
    }

    if (!chatMember.can_promote_members) {
      return {
        success: false,
        message:
          "Bot tidak punya izin 'Add New Admins'. Pastikan izin ini diaktifkan!",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error checking bot rights:", error);
    return {
      success: false,
      message: "Gagal mengecek hak akses bot: " + error.message,
    };
  }
}

// Fungsi untuk promote member
async function promoteMember(chatId, userId, username) {
  try {
    const botCheck = await checkBotAdminRights(chatId);
    if (!botCheck.success) {
      return { success: false, message: botCheck.message };
    }

    await bot.promoteChatMember(chatId, userId, {
      can_manage_chat: true,
      can_delete_messages: true,
      can_manage_video_chats: true,
      can_restrict_members: true,
      can_promote_members: true,
      can_change_info: true,
      can_invite_users: true,
      can_pin_messages: true,
    });

    return {
      success: true,
      message: `✅ Berhasil! ${username} sekarang adalah admin.`,
    };
  } catch (error) {
    console.error("Error promoting member:", error);
    if (error.response && error.response.body) {
      const errorMsg = error.response.body.description;
      if (errorMsg.includes("RIGHT_FORBIDDEN")) {
        return {
          success: false,
          message:
            "❌ Bot tidak memiliki izin untuk menambah admin. Cek pengaturan admin bot!",
        };
      } else if (errorMsg.includes("USER_NOT_MUTUAL_CONTACT")) {
        return {
          success: false,
          message:
            "❌ User ini tidak bisa dipromote (mungkin belum join grup atau adalah bot).",
        };
      }
      return { success: false, message: `❌ Error: ${errorMsg}` };
    }
    return { success: false, message: "❌ Gagal promote: " + error.message };
  }
}

// Fungsi untuk demote admin
async function demoteMember(chatId, userId, username) {
  try {
    const botCheck = await checkBotAdminRights(chatId);
    if (!botCheck.success) {
      return { success: false, message: botCheck.message };
    }

    await bot.promoteChatMember(chatId, userId, {
      can_manage_chat: false,
      can_delete_messages: false,
      can_manage_video_chats: false,
      can_restrict_members: false,
      can_promote_members: false,
      can_change_info: false,
      can_invite_users: false,
      can_pin_messages: false,
    });

    return {
      success: true,
      message: `✅ Berhasil! ${username} sekarang adalah member biasa.`,
    };
  } catch (error) {
    console.error("Error demoting member:", error);
    if (error.response && error.response.body) {
      const errorMsg = error.response.body.description;
      return { success: false, message: `❌ Error: ${errorMsg}` };
    }
    return { success: false, message: "❌ Gagal demote: " + error.message };
  }
}

// =============================
// COMMAND /START
// =============================
bot.onText(/\/start/, (msg) => {
  sendStartMessage(msg.chat.id, msg.chat.type);
});

// =============================
// (MODIFIKASI) LOGGER & PENCATAT MEMBER
// =============================
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username;

  // (TAMBAHAN BARU) Simpan data member untuk /tagall
  // Hanya simpan jika di grup dan user punya username
  if (
    (msg.chat.type === "group" || msg.chat.type === "supergroup") &&
    username
  ) {
    if (!groupMembers[chatId]) {
      groupMembers[chatId] = {};
    }
    // Simpan username berdasarkan userId untuk menghindari duplikat
    groupMembers[chatId][userId] = username;
  }

  // Cek apakah pesan dari event 'new_chat_members' atau 'left_chat_member'
  if (msg.new_chat_members || msg.left_chat_member) {
    return;
  }

  // Abaikan jika itu adalah perintah (karena sudah ditangani oleh onText)
  if (msg.text && msg.text.startsWith("/")) {
    return;
  }
  // Abaikan jika itu balasan (ditangani oleh onReplyToMessage jika ada)
  if (msg.reply_to_message) {
    return;
  }
  // Jangan respon apa-apa di private chat, biarkan /start yang menangani
  if (msg.chat.type === "private") {
    return;
  }

  console.log(
    `Pesan dari @${username || msg.from.first_name} di grup ${chatId}: ${
      msg.text
    }`
  );
});

// =============================
// COMMAND /PROMOTE
// (Kode ini tidak berubah)
// =============================
bot.onText(/\/promote/, async (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;

  if (chatType !== "group" && chatType !== "supergroup") {
    return bot.sendMessage(
      chatId,
      "❌ Perintah ini hanya bisa digunakan di grup!"
    );
  }

  try {
    const userMember = await bot.getChatMember(chatId, msg.from.id);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    ) {
      return bot.sendMessage(
        chatId,
        "❌ Hanya admin yang bisa menggunakan perintah ini!"
      );
    }
  } catch (error) {
    console.error("Error checking user admin status:", error);
    return bot.sendMessage(chatId, "❌ Gagal mengecek status admin kamu.");
  }

  if (msg.reply_to_message) {
    const targetUser = msg.reply_to_message.from;
    const username = targetUser.username
      ? `@${targetUser.username}`
      : targetUser.first_name;

    const result = await promoteMember(chatId, targetUser.id, username);
    return bot.sendMessage(chatId, result.message);
  } else {
    return bot.sendMessage(
      chatId,
      "ℹ️ Cara pakai: Reply pesan user yang ingin di-promote, lalu ketik /promote"
    );
  }
});

// =============================
// COMMAND /DEMOTE
// (Kode ini tidak berubah)
// =============================
bot.onText(/\/demote/, async (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;

  if (chatType !== "group" && chatType !== "supergroup") {
    return bot.sendMessage(
      chatId,
      "❌ Perintah ini hanya bisa digunakan di grup!"
    );
  }

  try {
    const userMember = await bot.getChatMember(chatId, msg.from.id);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    ) {
      return bot.sendMessage(
        chatId,
        "❌ Hanya admin yang bisa menggunakan perintah ini!"
      );
    }
  } catch (error) {
    console.error("Error checking user admin status:", error);
    return bot.sendMessage(chatId, "❌ Gagal mengecek status admin kamu.");
  }

  if (msg.reply_to_message) {
    const targetUser = msg.reply_to_message.from;
    const username = targetUser.username
      ? `@${targetUser.username}`
      : targetUser.first_name;

    const result = await demoteMember(chatId, targetUser.id, username);
    return bot.sendMessage(chatId, result.message);
  } else {
    return bot.sendMessage(
      chatId,
      "ℹ️ Cara pakai: Reply pesan user yang ingin di-demote, lalu ketik /demote"
    );
  }
});

// =============================
// (TAMBAHAN BARU) COMMAND /TAGALL
// =============================
bot.onText(/\/tagall/, async (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;

  // 1. Hanya bisa di grup
  if (chatType !== "group" && chatType !== "supergroup") {
    return bot.sendMessage(
      chatId,
      "❌ Perintah ini hanya bisa digunakan di grup!"
    );
  }

  // 2. Cek apakah user adalah admin
  try {
    const userMember = await bot.getChatMember(chatId, msg.from.id);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    ) {
      return bot.sendMessage(
        chatId,
        "❌ Hanya admin yang bisa menggunakan perintah ini!"
      );
    }
  } catch (error) {
    return bot.sendMessage(chatId, "❌ Gagal mengecek status admin kamu.");
  }

  // 3. Ambil daftar member yang tersimpan
  const members = groupMembers[chatId];
  if (!members || Object.keys(members).length === 0) {
    return bot.sendMessage(
      chatId,
      "🤖 Belum ada member aktif yang tercatat. Biarkan member lain chat dulu agar data tersimpan."
    );
  }

  // 4. Buat pesan tag
  // Ambil pesan custom setelah /tagall
  const customMessage = msg.text.replace("/tagall", "").trim();

  let messageText = "";
  if (customMessage) {
    messageText = `${customMessage}\n\n`; // Gunakan pesan custom jika ada
  } else {
    messageText = "📣 *PANGGIL SEMUA MEMBER AKTIF!*\n\n"; // Pesan default
  }

  let userTags = [];
  for (const userId in members) {
    // Kita tag menggunakan @username
    userTags.push(`@${members[userId]}`);
  }

  messageText += userTags.join(" ");

  // 5. Kirim pesan
  try {
    // Kirim pesan tanpa parse_mode Markdown untuk memastikan tag berfungsi
    await bot.sendMessage(chatId, messageText);
  } catch (error) {
    console.error("Error sending tagall:", error);
    await bot.sendMessage(
      chatId,
      "❌ Gagal mengirim tag. Mungkin daftar member terlalu panjang atau ada error lain."
    );
  }
});

// =============================
// COMMAND /CHECKBOT
// (Kode ini tidak berubah)
// =============================
bot.onText(/\/checkbot/, async (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;

  if (chatType !== "group" && chatType !== "supergroup") {
    return bot.sendMessage(
      chatId,
      "❌ Perintah ini hanya bisa digunakan di grup!"
    );
  }

  try {
    const botInfo = await bot.getMe();
    const chatMember = await bot.getChatMember(chatId, botInfo.id);

    let statusMsg = `🤖 *Status Bot:*\n\n`;
    statusMsg += `👤 Username: @${botInfo.username}\n`;
    statusMsg += `📊 Status: ${chatMember.status}\n\n`;

    if (chatMember.status === "administrator") {
      statusMsg += `*Hak Akses Admin:*\n`;
      statusMsg += `${chatMember.can_manage_chat ? "✅" : "❌"} Manage Chat\n`;
      statusMsg += `${
        chatMember.can_delete_messages ? "✅" : "❌"
      } Delete Messages\n`;
      statusMsg += `${
        chatMember.can_restrict_members ? "✅" : "❌"
      } Ban Users\n`;
      statusMsg += `${
        chatMember.can_promote_members ? "✅" : "❌"
      } Add New Admins ⭐\n`;
      statusMsg += `${
        chatMember.can_change_info ? "✅" : "❌"
      } Change Group Info\n`;
      statusMsg += `${
        chatMember.can_invite_users ? "✅" : "❌"
      } Invite Users\n`;
      statusMsg += `${
        chatMember.can_pin_messages ? "✅" : "❌"
      } Pin Messages\n`;

      if (!chatMember.can_promote_members) {
        statusMsg += `\n⚠️ *PERHATIAN:* Bot tidak memiliki izin "Add New Admins"!\n`;
        statusMsg += `Aktifkan izin ini agar bot bisa promote/demote member.`;
      } else {
        statusMsg += `\n✅ Bot siap untuk promote/demote member!`;
      }
    } else if (chatMember.status === "creator") {
      statusMsg += `👑 Bot adalah creator grup (semua akses penuh)`;
    } else {
      statusMsg += `❌ Bot bukan admin di grup ini!`;
    }

    bot.sendMessage(chatId, statusMsg, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error checking bot status:", error);
    bot.sendMessage(chatId, "❌ Gagal mengecek status bot: " + error.message);
  }
});

// =============================
// GREETING MEMBER BARU
// (Kode ini tidak berubah)
// =============================
bot.on("new_chat_members", (msg) => {
  const chatId = msg.chat.id;

  msg.new_chat_members.forEach((member) => {
    const name = member.username ? `@${member.username}` : member.first_name;

    const welcomeMessage = `
Selamat datang di grup, ${name}! 👋

Senang kamu bergabung. Jangan lupa baca peraturan grup, ya!
Semoga Betah^_^🎉
`;

    bot.sendMessage(chatId, welcomeMessage);
  });
});

// =============================
// PESAN MEMBER KELUAR
// (Kode ini tidak berubah)
// =============================
bot.on("left_chat_member", (msg) => {
  const chatId = msg.chat.id;
  const member = msg.left_chat_member;

  const name = member.username ? `@${member.username}` : member.first_name;

  const goodbyeMessage = `
Yah, ${name} telah meninggalkan grup. 😢
Sampai jumpa lagi di lain waktu!
`;

  bot.sendMessage(chatId, goodbyeMessage);
});

// =============================
// LOG STARTUP
// =============================
console.log("🤖 ADMIN BOT (Promote/Demote/Greeting/Tagall) Sedang berjalan...");
console.log("📋 Commands tersedia:");
console.log("   /promote - Promote member jadi admin (reply ke user)");
console.log("   /demote - Demote admin jadi member (reply ke user)");
console.log("   /tagall [pesan] - (Admin) Mention semua member aktif");
console.log("   /checkbot - Cek status dan hak akses bot");
