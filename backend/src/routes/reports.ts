import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { Env } from "../env.js";
import { getAdminSupabase } from "../supabase/clients.js";
import { processReport } from "../pipeline/processReport.js";
import { requireRoleAtLeastCitizen } from "../middleware/requireRole.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

export function reportsRouter(env: Env) {
  const router = Router();
  const supabaseAdmin = getAdminSupabase(env);

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
      next(err);
    }
  });

  return router;
}

