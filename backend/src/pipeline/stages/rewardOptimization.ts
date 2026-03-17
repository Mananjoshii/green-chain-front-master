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
    .select("id,severity")
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

  const { error: updErr } = await supabaseAdmin.from("reports").update({ token_reward }).eq("id", reportId);
  if (updErr) throw updErr;

  await upsertReportEvent(env, {
    reportId,
    agentType: "reward_optimization",
    stageStatus: "processing",
    message: `Token reward set to ${token_reward}`,
    metadata: { base, multiplier, contamination_bonus: contaminationBonus, ai_quality_score, token_reward }
  });
}

