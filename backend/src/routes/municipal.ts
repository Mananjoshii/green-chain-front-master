import { Router } from "express";
import { z } from "zod";

import type { Env } from "../env.js";
import { getAdminSupabase } from "../supabase/clients.js";
import { requireMunicipal } from "../middleware/requireRole.js";

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

  router.post("/reports/:id/resolve", requireMunicipal, async (req, res, next) => {
    try {
      const Params = z.object({ id: z.string().min(1) });
      const { id } = Params.parse(req.params);

      const { data: report, error: fetchError } = await supabaseAdmin.from("reports").select("*").eq("id", id).single();
      if (fetchError) throw fetchError;

      if (report.status === "rejected") {
        return res.status(400).json({ error: "Cannot resolve a rejected report" });
      }

      // Only grant rewards on manual municipal resolution.
      // Prefer the suggested reward computed by the AI pipeline (stored in report_events.metadata),
      // otherwise fall back to any existing token_reward (legacy behavior).
      let tokensToMint: number | null =
        typeof report.token_reward === "number" ? report.token_reward : null;

      if (tokensToMint == null) {
        const { data: rewardEvent, error: rewardEvErr } = await supabaseAdmin
          .from("report_events")
          .select("metadata")
          .eq("report_id", id)
          .eq("agent_type", "reward_optimization")
          .maybeSingle();
        if (rewardEvErr) throw rewardEvErr;

        const suggested = Number((rewardEvent?.metadata as any)?.suggested_token_reward);
        if (Number.isFinite(suggested) && suggested > 0) tokensToMint = Math.round(suggested);
      }

      const { error: updateError } = await supabaseAdmin
        .from("reports")
        .update({ status: "resolved", token_reward: tokensToMint })
        .eq("id", id);
      if (updateError) throw updateError;

      if (typeof tokensToMint === "number" && tokensToMint > 0) {
        const { error: txError } = await supabaseAdmin.from("token_transactions").insert({
          user_id: report.user_id,
          report_id: report.id,
          tokens: tokensToMint,
          status: "minted",
          tx_hash: null
        });
        if (txError) throw txError;
      }

      return res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

