import type { Env } from "../../env.js";
import { getAdminSupabase } from "../../supabase/clients.js";
import { upsertReportEvent } from "../events.js";

type Severity = "low" | "medium" | "high" | "critical";

const baseReward: Record<Severity, number> = {
  low: 5,
  medium: 10,
  high: 20,
  critical: 40
};

export async function stageRewardOptimization(env: Env, reportId: string) {
  const supabaseAdmin = getAdminSupabase(env);

  const { data: report, error } = await supabaseAdmin
    .from("reports")
    .select("id,severity,status")
    .eq("id", reportId)
    .single();
  if (error) throw error;

  const { data: ev, error: evErr } = await supabaseAdmin
    .from("report_events")
    .select("metadata")
    .eq("report_id", reportId)
    .eq("agent_type", "waste_verification")
    .maybeSingle();
  if (evErr) throw evErr;

  const ai_quality_score = Number((ev?.metadata as any)?.ai_quality_score ?? 0.5);
  const contamination = Boolean((ev?.metadata as any)?.contamination_at_source);

  const severity = report.severity as Severity;
  const base = baseReward[severity] ?? 10;
  const multiplier = 1 + 0.5 * Math.max(0, Math.min(1, ai_quality_score));
  const contaminationBonus = contamination ? 5 : 0;
  const token_reward = Math.round(base * multiplier + contaminationBonus);

  // IMPORTANT: Do not grant rewards during AI processing.
  // We only *suggest* a reward here; minting/crediting happens only when a municipal officer resolves the report.
  // The suggested reward is stored in `report_events.metadata` for the `reward_optimization` stage.
  const suggested =
    report.status === "rejected"
      ? 0
      : token_reward;

  await upsertReportEvent(env, {
    reportId,
    agentType: "reward_optimization",
    stageStatus: "processing",
    message: report.status === "rejected" ? "Report rejected; no reward suggested" : `Suggested token reward: ${suggested}`,
    metadata: { base, multiplier, contamination_bonus: contaminationBonus, ai_quality_score, suggested_token_reward: suggested }
  });
}

