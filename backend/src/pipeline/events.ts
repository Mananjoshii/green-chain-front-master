import type { Env } from "../env.js";
import { getAdminSupabase } from "../supabase/clients.js";

export type AgentType =
  | "waste_verification"
  | "geo_intelligence"
  | "municipal_coordination"
  | "reward_optimization"
  | "fraud_detection";

export type StageStatus = "pending" | "processing" | "completed" | "failed";

export async function upsertReportEvent(
  env: Env,
  args: {
    reportId: string;
    agentType: AgentType;
    stageStatus: StageStatus;
    message?: string | null;
    metadata?: unknown | null;
  }
) {
  const supabaseAdmin = getAdminSupabase(env);

  const { data: existing, error: selErr } = await supabaseAdmin
    .from("report_events")
    .select("id")
    .eq("report_id", args.reportId)
    .eq("agent_type", args.agentType)
    .maybeSingle();
  if (selErr) throw selErr;

  const payload: Record<string, unknown> = {
    stage_status: args.stageStatus
  };
  if (args.message !== undefined) payload.message = args.message;
  if (args.metadata !== undefined) payload.metadata = args.metadata as any;

  if (existing?.id) {
    const { error: updErr } = await supabaseAdmin.from("report_events").update(payload).eq("id", existing.id);
    if (updErr) throw updErr;
    return;
  }

  const { error: insErr } = await supabaseAdmin.from("report_events").insert({
    report_id: args.reportId,
    agent_type: args.agentType,
    stage_status: args.stageStatus,
    message: (args.message ?? null) as any,
    metadata: (args.metadata ?? null) as any
  });
  if (insErr) throw insErr;
}

