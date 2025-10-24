// =============================
// ADMIN BOT (Full Features - Looping Game FINAL FIX Rev 4)
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

// Info bot
let botUsername = "";
let botId = null;
bot
  .getMe()
  .then((me) => {
    botUsername = me.username;
    botId = me.id;
    console.log(`Info bot: @${botUsername} (ID: ${botId})`);
  })
  .catch((err) => {
    console.error("Kritis: Gagal getMe:", err);
    process.exit(1);
  });

// Variabel data
const groupMembers = {};
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
const activeGames = {}; // { chatId: { word: "X", clue: "X", messageId: 123 } }

// =============================
// Teks /start
// =============================
function sendStartMessage(chatId, chatType) {
  let text = `
🤖 Halo! Saya adalah Bot Admin & Game.

Ketik /bot untuk menu tombol.

*Perintah Admin (Ketik Manual):*
/promote - (Reply/Tag) Promote.
/demote - (Reply/Tag) Demote.
/tagall [pesan] - Mention member aktif.

*Game Tebak Kata:*
Dimulai oleh Admin via /bot atau /mulaitebak.
Game akan *otomatis lanjut* jika jawaban benar.
Jawab dengan *mengetik langsung katanya*.
Gunakan tombol 'Stop Tebak' di bawah petunjuk atau di /bot untuk berhenti.
`;
  if (chatType !== "group" && chatType !== "supergroup")
    text = "🤖 Bot Admin & Game. Tambahkan ke grup.\nKetik /bot di grup.";
  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
}

// =============================
// FUNGSI UTAMA (ADMIN, SAPAAN)
// =============================
async function checkBotAdminRights(chatId) {
  try {
    const botInfo = await bot.getMe();
    const chatMember = await bot.getChatMember(chatId, botInfo.id);
    if (
      chatMember.status !== "administrator" &&
      chatMember.status !== "creator"
    )
      return { success: false, message: "Bot bukan admin!" };
    if (!chatMember.can_promote_members)
      return {
        success: false,
        message: "Bot tdk punya izin 'Add New Admins'.",
      };
    return { success: true };
  } catch (error) {
    console.error("Error check rights:", error);
    return { success: false, message: "Gagal cek hak akses: " + error.message };
  }
}

async function promoteMember(chatId, userId, username) {
  try {
    const botCheck = await checkBotAdminRights(chatId);
    if (!botCheck.success) return { success: false, message: botCheck.message };
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
    return { success: true, message: `✅ Berhasil! \`${username}\` admin.` };
  } catch (error) {
    console.error("Error promoting:", error);
    if (error.response?.body) {
      const msg = error.response.body.description;
      if (msg.includes("RIGHT_FORBIDDEN"))
        return { success: false, message: "❌ Bot tdk punya izin." };
      if (msg.includes("USER_NOT_MUTUAL_CONTACT"))
        return { success: false, message: "❌ User tdk bisa dipromote." };
      return { success: false, message: `❌ Error: ${msg}` };
    }
    return { success: false, message: "❌ Gagal promote: " + error.message };
  }
}

async function demoteMember(chatId, userId, username) {
  try {
    const botCheck = await checkBotAdminRights(chatId);
    if (!botCheck.success) return { success: false, message: botCheck.message };
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
      message: `✅ Berhasil! \`${username}\` member biasa.`,
    };
  } catch (error) {
    console.error("Error demoting:", error);
    if (error.response?.body)
      return {
        success: false,
        message: `❌ Error: ${error.response.body.description}`,
      };
    return { success: false, message: "❌ Gagal demote: " + error.message };
  }
}

bot.onText(/\/start/, (msg) => {
  sendStartMessage(msg.chat.id, msg.chat.type);
});

// =============================
// LISTENER PESAN UTAMA
// =============================
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username;
  const text = msg.text;
  if (!text) return; // Abaikan non-teks

  // 1. Abaikan perintah
  if (text.startsWith("/")) return;
  // 2. Abaikan join/left
  if (msg.new_chat_members || msg.left_chat_member) return;

  // 3. Cek jawaban game langsung
  const currentGame = activeGames[chatId];
  if (
    currentGame &&
    (msg.chat.type === "group" || msg.chat.type === "supergroup")
  ) {
    const userAnswer = text.trim().toUpperCase();
    const correctAnswer = currentGame.word;
    if (userAnswer === correctAnswer) {
      const winnerName = username ? `@${username}` : msg.from.first_name;
      bot
        .sendMessage(
          chatId,
          `🎉 *BENAR!* 🎉\nSelamat \`${winnerName}\`! Jawabannya: \`${correctAnswer}\`\n\nMemulai ronde baru...`,
          { parse_mode: "Markdown" }
        )
        .then(() => {
          startGame(chatId, userId, true);
        }); // true = bypassAdminCheck
      return;
    }
  }

  // 4. Logika sapaan reply/mention
  if (botId && (msg.chat.type === "group" || msg.chat.type === "supergroup")) {
    let repliedToBot =
      msg.reply_to_message && msg.reply_to_message.from.id === botId;
    let mentionedBot =
      msg.entities &&
      msg.entities.some(
        (e) =>
          e.type === "mention" &&
          text.substring(e.offset, e.offset + e.length) === `@${botUsername}`
      );
    if (repliedToBot || mentionedBot) {
      const sapaan = [
        "Halo!",
        "Ya?",
        `Kenapa, \`${username ? "@" + username : msg.from.first_name}\`?`,
        "Siap!",
        "Dipanggil! 🫡",
      ];
      const randomSapaan = sapaan[Math.floor(Math.random() * sapaan.length)];
      bot.sendMessage(chatId, randomSapaan, {
        reply_to_message_id: msg.message_id,
        parse_mode: "Markdown",
      });
      return;
    }
  }

  // 5. Simpan member untuk /tagall
  if (
    (msg.chat.type === "group" || msg.chat.type === "supergroup") &&
    username
  ) {
    if (!groupMembers[chatId]) groupMembers[chatId] = {};
    groupMembers[chatId][userId] = username;
  }
  // 6. Abaikan reply ke user lain & pesan private
  if (msg.reply_to_message || msg.chat.type === "private") return;
  // 7. Log pesan biasa
  console.log(
    `Pesan dari @${
      username || msg.from.first_name
    } (${userId}) di grup ${chatId}: ${text}`
  );
});

// =============================
// PERINTAH ADMIN
// =============================
bot.onText(/\/promote/, async (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  const text = msg.text;
  if (chatType !== "group" && chatType !== "supergroup")
    return bot.sendMessage(chatId, "❌ Hanya di grup!");
  try {
    const userMember = await bot.getChatMember(chatId, msg.from.id);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    )
      return bot.sendMessage(chatId, "❌ Hanya admin!");
  } catch (error) {
    return bot.sendMessage(chatId, "❌ Gagal cek status admin.");
  }
  let targetUser = null;
  let username = null;
  if (msg.reply_to_message) {
    targetUser = msg.reply_to_message.from;
    username = targetUser.username
      ? `@${targetUser.username}`
      : targetUser.first_name;
  } else if (msg.entities?.length > 0) {
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
  if (targetUser?.id) {
    const result = await promoteMember(chatId, targetUser.id, username);
    return bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
  } else {
    return bot.sendMessage(
      chatId,
      "ℹ️ Reply/Tag user (misal: /promote @username)\n*(Tag perlu user pernah chat)*"
    );
  }
});

bot.onText(/\/demote/, async (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  const text = msg.text;
  if (chatType !== "group" && chatType !== "supergroup")
    return bot.sendMessage(chatId, "❌ Hanya di grup!");
  try {
    const userMember = await bot.getChatMember(chatId, msg.from.id);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    )
      return bot.sendMessage(chatId, "❌ Hanya admin!");
  } catch (error) {
    return bot.sendMessage(chatId, "❌ Gagal cek status admin.");
  }
  let targetUser = null;
  let username = null;
  if (msg.reply_to_message) {
    targetUser = msg.reply_to_message.from;
    username = targetUser.username
      ? `@${targetUser.username}`
      : targetUser.first_name;
  } else if (msg.entities?.length > 0) {
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
  if (targetUser?.id) {
    const result = await demoteMember(chatId, targetUser.id, username);
    return bot.sendMessage(chatId, result.message, { parse_mode: "Markdown" });
  } else {
    return bot.sendMessage(
      chatId,
      "ℹ️ Reply/Tag user (misal: /demote @username)\n*(Tag perlu user pernah chat)*"
    );
  }
});

bot.onText(/\/tagall/, async (msg) => {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  if (chatType !== "group" && chatType !== "supergroup")
    return bot.sendMessage(chatId, "❌ Hanya di grup!");
  try {
    const userMember = await bot.getChatMember(chatId, msg.from.id);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    )
      return bot.sendMessage(chatId, "❌ Hanya admin!");
  } catch (error) {
    return bot.sendMessage(chatId, "❌ Gagal cek status admin.");
  }
  const members = groupMembers[chatId];
  if (!members || Object.keys(members).length === 0)
    return bot.sendMessage(chatId, "🤖 Belum ada member aktif.");
  const customMessage = msg.text.replace("/tagall", "").trim();
  let messageText = customMessage
    ? `${customMessage}\n\n`
    : "📣 *PANGGIL SEMUA MEMBER AKTIF!*\n\n";
  let userTags = Object.values(members).map((uname) => `@${uname}`);
  messageText += userTags.join(" ");
  try {
    await bot.sendMessage(chatId, messageText, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error tagall:", error);
    await bot.sendMessage(chatId, "❌ Gagal tag.");
  }
});

// =============================
// PERINTAH /bot MENU TOMBOL (INI YANG HILANG SEBELUMNYA)
// =============================
bot.onText(/\/bot/, (msg) => {
  const chatId = msg.chat.id;
  if (msg.chat.type === "private")
    return bot.sendMessage(chatId, "Menu hanya di grup.");
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🎮 Mulai Tebak Kata", callback_data: "start_game" },
          { text: "🛑 Stop Tebak Kata (Menu)", callback_data: "stop_game" },
        ],
        [
          {
            text: "⬆️ Promote (Ketik @)",
            switch_inline_query_current_chat: "/promote ",
          },
          {
            text: "⬇️ Demote (Ketik @)",
            switch_inline_query_current_chat: "/demote ",
          },
        ],
        [{ text: "📊 Cek Status Bot", callback_data: "check_bot" }],
      ],
    },
  };
  bot.sendMessage(chatId, "Silakan pilih menu:", opts);
});

// =============================
// FUNGSI GAME TEBAK KATA
// =============================

function createClue(word) {
  const chars = word.split("");
  const clue = chars.map((char, index) =>
    index === 0 ||
    index === chars.length - 1 ||
    index === Math.floor(chars.length / 3) ||
    index === Math.floor(chars.length / 2)
      ? char
      : "_"
  );
  return clue.join(" ");
}

async function startGame(
  chatId,
  userId,
  bypassAdminCheck = false,
  fromCallback = false,
  callbackQueryId = null
) {
  if (!bypassAdminCheck) {
    try {
      const userMember = await bot.getChatMember(chatId, userId);
      if (
        userMember.status !== "administrator" &&
        userMember.status !== "creator"
      ) {
        if (fromCallback) {
          bot.answerCallbackQuery(callbackQueryId, {
            text: "Hanya admin!",
            show_alert: true,
          });
          return;
        }
        return bot.sendMessage(chatId, "❌ Hanya admin!");
      }
    } catch (error) {
      if (fromCallback) {
        bot.answerCallbackQuery(callbackQueryId, {
          text: "Gagal cek admin.",
          show_alert: true,
        });
        return;
      }
      return bot.sendMessage(chatId, "❌ Gagal cek admin.");
    }
  }
  if (activeGames[chatId] && (fromCallback || arguments.length <= 3)) {
    if (fromCallback)
      bot.answerCallbackQuery(callbackQueryId, {
        text: "Game sudah jalan!",
        show_alert: false,
      });
    else
      bot.sendMessage(
        chatId,
        `Game berjalan! \`${activeGames[chatId].clue}\`\nPakai tombol Stop.`,
        { parse_mode: "Markdown" }
      );
    return;
  }

  const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
  const clue = createClue(randomWord);
  const gameOpts = {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🛑 Stop Tebak", callback_data: "stop_game_loop" }],
      ],
    },
  };

  try {
    const sentMessage = await bot.sendMessage(
      chatId,
      `🎮 *GAME DIMULAI!* 🎮\nPetunjuk: \`${clue}\` (${randomWord.length} huruf)\n*Ketik langsung jawabannya*!`,
      gameOpts
    );
    activeGames[chatId] = {
      word: randomWord,
      clue: clue,
      messageId: sentMessage.message_id,
    };
    console.log(
      `[Game Start] Chat: ${chatId}, Clue MsgID: ${sentMessage.message_id}, Word: ${randomWord}`
    );
  } catch (error) {
    console.error("Gagal start game:", error);
    bot.sendMessage(chatId, "❌ Gagal mulai game.");
    delete activeGames[chatId];
  }
}

async function stopGame(
  chatId,
  userId,
  fromCallback = false,
  callbackQueryId = null
) {
  try {
    const userMember = await bot.getChatMember(chatId, userId);
    if (
      userMember.status !== "administrator" &&
      userMember.status !== "creator"
    ) {
      if (fromCallback) {
        bot.answerCallbackQuery(callbackQueryId, {
          text: "Hanya admin!",
          show_alert: true,
        });
        return;
      }
      return bot.sendMessage(chatId, "❌ Hanya admin!");
    }
  } catch (error) {
    if (fromCallback) {
      bot.answerCallbackQuery(callbackQueryId, {
        text: "Gagal cek admin.",
        show_alert: true,
      });
      return;
    }
    return bot.sendMessage(chatId, "❌ Gagal cek admin.");
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
    if (fromCallback) {
      bot.answerCallbackQuery(callbackQueryId, {
        text: "Tidak ada game.",
        show_alert: false,
      });
      return;
    }
    bot.sendMessage(chatId, "Tidak ada game berjalan.");
  }
}

// Perintah: /mulaitebak
bot.onText(/\/mulaitebak/, async (msg) => {
  if (msg.chat.type === "private")
    return bot.sendMessage(msg.chat.id, "Game hanya di grup!");
  startGame(msg.chat.id, msg.from.id); // Panggil tanpa bypass
});

// Perintah: /jawab [kata]
bot.onText(/\/jawab(.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const game = activeGames[chatId];
  if (!game)
    return bot.sendMessage(chatId, "Tidak ada game. Minta admin /mulaitebak.", {
      reply_to_message_id: msg.message_id,
    });
  const userAnswer = match[1].trim().toUpperCase();
  const correctAnswer = game.word;
  if (userAnswer === correctAnswer) {
    const winnerName = msg.from.username
      ? `@${msg.from.username}`
      : msg.from.first_name;
    bot
      .sendMessage(
        chatId,
        `🎉 *BENAR!* 🎉\nSelamat \`${winnerName}\`! Jawabannya: \`${correctAnswer}\`\n\nMemulai ronde baru...`,
        { parse_mode: "Markdown" }
      )
      .then(() => {
        startGame(chatId, msg.from.id, true);
      }); // true = bypassAdminCheck
  } else {
    bot.sendMessage(chatId, "Masih salah! 🤨", {
      reply_to_message_id: msg.message_id,
    });
  }
});

// Perintah: /stoptebak
bot.onText(/\/stoptebak/, async (msg) => {
  if (msg.chat.type === "private") return;
  stopGame(msg.chat.id, msg.from.id);
});

// =============================
// FUNGSI CHECK BOT
// =============================
async function checkBotStatus(chatId) {
  try {
    const botInfo = await bot.getMe();
    const chatMember = await bot.getChatMember(chatId, botInfo.id);
    let statusMsg = `🤖 *Status Bot:*\n\n👤 @${botInfo.username}\n📊 ${chatMember.status}\n\n`;
    if (chatMember.status === "administrator") {
      statusMsg += `*Hak Akses:*\n`;
      statusMsg += `${chatMember.can_manage_chat ? "✅" : "❌"} Manage Chat\n${
        chatMember.can_delete_messages ? "✅" : "❌"
      } Delete Msgs\n${
        chatMember.can_restrict_members ? "✅" : "❌"
      } Ban Users\n${
        chatMember.can_promote_members ? "✅" : "❌"
      } Add Admins ⭐\n${
        chatMember.can_change_info ? "✅" : "❌"
      } Change Info\n${
        chatMember.can_invite_users ? "✅" : "❌"
      } Invite Users\n${chatMember.can_pin_messages ? "✅" : "❌"} Pin Msgs\n`;
      statusMsg += !chatMember.can_promote_members
        ? `\n⚠️ Bot tdk bisa promote/demote!`
        : `\n✅ Siap promote/demote!`;
    } else if (chatMember.status === "creator") statusMsg += `👑 Creator grup.`;
    else statusMsg += `❌ Bot bukan admin!`;
    bot.sendMessage(chatId, statusMsg, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Error check bot:", error);
    bot.sendMessage(chatId, "❌ Gagal cek status: " + error.message);
  }
}
bot.onText(/\/checkbot/, async (msg) => {
  if (msg.chat.type === "private")
    return bot.sendMessage(msg.chat.id, "Hanya di grup.");
  checkBotStatus(msg.chat.id);
});

// =============================
// GREETING & MEMBER MANAGEMENT
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
      console.log(`Anggota @${member.username} ditambah ke tagall ${chatId}.`);
    }
  });
});
bot.on("left_chat_member", (msg) => {
  const chatId = msg.chat.id;
  const member = msg.left_chat_member;
  const name = member.username ? `@${member.username}` : member.first_name;
  const goodbyeMessage = `Yah, \`${name}\` keluar. 😢`;
  bot.sendMessage(chatId, goodbyeMessage, { parse_mode: "Markdown" });
  if (groupMembers[chatId]?.[member.id]) {
    delete groupMembers[chatId][member.id];
    console.log(`Anggota @${name} dihapus dari tagall ${chatId}.`);
  }
});

// =============================
// HANDLER TOMBOL INLINE
// =============================
bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id;
  let shouldAnswer = true;
  switch (data) {
    case "start_game":
      await startGame(chatId, userId, false, true, callbackQuery.id);
      shouldAnswer = false;
      break; // Panggil DENGAN cek admin
    case "stop_game":
      await stopGame(chatId, userId, true, callbackQuery.id);
      shouldAnswer = false;
      break;
    case "stop_game_loop":
      await stopGame(chatId, userId, true, callbackQuery.id);
      shouldAnswer = false;
      break;
    case "check_bot":
      checkBotStatus(chatId);
      break;
    default:
      console.log("Callback data tdk dikenal:", data);
  }
  if (shouldAnswer) bot.answerCallbackQuery(callbackQuery.id);
});

// =============================
// LOG STARTUP
// =============================
console.log("🤖 ADMIN BOT Sedang berjalan...");
console.log("📋 Commands tersedia:");
console.log("   /bot - Menu tombol");
console.log("   /promote, /demote, /tagall (ketik)");
console.log("   /mulaitebak, /stoptebak, /jawab");
console.log("   (Pasif) Sapaan mention/reply.");
console.log("   (Pasif) Sapaan join/left.");
console.log("   (Pasif) Game Tebak Kata Looping Otomatis.");
