import type { Env } from "../env.js";

export async function sendTelegramMessage(botToken: string | undefined, chatId: number | null, text: string, replyMarkup?: unknown) {
  if (!botToken || !chatId) return;
  try {
    const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
    if (replyMarkup) body.reply_markup = replyMarkup;
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error("Telegram API error sending message:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return;
    }

    const result = await response.json();
    if (!result.ok) {
      console.error("Telegram message request failed:", {
        ok: result.ok,
        error_code: result.error_code,
        description: result.description
      });
    }
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}

export async function sendTelegramPhoto(botToken: string | undefined, chatId: number | null, photoUrl: string, caption?: string) {
  if (!botToken || !chatId || !photoUrl) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: "HTML"
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error("Telegram API error sending photo:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return;
    }

    const result = await response.json();
    if (!result.ok) {
      console.error("Telegram photo request failed:", {
        ok: result.ok,
        error_code: result.error_code,
        description: result.description
      });
    }
  } catch (err) {
    console.error("Failed to send Telegram photo:", err);
  }
}

export async function sendTelegramMediaGroup(botToken: string | undefined, chatId: number | null, media: { type: 'photo', media: string, caption?: string, parse_mode?: string }[]) {
  if (!botToken || !chatId || !media || media.length === 0) return;
  try {
    // Ensure parse_mode is set for all items that have captions
    const preparedMedia = media.map((item) => ({
      ...item,
      parse_mode: item.parse_mode || (item.caption ? 'HTML' : undefined)
    }));

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        media: preparedMedia
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error("Telegram API error sending media group:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      return;
    }

    const result = await response.json();
    if (!result.ok) {
      console.error("Telegram media group request failed:", {
        ok: result.ok,
        error_code: result.error_code,
        description: result.description
      });
    }
  } catch (err) {
    console.error("Failed to send Telegram media group:", err);
  }
}
