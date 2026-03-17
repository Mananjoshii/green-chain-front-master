import type { Env } from "../env.js";
import { getAdminSupabase } from "../supabase/clients.js";
import { upsertReportEvent, type AgentType } from "./events.js";
import { stageWasteVerification } from "./stages/wasteVerification.js";
import { stageGeoIntelligence } from "./stages/geoIntelligence.js";
import { stageMunicipalCoordination } from "./stages/municipalCoordination.js";
import { stageRewardOptimization } from "./stages/rewardOptimization.js";
import { stageFraudDetection } from "./stages/fraudDetection.js";

type AppRole = "citizen" | "municipal_officer" | "city_planner" | "admin";

const stages: AgentType[] = [
  "waste_verification",
  "geo_intelligence",
  "municipal_coordination",
  "reward_optimization",
  "fraud_detection"
];

export async function processReport(
  env: Env,
  args: { reportId: string; requestedByUserId: string; requestedByRole: AppRole }
) {
  const supabaseAdmin = getAdminSupabase(env);

  // Ensure report exists and (for citizen) is owned by caller.
  const { data: report, error: reportErr } = await supabaseAdmin.from("reports").select("*").eq("id", args.reportId).single();
  if (reportErr) throw reportErr;
  if (args.requestedByRole === "citizen" && report.user_id !== args.requestedByUserId) {
    const e = new Error("Forbidden");
    (e as any).statusCode = 403;
    throw e;
  }

  // Initialize all stages as pending if missing.
  for (const agentType of stages) {
    await upsertReportEvent(env, {
      reportId: args.reportId,
      agentType,
      stageStatus: "pending"
    });
  }

  // Run sequentially, updating `report_events` for each stage.
  await runStage(env, args.reportId, "waste_verification", () => stageWasteVerification(env, args.reportId));
  await runStage(env, args.reportId, "geo_intelligence", () => stageGeoIntelligence(env, args.reportId));
  await runStage(env, args.reportId, "municipal_coordination", () => stageMunicipalCoordination(env, args.reportId));
  await runStage(env, args.reportId, "reward_optimization", () => stageRewardOptimization(env, args.reportId));
  await runStage(env, args.reportId, "fraud_detection", () => stageFraudDetection(env, args.reportId));
}

async function runStage(env: Env, reportId: string, agentType: AgentType, fn: () => Promise<void>) {
  await upsertReportEvent(env, { reportId, agentType, stageStatus: "processing" });
  try {
    await fn();
    await upsertReportEvent(env, { reportId, agentType, stageStatus: "completed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stage failed";
    await upsertReportEvent(env, {
      reportId,
      agentType,
      stageStatus: "failed",
      message
    });
    throw err;
  }
}

