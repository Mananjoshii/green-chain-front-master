import type { Env } from "../../env.js";
import { getAdminSupabase } from "../../supabase/clients.js";
import { upsertReportEvent } from "../events.js";

type Severity = "low" | "medium" | "high" | "critical";
type WasteCategory = "organic" | "plastic" | "e_waste" | "construction" | "hazardous" | "mixed" | "other";

function facilityFor(category: WasteCategory) {
  switch (category) {
    case "e_waste":
      return { facility_id: "facility:ewaste_center_1", facility_type: "specialized_ewaste" as const };
    case "hazardous":
      return { facility_id: "facility:hazmat_unit_1", facility_type: "hazardous_waste" as const };
    case "construction":
      return { facility_id: "facility:cnd_depot_1", facility_type: "construction_debris" as const };
    case "organic":
      return { facility_id: "facility:compost_site_1", facility_type: "organic_compost" as const };
    case "plastic":
      return { facility_id: "facility:mrf_plastics_1", facility_type: "recycling_mrf" as const };
    case "mixed":
      return { facility_id: "facility:sorting_hub_1", facility_type: "sorting" as const };
    default:
      return { facility_id: "facility:general_waste_1", facility_type: "general" as const };
  }
}

function scoreToSeverity(score: number): Severity {
  if (score >= 8) return "critical";
  if (score >= 6) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export async function stageMunicipalCoordination(env: Env, reportId: string) {
  const supabaseAdmin = getAdminSupabase(env);

  const { data: report, error } = await supabaseAdmin
    .from("reports")
    .select("id,category,severity,status,assigned_to")
    .eq("id", reportId)
    .single();
  if (error) throw error;

  // Pull contamination signal from stage 1 metadata if present.
  const { data: ev, error: evErr } = await supabaseAdmin
    .from("report_events")
    .select("metadata")
    .eq("report_id", reportId)
    .eq("agent_type", "waste_verification")
    .maybeSingle();
  if (evErr) throw evErr;

  const contamination = Boolean((ev?.metadata as any)?.contamination_at_source);

  // Deterministic severity logic (no schema changes).
  let score = 3; // baseline
  const cat = report.category as WasteCategory;
  if (cat === "hazardous") score += 4;
  if (cat === "e_waste") score += 2;
  if (cat === "construction") score += 2;
  if (cat === "mixed") score += 2;
  if (contamination) score += 2;

  // If report already marked higher by citizen, respect it as a floor.
  const floor: Record<Severity, number> = { low: 1, medium: 4, high: 6, critical: 8 };
  score = Math.max(score, floor[report.severity as Severity] ?? 1);

  const severity = scoreToSeverity(score);
  const facility = facilityFor(cat);
  const assigned_to = facility.facility_id;

  const { error: updErr } = await supabaseAdmin
    .from("reports")
    .update({
      severity,
      status: "assigned",
      // assigned_to is a UUID FK — store facility string in event metadata instead
    })
    .eq("id", reportId);
  if (updErr) throw updErr;

  await upsertReportEvent(env, {
    reportId,
    agentType: "municipal_coordination",
    stageStatus: "processing",
    message: `Routed to ${facility.facility_id} with severity '${severity}'`,
    metadata: {
      severity,
      facility,
      contamination_at_source: contamination,
      rationale: {
        category: cat,
        score
      }
    }
  });
}

