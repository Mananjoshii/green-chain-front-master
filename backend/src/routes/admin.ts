import { Router } from "express";
import { z } from "zod";

import type { Env } from "../env.js";
import { getAdminSupabase } from "../supabase/clients.js";
import { requirePlannerOrAdmin } from "../middleware/requireRole.js";

function isoDay(d: Date) {
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function adminRouter(env: Env) {
  const router = Router();
  const supabaseAdmin = getAdminSupabase(env);

  router.get("/metrics", requirePlannerOrAdmin, async (_req, res, next) => {
    try {
      const [{ count: totalReports, error: totalErr }, { count: resolvedReports, error: resolvedErr }] =
        await Promise.all([
          supabaseAdmin.from("reports").select("*", { count: "exact", head: true }),
          supabaseAdmin.from("reports").select("*", { count: "exact", head: true }).eq("status", "resolved")
        ]);
      if (totalErr) throw totalErr;
      if (resolvedErr) throw resolvedErr;

      const { data: resolvedRows, error: resolvedRowsErr } = await supabaseAdmin
        .from("reports")
        .select("created_at,updated_at")
        .eq("status", "resolved")
        .limit(1000);
      if (resolvedRowsErr) throw resolvedRowsErr;

      const avgResponseSeconds =
        (resolvedRows ?? []).reduce((acc, r) => {
          const created = new Date(r.created_at).getTime();
          const updated = new Date(r.updated_at).getTime();
          if (!Number.isFinite(created) || !Number.isFinite(updated)) return acc;
          return acc + Math.max(0, (updated - created) / 1000);
        }, 0) / Math.max(1, (resolvedRows ?? []).length);

      const { data: tokenRows, error: tokenErr } = await supabaseAdmin.from("token_transactions").select("tokens").limit(5000);
      if (tokenErr) throw tokenErr;
      const totalTokensMinted = (tokenRows ?? []).reduce((acc, r) => acc + (typeof r.tokens === "number" ? r.tokens : 0), 0);

      const total = totalReports ?? 0;
      const resolved = resolvedReports ?? 0;

      return res.status(200).json({
        total_reports: total,
        resolution_rate: total === 0 ? 0 : resolved / total,
        avg_response_time_seconds: Number.isFinite(avgResponseSeconds) ? avgResponseSeconds : 0,
        total_tokens_minted: totalTokensMinted
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/metrics/by-severity", requirePlannerOrAdmin, async (_req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin.from("reports").select("severity").limit(5000);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const r of data ?? []) {
        const k = r.severity ?? "unknown";
        counts[k] = (counts[k] ?? 0) + 1;
      }

      return res.status(200).json({ by_severity: counts });
    } catch (err) {
      next(err);
    }
  });

  router.get("/metrics/by-area", requirePlannerOrAdmin, async (_req, res, next) => {
    try {
      // Best-effort: hotspots already store aggregated counts.
      const { data, error } = await supabaseAdmin
        .from("hotspots")
        .select("id,area_name,latitude,longitude,report_count,avg_severity,last_updated")
        .order("report_count", { ascending: false })
        .limit(500);
      if (error) throw error;
      return res.status(200).json({ hotspots: data ?? [] });
    } catch (err) {
      next(err);
    }
  });

  router.get("/metrics/tokens-over-time", requirePlannerOrAdmin, async (req, res, next) => {
    try {
      const Query = z.object({ days: z.coerce.number().int().positive().max(365).optional() });
      const { days } = Query.parse(req.query);
      const windowDays = days ?? 30;
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabaseAdmin
        .from("token_transactions")
        .select("created_at,tokens")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(5000);
      if (error) throw error;

      const buckets: Record<string, number> = {};
      for (const row of data ?? []) {
        const day = isoDay(new Date(row.created_at));
        buckets[day] = (buckets[day] ?? 0) + (typeof row.tokens === "number" ? row.tokens : 0);
      }

      const series = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, tokens]) => ({ day, tokens }));

      return res.status(200).json({ series });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

