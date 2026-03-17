import type { Env } from "../../env.js";
import { getAdminSupabase } from "../../supabase/clients.js";
import { upsertReportEvent } from "../events.js";
import { haversineMeters } from "../utils/geo.js";

const WINDOW_HOURS = 24;
const NEARBY_METERS = 50;

export async function stageFraudDetection(env: Env, reportId: string) {
  const supabaseAdmin = getAdminSupabase(env);

  const { data: report, error } = await supabaseAdmin
    .from("reports")
    .select("id,latitude,longitude,user_id,created_at")
    .eq("id", reportId)
    .single();
  if (error) throw error;

  if (report.latitude == null || report.longitude == null) {
    // If no geo, we can't do geo-fraud checks; default to verified.
    const { error: updErr } = await supabaseAdmin.from("reports").update({ status: "verified" }).eq("id", reportId);
    if (updErr) throw updErr;
    await upsertReportEvent(env, {
      reportId,
      agentType: "fraud_detection",
      stageStatus: "processing",
      message: "No location available; skipped geo-fraud checks",
      metadata: { skipped: true }
    });
    return;
  }

  const lat = report.latitude;
  const lng = report.longitude;
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const delta = 0.002; // ~222m

  const { data: candidates, error: candErr } = await supabaseAdmin
    .from("reports")
    .select("id,user_id,latitude,longitude,created_at")
    .neq("id", reportId)
    .gte("created_at", since)
    .gte("latitude", lat - delta)
    .lte("latitude", lat + delta)
    .gte("longitude", lng - delta)
    .lte("longitude", lng + delta)
    .limit(200);
  if (candErr) throw candErr;

  let nearby = 0;
  let exactSameLocationCount = 0;
  const matches: Array<{
    id: string;
    user_id: string;
    distance_meters: number;
    created_at: string;
    same_location: boolean;
  }> = [];

  for (const r of candidates ?? []) {
    if (r.latitude == null || r.longitude == null) continue;
    const d = haversineMeters({ lat, lng }, { lat: r.latitude, lng: r.longitude });
    if (d <= NEARBY_METERS) {
      nearby++;

      const sameLocation =
        Math.abs(r.latitude - lat) < 1e-6 &&
        Math.abs(r.longitude - lng) < 1e-6;

      if (sameLocation) {
        exactSameLocationCount++;
      }

      matches.push({
        id: r.id,
        user_id: r.user_id,
        distance_meters: d,
        created_at: r.created_at,
        same_location: sameLocation
      });
    }
  }

  const suspicious = exactSameLocationCount >= 1;

  const status = suspicious ? "rejected" : "verified";
  const reason = suspicious
    ? `Potential duplicate: at least one report with the exact same latitude and longitude within ${WINDOW_HOURS}h`
    : "No exact same-location duplicate detected";

  const update: Record<string, unknown> = { status };
  // Ensure a rejected report cannot show/grant rewards from earlier pipeline stages.
  if (status === "rejected") update.token_reward = null;

  const { error: updErr } = await supabaseAdmin.from("reports").update(update).eq("id", reportId);
  if (updErr) throw updErr;

  await upsertReportEvent(env, {
    reportId,
    agentType: "fraud_detection",
    stageStatus: "processing",
    message: reason,
    metadata: { suspicious, nearby_reports: nearby, exact_same_location_count: exactSameLocationCount, matches }
  });
}

