import { Router } from "express";
import { z } from "zod";
import multer from "multer";

import type { Env } from "../env.js";
import { getAdminSupabase } from "../supabase/clients.js";
import { requireMunicipal } from "../middleware/requireRole.js";
import { sendTelegramMessage } from "../supabase/telegram_utils.js";

export function municipalRouter(env: Env) {
  const router = Router();
  const supabaseAdmin = getAdminSupabase(env);

  router.get("/reports", requireMunicipal, async (req, res, next) => {
    try {
      const Query = z.object({ status: z.string().optional() });
      const { status } = Query.parse(req.query);

      let q = supabaseAdmin.from("reports").select("*").order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);

      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json({ reports: data ?? [] });
    } catch (err) {
      next(err);
    }
  });

  router.post("/reports/:id/assign", requireMunicipal, async (req, res, next) => {
    try {
      const Params = z.object({ id: z.string().min(1) });
      const Body = z.object({
        assigned_to: z.string().min(1),
        status: z.string().optional()
      });
      const { id } = Params.parse(req.params);
      const body = Body.parse(req.body);

      const update: Record<string, unknown> = {
        assigned_to: body.assigned_to
      };
      if (body.status) update.status = body.status;

      const { data, error } = await supabaseAdmin.from("reports").update(update).eq("id", id).select("*").single();
      if (error) throw error;
      return res.status(200).json({ report: data });
    } catch (err) {
      next(err);
    }
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  router.post("/reports/:id/submit-resolution", requireMunicipal, upload.single("resolution_image"), async (req, res, next) => {
    try {
      const { id } = req.params;
      const { officer_notes } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "resolution_image is required" });
      }

      const { data: report, error } = await supabaseAdmin
        .from("reports")
        .select("id, status, verification_status")
        .eq("id", id)
        .single();

      if (error || !report) return res.status(404).json({ error: "Report not found" });

      if (!["in_progress", "assigned"].includes(report.status)) {
        return res.status(422).json({
          error: `Cannot submit resolution for a report with status: ${report.status}`,
        });
      }

      const fileName = `resolutions/${id}/${Date.now()}_${file.originalname}`;
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from("report-images")
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (uploadError) {
        return res.status(500).json({ error: "Image upload failed", details: uploadError.message });
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("report-images")
        .getPublicUrl(fileName);

      const resolutionImageUrl = publicUrlData.publicUrl;

      await supabaseAdmin.from("reports").update({
        resolution_image_url: resolutionImageUrl,
        resolution_image_path: fileName,
        resolution_submitted_at: new Date().toISOString(),
        resolution_submitted_by: req.user?.id,
        status: "pending_verification",
        verification_status: "pending",
      }).eq("id", id);

      await supabaseAdmin.from("report_events").insert({
        report_id: id,
        agent_type: "resolution_photo_submitted",
        metadata: { officer_notes, officer_id: req.user?.id },
      });

      // Trigger verification agent asynchronously
      setImmediate(async () => {
        try {
          const { runResolutionVerificationAgent } = await import("../pipeline/stages/resolutionVerification.js");
          await runResolutionVerificationAgent(env, id);
        } catch (err) {
          console.error("Resolution verification agent failed:", err);
        }
      });

      return res.status(202).json({
        status: "pending_verification",
        message: "Resolution photo submitted. AI verification in progress.",
        report_id: id,
      });
    } catch (err) {
      next(err);
    }
  });

  // Keep the old resolve endpoint for fallback or manual override without verification, but remove token minting
  router.post("/reports/:id/resolve", requireMunicipal, async (req, res, next) => {
    try {
      const Params = z.object({ id: z.string().min(1) });
      const { id } = Params.parse(req.params);

      const { data: report, error: fetchError } = await supabaseAdmin.from("reports").select("*").eq("id", id).single();
      if (fetchError) throw fetchError;

      if (report.status === "rejected") {
        return res.status(400).json({ error: "Cannot resolve a rejected report" });
      }

      const { error: updateError } = await supabaseAdmin
        .from("reports")
        .update({ status: "resolved" })
        .eq("id", id);
      if (updateError) throw updateError;

      // After marking resolved, attempt to notify original reporter via Telegram if we have a chat id
      try {
        const { data: updatedReport, error: fetched } = await supabaseAdmin.from("reports").select("id, telegram_chat_id, image_url, location_address").eq("id", id).single();
        if (!fetched && updatedReport && updatedReport.telegram_chat_id) {
          const chatId = Number(updatedReport.telegram_chat_id);
          const botToken = env.TELEGRAM_BOT_TOKEN;
          const shortId = (updatedReport.id || "").toString().slice(0, 8);
          const message = `✅ Good news — your report ${shortId} has been marked resolved. Thank you for reporting!` + (updatedReport.location_address ? `\n\nLocation: ${updatedReport.location_address}` : "");
          await sendTelegramMessage(botToken, chatId, message);
        }
      } catch (notifyErr) {
        console.error("Failed to notify reporter about resolution:", notifyErr);
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

