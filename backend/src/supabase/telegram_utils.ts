import type { Env } from "../env.js";

export async function sendTelegramMessage(botToken: string | undefined, chatId: number | null, text: string, replyMarkup?: unknown) {
  if (!botToken || !chatId) return;
  try {
    const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}

export async function sendTelegramPhoto(botToken: string | undefined, chatId: number | null, photoUrl: string, caption?: string) {
  if (!botToken || !chatId || !photoUrl) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: "HTML"
      })
    });
  } catch (err) {
    console.error("Failed to send Telegram photo:", err);
  }
}

export async function sendTelegramMediaGroup(botToken: string | undefined, chatId: number | null, media: { type: 'photo', media: string, caption?: string }[]) {
  if (!botToken || !chatId || !media || media.length === 0) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        media
      })
    });
  } catch (err) {
    console.error("Failed to send Telegram media group:", err);
  }
}
