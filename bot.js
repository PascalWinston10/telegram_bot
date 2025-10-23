// =============================
// ADMIN BOT (Full Features - FINAL FIX)
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

// Info bot (diperlukan untuk cek reply/mention)
let botUsername = "";
let botId = null;

bot
  .getMe()
  .then((me) => {
    botUsername = me.username;
    botId = me.id;
    console.log(`Info bot berhasil dimuat: @${botUsername} (ID: ${botId})`);
  })
  .catch((err) => {
    console.error("Kritis: Gagal mendapatkan info bot:", err);
    process.exit(1);
  });

// Variabel untuk menyimpan member aktif per grup
const groupMembers = {};

// Variabel untuk Game Tebak Kata
const wordList = [
  "TELEGRAM",
  "BOT",
  "JAVASCRIPT",
  "NODEJS",
  "CODING",
  "GITHUB",
  "PROMOTE",
  "DEMOTE",
  "ADMIN",
  "GRUP",
  "SERVER",
  "FLYIO",
];
const activeGames = {};

// =============================
// Teks /start (Diperbarui untuk promote/demote by tag)
// =============================
function sendStartMessage(chatId, chatType) {
  let text = `
🤖 Halo! Saya adalah Bot Admin & Game.

*Perintah Admin:*
/promote - (Reply/Tag) Promote jadi admin.
/demote - (Reply/Tag) Demote admin.
/tagall [pesan] - Mention semua member aktif.
/checkbot - Cek status dan hak akses bot.

*Perintah Game (Admin):*
/mulaitebak - Memulai game tebak kata.
/stoptebak - Menghentikan paksa game tebak kata.

*Perintah Game (Member):*
/jawab [kata] - Untuk menjawab tebak kata.
`;

  if (chatType !== "group" && chatType !== "supergroup") {
    text =
      "🤖 Halo! Saya adalah bot admin & game. Tambahkan saya ke grup untuk menggunakan semua fitur.";
  }

  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

// =============================
// FUNGSI UTAMA (ADMIN, SAPAAN, DLL)
// =============================

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

    // Menggunakan backticks (`) untuk nama agar aman dari error parsing
    return {
      success: true,
      message: `✅ Berhasil! \`${username}\` sekarang adalah admin.`,
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

    // Menggunakan backticks (`) untuk nama agar aman dari error parsing
    return {
      success: true,
      message: `✅ Berhasil! \`${username}\` sekarang adalah member biasa.`,
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

bot.onText(/\/start/, (msg) => {
  sendStartMessage(msg.chat.id, msg.chat.type);
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username;
  const text = msg.text;

  if (!text) return; // Abaikan jika bukan pesan teks (stiker, foto, dll)

  // Pengecekan perintah harus didahulukan
  if (text.startsWith("/")) {
    return;
  }

  // Cek jika pesan dari event 'new_chat_members' atau 'left_chat_member'
  if (msg.new_chat_members || msg.left_chat_member) {
    return;
  }

  // Logika sapaan jika di-reply atau di-mention
  if (botId && (msg.chat.type === "group" || msg.chat.type === "supergroup")) {
    let repliedToBot = false;
    let mentionedBot = false;

    if (msg.reply_to_message && msg.reply_to_message.from.id === botId) {
      repliedToBot = true;
    }

    if (msg.entities) {
      msg.entities.forEach((entity) => {
        if (entity.type === "mention") {
          const mention = text.substring(
            entity.offset,
            entity.offset + entity.length
          );
          if (mention === `@${botUsername}`) {
            mentionedBot = true;
          }
        }
      });
    }

    if (repliedToBot || mentionedBot) {
      // Menggunakan backticks (`) untuk nama agar aman dari error parsing
      const sapaan = [
        "Halo! Ada yang bisa saya bantu?",
        "Ya, saya di sini.",
        `Kenapa, \`${
          username ? "@" + username : msg.from.first_name
        }\`? 😜 Ada apa?`,
        "Siap! Ada perlu apa?",
        "Dipanggil, komandan! 🫡",
      ];
      const randomSapaan = sapaan[Math.floor(Math.random() * sapaan.length)];

      bot.sendMessage(chatId, randomSapaan, {
        reply_to_message_id: msg.message_id,
        parse_mode: "Markdown", // Menambahkan parse_mode
      });
      return; // Hentikan di sini SETELAH sapaan dikirim
    }
  }

  // Menyimpan data member untuk /tagall
  if (
    (msg.chat.type === "group" || msg.chat.type === "supergroup") &&
    username
  ) {
    if (!groupMembers[chatId]) {
      groupMembers[chatId] = {};
    }
    groupMembers[chatId][userId] = username;
  }

  if (msg.reply_to_message) {
    return;
  }
  if (msg.chat.type === "private") {
    return;
  }

  console.log(
    `Pesan dari @${username || msg.from.first_name} di grup ${chatId}: ${text}`
  );
});

// =============================
// PERINTAH ADMIN (Diperbarui untuk promote/demote by tag)
// =============================

bot.onText(/\/promote/, async (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  const text = msg.text;

  if (chatType !== "group" && chatType !== "supergroup") {
    return bot.sendMessage(
      chatId,
      "❌ Perintah ini hanya bisa digunakan di grup!"
    );
  }

  // Cek jika user adalah admin
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

  let targetUser = null;
  let username = null;

  // Prioritas 1: Cek Reply
  if (msg.reply_to_message) {
    targetUser = msg.reply_to_message.from;
    username = targetUser.username
      ? `@${targetUser.username}`
      : targetUser.first_name;
  }
  // Prioritas 2: Cek Mention (Tag)
  else if (msg.entities && msg.entities.length > 0) {
    // Cari 'text_mention' (tag biru tanpa @username)
    const textMention = msg.entities.find((e) => e.type === "text_mention");
    if (textMention) {
      targetUser = textMention.user;
      username = targetUser.first_name;
    } else {
      // Cari '@mention' (tag @username biasa)
      const mention = msg.entities.find((e) => e.type === "mention");
      if (mention) {
        const mentionedUsername = text
          .substring(mention.offset + 1, mention.offset + mention.length)
          .toLowerCase();

        // Cari di database 'groupMembers' kita untuk ID-nya
        const membersInGroup = groupMembers[chatId];
        if (membersInGroup) {
          const targetUserId = Object.keys(membersInGroup).find(
            (id) => membersInGroup[id].toLowerCase() === mentionedUsername
          );

          if (targetUserId) {
            targetUser = { id: targetUserId }; // Kita hanya butuh ID-nya
            username = `@${mentionedUsername}`;
          }
        }
      }
    }
  }

  // Eksekusi jika target ditemukan
  if (targetUser && targetUser.id) {
    const result = await promoteMember(chatId, targetUser.id, username);
    return bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
  } else {
    // Jika tidak ada target, kirim pesan bantuan baru
    return bot.sendMessage(
      chatId,
      "ℹ️ Cara pakai: Reply pesan user ATAU tag user (misal: /promote @username)\n\n*(Catatan: Tag hanya berfungsi jika user sudah pernah chat)*"
    );
  }
});

bot.onText(/\/demote/, async (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  const text = msg.text;

  if (chatType !== "group" && chatType !== "supergroup") {
    return bot.sendMessage(
      chatId,
      "❌ Perintah ini hanya bisa digunakan di grup!"
    );
  }

  // Cek jika user adalah admin
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

  let targetUser = null;
  let username = null;

  // Prioritas 1: Cek Reply
  if (msg.reply_to_message) {
    targetUser = msg.reply_to_message.from;
    username = targetUser.username
      ? `@${targetUser.username}`
      : targetUser.first_name;
  }
  // Prioritas 2: Cek Mention (Tag)
  else if (msg.entities && msg.entities.length > 0) {
    // Cari 'text_mention' (tag biru tanpa @username)
    const textMention = msg.entities.find((e) => e.type === "text_mention");
    if (textMention) {
      targetUser = textMention.user;
      username = targetUser.first_name;
    } else {
      // Cari '@mention' (tag @username biasa)
      const mention = msg.entities.find((e) => e.type === "mention");
      if (mention) {
        const mentionedUsername = text
          .substring(mention.offset + 1, mention.offset + mention.length)
          .toLowerCase();

        // Cari di database 'groupMembers' kita untuk ID-nya
        const membersInGroup = groupMembers[chatId];
        if (membersInGroup) {
          const targetUserId = Object.keys(membersInGroup).find(
            (id) => membersInGroup[id].toLowerCase() === mentionedUsername
          );

          if (targetUserId) {
            targetUser = { id: targetUserId }; // Kita hanya butuh ID-nya
            username = `@${mentionedUsername}`;
          }
        }
      }
    }
  }

  // Eksekusi jika target ditemukan
  if (targetUser && targetUser.id) {
    const result = await demoteMember(chatId, targetUser.id, username);
    return bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
  } else {
    // Jika tidak ada target, kirim pesan bantuan baru
    return bot.sendMessage(
      chatId,
      "ℹ️ Cara pakai: Reply pesan user ATAU tag user (misal: /demote @username)\n\n*(Catatan: Tag hanya berfungsi jika user sudah pernah chat)*"
    );
  }
});

bot.onText(/\/tagall/, async (msg) => {
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
    return bot.sendMessage(chatId, "❌ Gagal mengecek status admin kamu.");
  }

  const members = groupMembers[chatId];
  if (!members || Object.keys(members).length === 0) {
    return bot.sendMessage(
      chatId,
      "🤖 Belum ada member aktif yang tercatat. Biarkan member lain chat dulu agar data tersimpan."
    );
  }

  const customMessage = msg.text.replace("/tagall", "").trim();

  let messageText = "";
  if (customMessage) {
    messageText = `${customMessage}\n\n`;
  } else {
    messageText = "📣 *PANGGIL SEMUA MEMBER AKTIF!*\n\n";
  }

  let userTags = [];
  for (const userId in members) {
    userTags.push(`@${members[userId]}`);
  }

  messageText += userTags.join(" ");

  try {
    await bot.sendMessage(chatId, messageText, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error sending tagall:", error);
    await bot.sendMessage(
      chatId,
      "❌ Gagal mengirim tag. Mungkin daftar member terlalu panjang atau ada error lain."
    );
  }
});

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
// GREETING & MEMBER MANAGEMENT
// =============================

bot.on("new_chat_members", (msg) => {
  const chatId = msg.chat.id;

  msg.new_chat_members.forEach((member) => {
    const name = member.username ? `@${member.username}` : member.first_name;

    // Menggunakan backticks (`) untuk nama agar aman dari error parsing
    const welcomeMessage = `
Selamat datang di grup, \`${name}\`! 👋

Senang kamu bergabung. Jangan lupa baca peraturan grup, ya!
(Jika ada peraturan, hehe)
`;
    // Kirim pesan sapaan
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });

    // (PENINGKATAN FUNGSI TAGALL)
    // Simpan anggota baru ini ke daftar tagall, bahkan jika dia tidak pernah chat
    if (member.username) {
      if (!groupMembers[chatId]) {
        groupMembers[chatId] = {};
      }
      // Simpan username berdasarkan userId untuk menghindari duplikat
      groupMembers[chatId][member.id] = member.username;
      console.log(
        `Anggota baru @${member.username} ditambahkan ke daftar tagall untuk grup ${chatId}.`
      );
    }
  });
});

bot.on("left_chat_member", (msg) => {
  const chatId = msg.chat.id;
  const member = msg.left_chat_member;

  const name = member.username ? `@${member.username}` : member.first_name;

  // Menggunakan backticks (`) untuk nama agar aman dari error parsing
  const goodbyeMessage = `
Yah, \`${name}\` telah meninggalkan grup. 😢
Sampai jumpa lagi di lain waktu!
`;

  bot.sendMessage(chatId, goodbyeMessage, { parse_mode: "Markdown" });

  // (PENINGKATAN FUNGSI TAGALL)
  // Hapus anggota yang keluar dari daftar tagall
  if (groupMembers[chatId] && groupMembers[chatId][member.id]) {
    delete groupMembers[chatId][member.id];
    console.log(`Anggota @${name} dihapus dari daftar tagall grup ${chatId}.`);
  }
});

// =============================
// FUNGSI GAME TEBAK KATA
// =============================

// Fungsi untuk membuat petunjuk (misal: "TELEGRAM" -> "T _ L _ _ R A M")
function createClue(word) {
  // Tampilkan 2 huruf acak + huruf pertama dan terakhir
  const chars = word.split("");
  const clue = chars.map((char, index) => {
    // Selalu tampilkan huruf pertama dan terakhir
    if (index === 0 || index === chars.length - 1) {
      return char;
    }
    // Tampilkan 2 huruf acak di tengah
    if (
      index === Math.floor(chars.length / 3) ||
      index === Math.floor(chars.length / 2)
    ) {
      return char;
    }
    return "_";
  });
  return clue.join(" ");
}

// Perintah: /mulaitebak (Hanya Admin)
bot.onText(/\/mulaitebak/, async (msg) => {
  const chatId = msg.chat.id;

  // 1. Cek jika di grup
  if (msg.chat.type === "private") {
    return bot.sendMessage(chatId, "Game hanya bisa dimainkan di grup!");
  }

  // 2. Cek jika user adalah admin
  try {
    const userMember = await bot.getChatMember(chatId, msg.from.id);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    ) {
      return bot.sendMessage(chatId, "❌ Hanya admin yang bisa memulai game!");
    }
  } catch (error) {
    return bot.sendMessage(chatId, "❌ Gagal mengecek status admin kamu.");
  }

  // 3. Cek jika sudah ada game
  if (activeGames[chatId]) {
    return bot.sendMessage(
      chatId,
      `Masih ada game yang berjalan! 🤨\nPetunjuk: \`${activeGames[chatId].clue}\`\n\nGunakan /stoptebak untuk berhenti.`,
      { parse_mode: "Markdown" }
    );
  }

  // 4. Memulai game
  const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
  const clue = createClue(randomWord);

  activeGames[chatId] = {
    word: randomWord,
    clue: clue,
  };

  bot.sendMessage(
    chatId,
    `
🎮 *GAME TEBAK KATA DIMULAI!* 🎮

Petunjuk: \`${clue}\`
(${randomWord.length} huruf)

Ketik \`/jawab [tebakanmu]\` untuk menjawab!
  `,
    { parse_mode: "Markdown" }
  );
});

// Perintah: /jawab [kata] (Semua member)
bot.onText(/\/jawab(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const game = activeGames[chatId];

  // 1. Cek jika ada game aktif
  if (!game) {
    return bot.sendMessage(
      chatId,
      "Tidak ada game tebak kata yang sedang berjalan. Minta admin untuk /mulaitebak.",
      {
        reply_to_message_id: msg.message_id,
      }
    );
  }

  // 2. Ambil jawaban user
  const userAnswer = match[1].trim().toUpperCase();
  const correctAnswer = game.word;

  // 3. Cek jawaban
  if (userAnswer === correctAnswer) {
    const winnerName = msg.from.username
      ? `@${msg.from.username}`
      : msg.from.first_name;

    bot.sendMessage(
      chatId,
      `
🎉 *BENAR!* 🎉

Selamat kepada \`${winnerName}\`! 🥳
Jawabannya adalah: \`${correctAnswer}\`

Game selesai. Ketik /mulaitebak untuk bermain lagi.
    `,
      { parse_mode: "Markdown" }
    );

    // Hapus game dari daftar aktif
    delete activeGames[chatId];
  } else {
    // Jawaban salah
    bot.sendMessage(chatId, "Masih salah, coba lagi! 🤨", {
      reply_to_message_id: msg.message_id,
    });
  }
});

// Perintah: /stoptebak (Hanya Admin)
bot.onText(/\/stoptebak/, async (msg) => {
  const chatId = msg.chat.id;

  // 1. Cek jika user adalah admin
  try {
    const userMember = await bot.getChatMember(chatId, msg.from.id);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    ) {
      return bot.sendMessage(
        chatId,
        "❌ Hanya admin yang bisa menghentikan game!"
      );
    }
  } catch (error) {
    return bot.sendMessage(chatId, "❌ Gagal mengecek status admin kamu.");
  }

  // 2. Cek jika ada game untuk distop
  const game = activeGames[chatId];
  if (game) {
    const correctAnswer = game.word;
    delete activeGames[chatId]; // Hentikan game
    bot.sendMessage(
      chatId,
      `
🛑 *Game Dihentikan Paksa!* 🛑

Tidak ada yang berhasil menebak.
Jawabannya adalah: \`${correctAnswer}\`
    `,
      { parse_mode: "Markdown" }
    );
  } else {
    bot.sendMessage(chatId, "Tidak ada game yang sedang berjalan.");
  }
});

// =============================
// LOG STARTUP
// =============================
console.log("🤖 ADMIN BOT Sedang berjalan...");
console.log("📋 Commands tersedia:");
console.log("   /promote, /demote, /tagall, /checkbot");
console.log("   /mulaitebak, /stoptebak, /jawab");
console.log("   (Fitur Pasif) Sapaan jika di-mention atau di-reply.");
console.log("   (Fitur Pasif) Sapaan member join/left.");
