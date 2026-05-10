import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { Env } from "../env.js";
import { getAdminSupabase } from "../supabase/clients.js";
import { processReport } from "../pipeline/processReport.js";
import { getStructuredJson } from "../ai/openaiCompatible.js";
import { requireRoleAtLeastCitizen } from "../middleware/requireRole.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

export function reportsRouter(env: Env) {
  const router = Router();
  const supabaseAdmin = getAdminSupabase(env);

  router.post("/verify-image", requireRoleAtLeastCitizen, async (req, res, next) => {
    try {
      const Body = z.object({ imageUrl: z.string().url() });
      const { imageUrl } = Body.parse(req.body);

      const result = await getStructuredJson(env, {
        model: env.AI_VISION_MODEL,
        schema: z.object({
          is_waste: z.boolean(),
          reason: z.string().optional()
        }),
        system: "You are a pre-verification agent for EcoChain. Your task is to look at an image and determine if it contains ANY form of waste, garbage, trash, litter, or a messy environment that needs cleaning. If the image is completely irrelevant (like a clean room, a selfie, a cat, a screenshot, etc.) and contains NO waste, return is_waste: false and provide a reason. If there is ANY waste, return is_waste: true. Also check if it's clearly a fake/stock photo, if so, return is_waste: false and reason: 'fake/stock photo'.",
        user: [{ type: "image_url", image_url: { url: imageUrl } }]
      });

      return res.status(200).json(result);
    } catch (err) {
      console.error(`[API] /reports/verify-image failed with error:`, err);
      next(err);
    }
  });


  router.post("/upload", requireRoleAtLeastCitizen, upload.single("file"), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Missing file" });
      }

      const contentType = req.file.mimetype || "application/octet-stream";
      const ext = (req.file.originalname.split(".").pop() || "bin").toLowerCase();
      const objectPath = `${req.user.id}/${randomUUID()}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("report-images")
        .upload(objectPath, req.file.buffer, {
          contentType,
          upsert: false
        });

      if (uploadError) {
        uploadError.message = `Storage upload failed: ${uploadError.message}`;
        throw uploadError;
      }

      const { data } = supabaseAdmin.storage.from("report-images").getPublicUrl(objectPath);
      return res.status(200).json({ url: data.publicUrl });
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/process", requireRoleAtLeastCitizen, async (req, res, next) => {
    try {
      const Params = z.object({ id: z.string().min(1) });
      const { id } = Params.parse(req.params);

      // For hackathons, we run synchronously; frontend polls `report_events`.
      await processReport(env, { reportId: id, requestedByUserId: req.user.id, requestedByRole: req.user.role });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(`[API] /reports/${req.params.id}/process failed with error:`, err);
      next(err);
    }
  });

  return router;
}

