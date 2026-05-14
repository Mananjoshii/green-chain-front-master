import type { Env } from "../env.js";

export async function sendTelegramMessage(botToken: string | undefined, chatId: number | null, text: string, replyMarkup?: unknown) {
  if (!botToken || !chatId) return;
  try {
    const body: any = { chat_id: chatId, text };
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
