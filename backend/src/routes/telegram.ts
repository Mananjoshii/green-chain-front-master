import { Router } from "express";
import { Client } from "@googlemaps/google-maps-services-js";
import type { Env } from "../env.js";
import { getAdminSupabase } from "../supabase/clients.js";
import { processReport } from "../pipeline/processReport.js";
import { sendTelegramMessage, sendTelegramMediaGroup } from "../supabase/telegram_utils.js";

const googleMaps = new Client({});

type ChatDraft = {
  photoFileId?: string;
  location?: { latitude: number; longitude: number };
  reportCreated?: boolean;
  reportId?: string;
  createdAt?: number;
};

type WelcomeState = {
  welcomedAt: number;
};

const chatDrafts = new Map<number, ChatDraft>();
const welcomedChats = new Map<number, WelcomeState>();
const processedUpdateIds = new Map<number, number>();
// tracks updates currently being processed so we don't double-handle the same update concurrently
const processingUpdates = new Map<number, number>();

function rememberProcessedUpdate(updateId: number) {
  processedUpdateIds.set(updateId, Date.now());
  setTimeout(() => processedUpdateIds.delete(updateId), 5 * 60 * 1000);
}

function rememberProcessingUpdate(updateId: number) {
  processingUpdates.set(updateId, Date.now());
  // safety TTL for in-progress markers
  setTimeout(() => processingUpdates.delete(updateId), 5 * 60 * 1000);
}

async function sendWelcomeMessage(botToken: string, chatId: number) {
  const startMsg =
    "🌱 Welcome to NammaWasteBot!\n\n" +
    "Submit waste reports and help clean our city! 🌍\n\n" +
    "Step 1: Send a photo of the waste 📸\n" +
    "Step 2: Share your location 📍\n\n" +
    "Note: Telegram does not allow bots to open your camera directly from a button. " +
    "Tap the attachment icon to send a photo.\n\n" +
    "Our AI will verify the waste and route it to municipal officers.";

  const keyboard = {
    keyboard: [
      [{ text: "📸 Send Photo" }],
      [{ text: "📍 Share Location", request_location: true }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };

  await sendTelegramMessage(botToken, chatId, startMsg, keyboard);
}

export function telegramRouter(env: Env) {
  const router = Router();
  const supabaseAdmin = getAdminSupabase(env);

  // We keep drafts in-memory only (simpler, avoids extra DB ops).

  router.post("/webhook", async (req, res, next) => {
    try {
      // Optional secret token header verification
      const secretHeader = req.get("x-telegram-bot-api-secret-token") || "";
      if (env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
        return res.status(403).json({ error: "invalid webhook secret" });
      }

      const update = req.body;
      console.debug("/telegram/webhook update:", {
        update_id: update?.update_id,
        keys: update ? Object.keys(update) : []
      });

      const updateId = Number(update?.update_id);
      if (Number.isFinite(updateId) && processedUpdateIds.has(updateId)) {
        console.debug("telegram: duplicate update replay ignored (already processed)", { updateId });
        return res.status(200).json({ ok: true, message: "duplicate_update_ignored" });
      }
      if (Number.isFinite(updateId) && processingUpdates.has(updateId)) {
        console.debug("telegram: update already being processed, ignoring concurrent replay", { updateId });
        return res.status(200).json({ ok: true, message: "update_in_progress" });
      }
      // mark as processing so concurrent retries don't trigger another run
      if (Number.isFinite(updateId)) rememberProcessingUpdate(updateId);

      const message = update?.message || update?.channel_post;
      if (!message) return res.status(200).json({ ok: true });

      const chatId = message.chat?.id;
      const text = message.text;
      const location = message.location;
      const photos = message.photo;
      const token = env.TELEGRAM_BOT_TOKEN;

      if (!token) return res.status(500).json({ error: "telegram bot token not configured" });

      if (!chatId) return res.status(200).json({ ok: true });

      const welcomedState = welcomedChats.get(chatId);
      const isFirstChatMessage = !welcomedState;
      if (isFirstChatMessage) {
        welcomedChats.set(chatId, { welcomedAt: Date.now() });
        await sendWelcomeMessage(token, chatId);
      }

      // Handle /start command
      if (text === "/start") {
        chatDrafts.delete(chatId);
        welcomedChats.set(chatId, { welcomedAt: Date.now() });
        await sendWelcomeMessage(token, chatId);
        return res.status(200).json({ ok: true });
      }

      // The photo button is a helper trigger; ask user to attach/capture a photo.
      if (text === "📸 Send Photo") {
        await sendTelegramMessage(
          token,
          chatId,
          "Please send a photo now using the attachment/camera icon 📎."
        );
        return res.status(200).json({ ok: true });
      }

      const draft = chatDrafts.get(chatId) ?? {};

      // If we already created a report for this chat recently, ignore further updates
      if (draft.reportCreated && draft.createdAt && Date.now() - draft.createdAt < 2 * 60 * 1000) {
        console.debug("telegram: recent report already created for chat, ignoring duplicate update", {
          chatId,
          reportId: draft.reportId
        });
        if (Number.isFinite(updateId)) rememberProcessedUpdate(updateId);
        return res.status(200).json({ ok: true, message: "report_already_received" });
      }

      if (Array.isArray(photos) && photos.length > 0) {
        const fileObj = photos[photos.length - 1];
        draft.photoFileId = fileObj.file_id;
      }
      if (location?.latitude && location?.longitude) {
        draft.location = { latitude: location.latitude, longitude: location.longitude };
      }

      chatDrafts.set(chatId, draft);

      console.debug("telegram: updated draft", { chatId, draft });

      if (!draft.photoFileId && !draft.location) {
        await sendTelegramMessage(token, chatId, "Send a photo first 📸, then share location 📍.");
        if (Number.isFinite(updateId)) rememberProcessedUpdate(updateId);
        return res.status(200).json({ ok: true, message: "waiting_for_photo_and_location" });
      }
      if (!draft.photoFileId) {
        await sendTelegramMessage(token, chatId, "✅ Location received. Now send the waste photo 📸.");
        if (Number.isFinite(updateId)) rememberProcessedUpdate(updateId);
        return res.status(200).json({ ok: true, message: "waiting_for_photo" });
      }
      if (!draft.location) {
        await sendTelegramMessage(token, chatId, "✅ Photo received. Now share the location 📍.");
        if (Number.isFinite(updateId)) rememberProcessedUpdate(updateId);
        return res.status(200).json({ ok: true, message: "waiting_for_location" });
      }

      const fileId = draft.photoFileId;
      if (!token) return res.status(500).json({ error: "telegram bot token not configured" });

      // Download file from Telegram and upload to Supabase storage.
      // Attempt upload with a small retry loop to avoid transient network timeouts
      let imageUrl: string | null = null;
      let reverseGeoAddress = "";

      // Reverse geocode if location is present
      if (draft.location && env.GOOGLE_MAPS_API_KEY) {
        try {
          const res = await googleMaps.reverseGeocode({
            params: {
              latlng: { lat: draft.location.latitude, lng: draft.location.longitude },
              key: env.GOOGLE_MAPS_API_KEY
            }
          });
          if (res.data.results && res.data.results.length > 0) {
            reverseGeoAddress = res.data.results[0].formatted_address;
          }
        } catch (err) {
          console.error("Reverse geocoding failed:", err);
        }
      }

      let uploadLastError: any = null;
      const maxUploadAttempts = 3;
      for (let attempt = 1; attempt <= maxUploadAttempts; attempt++) {
        try {
        // Get file path from Telegram
        const getFileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
        const getFileJson: any = await getFileRes.json();
        if (!getFileJson?.ok) throw new Error("telegram getFile failed");
        const filePath = String(getFileJson.result.file_path);
        const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

        const fileResp = await fetch(fileUrl);
        if (!fileResp.ok) throw new Error("failed to download file from telegram");
        const arrayBuf = await fileResp.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        const ext = (filePath.split(".").pop() || "jpg").split("?")[0];
        const objectPath = `telegram/${Date.now()}_${fileId}.${ext}`;

        const contentType = fileResp.headers.get("content-type") || "application/octet-stream";

          const { error: uploadError } = await supabaseAdmin.storage
            .from("report-images")
            .upload(objectPath, buffer, { contentType, upsert: false });
          if (uploadError) throw uploadError;

          const { data: publicUrlData } = supabaseAdmin.storage.from("report-images").getPublicUrl(objectPath);
          imageUrl = publicUrlData.publicUrl;
          uploadLastError = null;
          break;
        } catch (err) {
          uploadLastError = err;
          console.warn(`upload attempt ${attempt} failed`, (err as any)?.message || err);
          // small backoff
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
      if (uploadLastError) {
        console.error("/telegram/webhook upload final error:", uploadLastError);
        if (Number.isFinite(updateId)) processingUpdates.delete(updateId);
        try {
          await sendTelegramMessage(token, chatId, "Sorry — we couldn't upload your photo right now. Please try again in a minute.");
        } catch (e) {
          console.error("failed to notify user about upload failure", e);
        }
        return res.status(200).json({ ok: true, message: "temporary_storage_failure" });
      }
      if (!imageUrl) {
        console.error("/telegram/webhook: imageUrl missing despite no upload error");
        if (Number.isFinite(updateId)) processingUpdates.delete(updateId);
        return res.status(200).json({ ok: true, message: "temporary_storage_failure" });
      }

      // Ensure bot user exists (create/find in auth.users)
      const adminAuth = (supabaseAdmin.auth as any).admin;
      const botEmail = (env.TELEGRAM_BOT_USER_EMAIL?.trim() || "telegram-bot@ecochain.local").toLowerCase();
      let botUserId: string | null = null;

      // Try to create user first (idempotent flow; may fail if already exists).
      const pwd = Math.random().toString(36).slice(2, 10) + "!A1";
      const createRes = await adminAuth.createUser({
        email: botEmail,
        password: pwd,
        email_confirm: true,
        user_metadata: { source: "telegram-bot" }
      });
      if (createRes?.error) {
        // Common when user already exists; we'll lookup below.
        console.warn("telegram bot createUser warning:", createRes.error.message);
      }
      if (createRes?.data?.user?.id) {
        botUserId = createRes.data.user.id;
      }

      // Lookup by email if create did not return a user id.
      if (!botUserId) {
        const listRes = await adminAuth.listUsers({ page: 1, perPage: 200 });
        const users = listRes?.data?.users ?? [];
        const found = users.find((u: any) => (u.email || "").toLowerCase() === botEmail);
        if (found?.id) botUserId = found.id;
      }

      if (!botUserId) {
        throw new Error("Unable to resolve Telegram bot auth user id; set TELEGRAM_BOT_USER_EMAIL to a valid account email");
      }

      // Insert report via admin client (service role) and trigger processing
      const { data: reportData, error: insertErr } = await supabaseAdmin
        .from("reports")
        .insert({
          user_id: botUserId,
          image_url: imageUrl,
          latitude: draft.location.latitude,
          longitude: draft.location.longitude,
          location_address: reverseGeoAddress || message.location_address || "Submitted via Telegram Bot",
          category: "other",
          severity: "medium",
          description: message.caption ?? "Submitted via Telegram",
          status: "pending",
          telegram_chat_id: chatId
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      const newReportId = reportData.id as string;

      // Send confirmation to user
      if (chatId) {
        const confirmMsg =
          "✅ Report received!\n\n" +
          `📋 Report ID: ${newReportId.slice(0, 8)}...\n\n` +
          "🤖 AI is now verifying your waste report:\n" +
          "• Checking image authenticity\n" +
          "• Analyzing waste type & severity\n" +
          "• Routing to municipal officers\n\n" +
          "You'll be notified when resolved. Thanks for helping clean our city! 🌍";
        await sendTelegramMessage(token, chatId, confirmMsg);
      }

      // Mark draft as having produced a report and keep it for a short TTL to avoid duplicate prompts
      draft.reportCreated = true;
      draft.reportId = newReportId;
      draft.createdAt = Date.now();
      chatDrafts.set(chatId, draft);
      if (Number.isFinite(updateId)) rememberProcessedUpdate(updateId);
      // remove in-progress marker
      if (Number.isFinite(updateId)) processingUpdates.delete(updateId);
      // schedule cleanup after TTL
      setTimeout(() => chatDrafts.delete(chatId), 2 * 60 * 1000);

      // Trigger pipeline asynchronously
      setImmediate(async () => {
        try {
          await processReport(env, { reportId: newReportId, requestedByUserId: botUserId!, requestedByRole: "admin" });
        } catch (err) {
          console.error("processReport failed for telegram report:", err);
        }
      });

      return res.status(201).json({ ok: true, report_id: newReportId });
    } catch (err) {
      console.error("/telegram/webhook error:", err);
      next(err);
    }
  });

  return router;
}
