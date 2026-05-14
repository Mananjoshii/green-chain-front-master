/**
 * municipalCoordination.ts — Ward Authority Resolution
 * -----------------------------------------------------
 * Replaces the old hardcoded facility-routing switch statement.
 *
 * This stage:
 * 1. Reads the ward_no resolved by the geoIntelligence stage
 * 2. Fetches real BBMP authority contacts from the ward_contacts table
 * 3. Emits a municipal_coordination event with structured contact info
 * 4. Updates report status to "in_progress"
 *
 * No facility routing, no disposal logistics, no beat generation.
 */

import type { Env } from "../../env.js";
import { getAdminSupabase } from "../../supabase/clients.js";
import { upsertReportEvent } from "../events.js";
import { getWardContacts } from "../../services/geo.js";

type Severity = "low" | "medium" | "high" | "critical";

function scoreToSeverity(score: number): Severity {
  if (score >= 8) return "critical";
  if (score >= 6) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export async function stageMunicipalCoordination(env: Env, reportId: string) {
  const supabaseAdmin = getAdminSupabase(env);

  // Fetch report — include ward_no persisted by geoIntelligence stage
  const { data: report, error } = await supabaseAdmin
    .from("reports")
    .select("id,category,severity,status,ward_no,detected_ward_name")
    .eq("id", reportId)
    .single();
  if (error) throw error;

  // ── Severity scoring (preserved from original logic) ──────────────────────
  const { data: ev, error: evErr } = await supabaseAdmin
    .from("report_events")
    .select("metadata")
    .eq("report_id", reportId)
    .eq("agent_type", "waste_verification")
    .maybeSingle();
  if (evErr) throw evErr;

  const contamination = Boolean((ev?.metadata as any)?.contamination_at_source);

  let score = 3;
  const cat = report.category as string;
  if (cat === "hazardous")   score += 4;
  if (cat === "e_waste")     score += 2;
  if (cat === "construction") score += 2;
  if (cat === "mixed")       score += 2;
  if (contamination)         score += 2;

  const floor: Record<Severity, number> = { low: 1, medium: 4, high: 6, critical: 8 };
  score = Math.max(score, floor[report.severity as Severity] ?? 1);
  const severity = scoreToSeverity(score);

  // ── Update report status ──────────────────────────────────────────────────
  const { error: updErr } = await supabaseAdmin
    .from("reports")
    .update({ severity, status: "in_progress" })
    .eq("id", reportId);
  if (updErr) throw updErr;

  // ── Ward authority contacts ───────────────────────────────────────────────
  const wardNo = report.ward_no as number | null;
  const wardName = report.detected_ward_name as string | null;

  let authorityPayload: Record<string, unknown> = {
    ward_no:   wardNo,
    ward_name: wardName ?? "Unknown Ward",
    note:      "Ward contacts not yet seeded — run importWardContacts.ts"
  };

  if (wardNo) {
    const contacts = await getWardContacts(env, wardNo);

    if (contacts) {
      authorityPayload = {
        ward_no:    contacts.ward_no,
        ward_name:  contacts.ward_name,
        zone_name:  contacts.zone_name,
        assembly_constituency: contacts.assembly_constituency,

        // Primary field officer for sanitation complaints
        health_inspector: {
          name:  contacts.jr_health_inspector_name,
          phone: contacts.jr_health_inspector_phone,
          role:  "Junior Health Inspector"
        },

        // Senior supervisor
        sanitation_authority: {
          name:  contacts.sr_health_inspector_name,
          phone: contacts.sr_health_inspector_phone,
          role:  "Senior Health Inspector"
        },

        // Ward-level engineering officer
        ward_officer: {
          name:  contacts.ee_name,
          phone: contacts.ee_phone,
          role:  "Executive Engineer"
        },

        // Revenue oversight
        revenue_officer: {
          name:  contacts.ro_name,
          phone: contacts.ro_phone,
          role:  "Revenue Officer"
        },

        assistant_revenue_officer: {
          name:  contacts.aro_name,
          phone: contacts.aro_phone,
          role:  "Assistant Revenue Officer"
        },

        // Escalation — Joint Commissioner of the zone
        escalation_contact: {
          name:  contacts.jc_name,
          phone: contacts.jc_phone,
          role:  "Joint Commissioner"
        },

        // Additional contacts available
        deputy_commissioner: {
          name:  contacts.dc_name,
          phone: contacts.dc_phone
        },
        animal_husbandry: {
          name:  contacts.animal_husbandry_name,
          phone: contacts.animal_husbandry_phone
        }
      };
    }
  }

  // ── Emit coordination event ───────────────────────────────────────────────
  const wardDisplay = wardNo
    ? `Ward ${wardNo} — ${wardName ?? "Unknown"}`
    : "Ward not detected";

  await upsertReportEvent(env, {
    reportId,
    agentType:   "municipal_coordination",
    stageStatus: "processing",
    message:     `Assigned to ${wardDisplay} · Severity: ${severity}`,
    metadata: {
      severity,
      contamination_at_source: contamination,
      category_score:          { category: cat, score },
      ...authorityPayload
    }
  });
}
