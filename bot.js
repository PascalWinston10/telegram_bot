// =============================
// ADMIN BOT (Full Features - FINAL FIX with Buttons)
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
// Teks /start (Diperbarui untuk promote/demote by tag & /bot)
// =============================
function sendStartMessage(chatId, chatType) {
  let text = `
🤖 Halo! Saya adalah Bot Admin & Game.

Ketik /bot untuk menampilkan menu tombol.

*Perintah Admin (Ketik Manual):*
/promote - (Reply/Tag) Promote jadi admin.
/demote - (Reply/Tag) Demote admin.
/tagall [pesan] - Mention semua member aktif.

*Perintah Game (Ketik Manual):*
/jawab [kata] - Untuk menjawab tebak kata.
`;

  if (chatType !== "group" && chatType !== "supergroup") {
    text =
      "🤖 Halo! Saya adalah bot admin & game. Tambahkan saya ke grup untuk menggunakan semua fitur.\n\nKetik /bot di grup untuk menu.";
  }

  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

// =============================
// FUNGSI UTAMA (ADMIN, SAPAAN, DLL - Tidak Berubah)
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

  if (!text) return; // Abaikan jika bukan pesan teks

  // Pengecekan perintah harus didahulukan
  if (text.startsWith("/")) {
    return;
  }

  // Cek event join/left
  if (msg.new_chat_members || msg.left_chat_member) {
    return;
  }

  // Logika sapaan reply/mention
  if (botId && (msg.chat.type === "group" || msg.chat.type === "supergroup")) {
    let repliedToBot =
      msg.reply_to_message && msg.reply_to_message.from.id === botId;
    let mentionedBot = false;

    if (msg.entities) {
      mentionedBot = msg.entities.some(
        (entity) =>
          entity.type === "mention" &&
          text.substring(entity.offset, entity.offset + entity.length) ===
            `@${botUsername}`
      );
    }

    if (repliedToBot || mentionedBot) {
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
        parse_mode: "Markdown",
      });
      return;
    }
  }

  // Simpan data member untuk /tagall
  if (
    (msg.chat.type === "group" || msg.chat.type === "supergroup") &&
    username
  ) {
    if (!groupMembers[chatId]) {
      groupMembers[chatId] = {};
    }
    groupMembers[chatId][userId] = username;
  }

  // Abaikan reply ke user lain & pesan private
  if (msg.reply_to_message || msg.chat.type === "private") {
    return;
  }

  console.log(
    `Pesan dari @${username || msg.from.first_name} di grup ${chatId}: ${text}`
  );
});

// =============================
// PERINTAH ADMIN (Diperbarui untuk promote/demote by tag - Tidak Berubah)
// =============================

bot.onText(/\/promote/, async (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  const text = msg.text;
  if (chatType !== "group" && chatType !== "supergroup")
    return bot.sendMessage(
      chatId,
      "❌ Perintah ini hanya bisa digunakan di grup!"
    );

  try {
    const userMember = await bot.getChatMember(chatId, msg.from.id);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    )
      return bot.sendMessage(
        chatId,
        "❌ Hanya admin yang bisa menggunakan perintah ini!"
      );
  } catch (error) {
    return bot.sendMessage(chatId, "❌ Gagal mengecek status admin kamu.");
  }

  let targetUser = null;
  let username = null;
  if (msg.reply_to_message) {
    targetUser = msg.reply_to_message.from;
    username = targetUser.username
      ? `@${targetUser.username}`
      : targetUser.first_name;
  } else if (msg.entities && msg.entities.length > 0) {
    const textMention = msg.entities.find((e) => e.type === "text_mention");
    if (textMention) {
      targetUser = textMention.user;
      username = targetUser.first_name;
    } else {
      const mention = msg.entities.find((e) => e.type === "mention");
      if (mention) {
        const mentionedUsername = text
          .substring(mention.offset + 1, mention.offset + mention.length)
          .toLowerCase();
        const membersInGroup = groupMembers[chatId];
        if (membersInGroup) {
          const targetUserId = Object.keys(membersInGroup).find(
            (id) => membersInGroup[id].toLowerCase() === mentionedUsername
          );
          if (targetUserId) {
            targetUser = { id: targetUserId };
            username = `@${mentionedUsername}`;
          }
        }
      }
    }
  }

  if (targetUser && targetUser.id) {
    const result = await promoteMember(chatId, targetUser.id, username);
    return bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
  } else {
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
  if (chatType !== "group" && chatType !== "supergroup")
    return bot.sendMessage(
      chatId,
      "❌ Perintah ini hanya bisa digunakan di grup!"
    );

  try {
    const userMember = await bot.getChatMember(chatId, msg.from.id);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    )
      return bot.sendMessage(
        chatId,
        "❌ Hanya admin yang bisa menggunakan perintah ini!"
      );
  } catch (error) {
    return bot.sendMessage(chatId, "❌ Gagal mengecek status admin kamu.");
  }

  let targetUser = null;
  let username = null;
  if (msg.reply_to_message) {
    targetUser = msg.reply_to_message.from;
    username = targetUser.username
      ? `@${targetUser.username}`
      : targetUser.first_name;
  } else if (msg.entities && msg.entities.length > 0) {
    const textMention = msg.entities.find((e) => e.type === "text_mention");
    if (textMention) {
      targetUser = textMention.user;
      username = targetUser.first_name;
    } else {
      const mention = msg.entities.find((e) => e.type === "mention");
      if (mention) {
        const mentionedUsername = text
          .substring(mention.offset + 1, mention.offset + mention.length)
          .toLowerCase();
        const membersInGroup = groupMembers[chatId];
        if (membersInGroup) {
          const targetUserId = Object.keys(membersInGroup).find(
            (id) => membersInGroup[id].toLowerCase() === mentionedUsername
          );
          if (targetUserId) {
            targetUser = { id: targetUserId };
            username = `@${mentionedUsername}`;
          }
        }
      }
    }
  }

  if (targetUser && targetUser.id) {
    const result = await demoteMember(chatId, targetUser.id, username);
    return bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
  } else {
    return bot.sendMessage(
      chatId,
      "ℹ️ Cara pakai: Reply pesan user ATAU tag user (misal: /demote @username)\n\n*(Catatan: Tag hanya berfungsi jika user sudah pernah chat)*"
    );
  }
});

bot.onText(/\/tagall/, async (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  if (chatType !== "group" && chatType !== "supergroup")
    return bot.sendMessage(
      chatId,
      "❌ Perintah ini hanya bisa digunakan di grup!"
    );

  try {
    const userMember = await bot.getChatMember(chatId, msg.from.id);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    )
      return bot.sendMessage(
        chatId,
        "❌ Hanya admin yang bisa menggunakan perintah ini!"
      );
  } catch (error) {
    return bot.sendMessage(chatId, "❌ Gagal mengecek status admin kamu.");
  }

  const members = groupMembers[chatId];
  if (!members || Object.keys(members).length === 0)
    return bot.sendMessage(chatId, "🤖 Belum ada member aktif yang tercatat.");

  const customMessage = msg.text.replace("/tagall", "").trim();
  let messageText = customMessage
    ? `${customMessage}\n\n`
    : "📣 *PANGGIL SEMUA MEMBER AKTIF!*\n\n";
  let userTags = Object.values(members).map((uname) => `@${uname}`);
  messageText += userTags.join(" ");

  try {
    await bot.sendMessage(chatId, messageText, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error sending tagall:", error);
    await bot.sendMessage(
      chatId,
      "❌ Gagal mengirim tag. Mungkin terlalu panjang."
    );
  }
});

// =============================
// (TAMBAHAN BARU) PERINTAH /bot UNTUK MENU TOMBOL
// =============================
bot.onText(/\/bot/, (msg) => {
  const chatId = msg.chat.id;

  // Hanya berfungsi di grup
  if (msg.chat.type === "private") {
    return bot.sendMessage(chatId, "Menu ini hanya tersedia di grup.");
  }

  const opts = {
    reply_markup: {
      inline_keyboard: [
        [
          // Baris 1
          { text: "🎮 Mulai Tebak Kata", callback_data: "start_game" },
          { text: "🛑 Stop Tebak Kata", callback_data: "stop_game" },
        ],
        [
          // Baris 2
          { text: "📊 Cek Status Bot", callback_data: "check_bot" },
        ],
      ],
    },
  };

  bot.sendMessage(chatId, "Silakan pilih menu:", opts);
});

// =============================
// FUNGSI GAME TEBAK KATA (Dimodifikasi sedikit untuk callback)
// =============================

function createClue(word) {
  const chars = word.split("");
  const clue = chars.map((char, index) => {
    if (
      index === 0 ||
      index === chars.length - 1 ||
      index === Math.floor(chars.length / 3) ||
      index === Math.floor(chars.length / 2)
    ) {
      return char;
    }
    return "_";
  });
  return clue.join(" ");
}

// Fungsi internal untuk memulai game (dipanggil oleh /mulaitebak & callback)
async function startGame(chatId, userId) {
  // Cek jika user adalah admin
  try {
    const userMember = await bot.getChatMember(chatId, userId);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    ) {
      return bot.sendMessage(chatId, "❌ Hanya admin yang bisa memulai game!");
    }
  } catch (error) {
    return bot.sendMessage(chatId, "❌ Gagal mengecek status admin kamu.");
  }

  if (activeGames[chatId]) {
    return bot.sendMessage(
      chatId,
      `Masih ada game berjalan! \`${activeGames[chatId].clue}\`\nPakai /stoptebak atau tombol Stop.`,
      { parse_mode: "Markdown" }
    );
  }

  const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
  const clue = createClue(randomWord);
  activeGames[chatId] = { word: randomWord, clue: clue };

  bot.sendMessage(
    chatId,
    `🎮 *GAME DIMULAI!* 🎮\nPetunjuk: \`${clue}\` (${randomWord.length} huruf)\nKetik \`/jawab [tebakanmu]\``,
    { parse_mode: "Markdown" }
  );
}

// Fungsi internal untuk menghentikan game (dipanggil oleh /stoptebak & callback)
async function stopGame(chatId, userId) {
  // Cek jika user adalah admin
  try {
    const userMember = await bot.getChatMember(chatId, userId);
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

  const game = activeGames[chatId];
  if (game) {
    const correctAnswer = game.word;
    delete activeGames[chatId];
    bot.sendMessage(
      chatId,
      `🛑 *Game Dihentikan!* 🛑\nJawabannya: \`${correctAnswer}\``,
      { parse_mode: "Markdown" }
    );
  } else {
    bot.sendMessage(chatId, "Tidak ada game yang sedang berjalan.");
  }
}

// Perintah: /mulaitebak (Hanya memanggil fungsi internal)
bot.onText(/\/mulaitebak/, async (msg) => {
  if (msg.chat.type === "private")
    return bot.sendMessage(msg.chat.id, "Game hanya di grup!");
  startGame(msg.chat.id, msg.from.id);
});

// Perintah: /jawab [kata] (Tidak berubah)
bot.onText(/\/jawab(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const game = activeGames[chatId];
  if (!game)
    return bot.sendMessage(
      chatId,
      "Tidak ada game berjalan. Minta admin /mulaitebak.",
      { reply_to_message_id: msg.message_id }
    );

  const userAnswer = match[1].trim().toUpperCase();
  const correctAnswer = game.word;
  if (userAnswer === correctAnswer) {
    const winnerName = msg.from.username
      ? `@${msg.from.username}`
      : msg.from.first_name;
    bot.sendMessage(
      chatId,
      `🎉 *BENAR!* 🎉\nSelamat \`${winnerName}\`! 🥳\nJawaban: \`${correctAnswer}\`\nKetik /mulaitebak lagi.`,
      { parse_mode: "Markdown" }
    );
    delete activeGames[chatId];
  } else {
    bot.sendMessage(chatId, "Masih salah! 🤨", {
      reply_to_message_id: msg.message_id,
    });
  }
});

// Perintah: /stoptebak (Hanya memanggil fungsi internal)
bot.onText(/\/stoptebak/, async (msg) => {
  if (msg.chat.type === "private") return; // Abaikan di private
  stopGame(msg.chat.id, msg.from.id);
});

// =============================
// FUNGSI CHECK BOT (Dimodifikasi sedikit untuk callback)
// =============================

// Fungsi internal untuk cek bot (dipanggil oleh /checkbot & callback)
async function checkBotStatus(chatId) {
  try {
    const botInfo = await bot.getMe();
    const chatMember = await bot.getChatMember(chatId, botInfo.id);
    let statusMsg = `🤖 *Status Bot:*\n\n👤 Username: @${botInfo.username}\n📊 Status: ${chatMember.status}\n\n`;

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
      statusMsg += !chatMember.can_promote_members
        ? `\n⚠️ *PERHATIAN:* Bot tidak bisa promote/demote!`
        : `\n✅ Bot siap promote/demote!`;
    } else if (chatMember.status === "creator") {
      statusMsg += `👑 Bot adalah creator grup.`;
    } else {
      statusMsg += `❌ Bot bukan admin!`;
    }
    bot.sendMessage(chatId, statusMsg, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error checking bot status:", error);
    bot.sendMessage(chatId, "❌ Gagal mengecek status bot: " + error.message);
  }
}

// Perintah: /checkbot (Hanya memanggil fungsi internal)
bot.onText(/\/checkbot/, async (msg) => {
  if (msg.chat.type === "private")
    return bot.sendMessage(msg.chat.id, "Perintah ini hanya di grup.");
  checkBotStatus(msg.chat.id);
});

// =============================
// GREETING & MEMBER MANAGEMENT (Tidak Berubah)
// =============================

bot.on("new_chat_members", (msg) => {
  const chatId = msg.chat.id;
  msg.new_chat_members.forEach((member) => {
    const name = member.username ? `@${member.username}` : member.first_name;
    const welcomeMessage = `Selamat datang \`${name}\`! 👋`;
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: "Markdown" });
    if (member.username) {
      if (!groupMembers[chatId]) groupMembers[chatId] = {};
      groupMembers[chatId][member.id] = member.username;
      console.log(
        `Anggota baru @${member.username} ditambahkan ke tagall grup ${chatId}.`
      );
    }
  });
});

bot.on("left_chat_member", (msg) => {
  const chatId = msg.chat.id;
  const member = msg.left_chat_member;
  const name = member.username ? `@${member.username}` : member.first_name;
  const goodbyeMessage = `Yah, \`${name}\` telah keluar. 😢`;
  bot.sendMessage(chatId, goodbyeMessage, { parse_mode: "Markdown" });
  if (groupMembers[chatId] && groupMembers[chatId][member.id]) {
    delete groupMembers[chatId][member.id];
    console.log(`Anggota @${name} dihapus dari tagall grup ${chatId}.`);
  }
});

// =============================
// (TAMBAHAN BARU) HANDLER UNTUK TOMBOL INLINE KEYBOARD
// =============================
bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data; // Ini adalah 'callback_data' dari tombol
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id; // ID user yang menekan tombol

  // 1. Jawab callback query agar tombol berhenti loading
  bot.answerCallbackQuery(callbackQuery.id);

  // 2. Proses berdasarkan data tombol yang ditekan
  switch (data) {
    case "start_game":
      // Panggil fungsi internal startGame
      startGame(chatId, userId);
      break;
    case "stop_game":
      // Panggil fungsi internal stopGame
      stopGame(chatId, userId);
      break;
    case "check_bot":
      // Panggil fungsi internal checkBotStatus
      checkBotStatus(chatId);
      break;
    default:
      // Jika ada tombol lain di masa depan
      console.log("Callback data tidak dikenal:", data);
  }
});

// =============================
// LOG STARTUP
// =============================
console.log("🤖 ADMIN BOT Sedang berjalan...");
console.log("📋 Commands tersedia:");
console.log("   /bot - Tampilkan menu tombol");
console.log("   /promote, /demote, /tagall (ketik manual)");
console.log("   /mulaitebak, /stoptebak, /jawab (bisa via tombol / ketik)");
console.log("   (Fitur Pasif) Sapaan jika di-mention atau di-reply.");
console.log("   (Fitur Pasif) Sapaan member join/left.");
