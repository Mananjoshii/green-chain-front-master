import type { Env } from "../../env.js";
import { getAdminSupabase } from "../../supabase/clients.js";
import { upsertReportEvent } from "../events.js";
import { haversineMeters } from "../utils/geo.js";

const DEFAULT_NEARBY_METERS = 250;

export async function stageGeoIntelligence(env: Env, reportId: string) {
  const supabaseAdmin = getAdminSupabase(env);

  const { data: report, error } = await supabaseAdmin
    .from("reports")
    .select("id,latitude,longitude,location_address,severity")
    .eq("id", reportId)
    .single();
  if (error) throw error;

  if (report.latitude == null || report.longitude == null) {
    const e = new Error("Report missing latitude/longitude");
    (e as any).statusCode = 400;
    throw e;
  }

  // Bounding box for a quick prefilter (rough, fine for hackathon scale).
  const lat = report.latitude;
  const lng = report.longitude;
  const delta = 0.01; // ~1.1km

  const { data: candidates, error: hsErr } = await supabaseAdmin
    .from("hotspots")
    .select("*")
    .gte("latitude", lat - delta)
    .lte("latitude", lat + delta)
    .gte("longitude", lng - delta)
    .lte("longitude", lng + delta)
    .limit(500);
  if (hsErr) throw hsErr;

  let nearest:
    | (typeof candidates extends Array<infer T> ? T : never)
    | null = null;
  let nearestDist = Number.POSITIVE_INFINITY;

  for (const h of candidates ?? []) {
    const d = haversineMeters({ lat, lng }, { lat: h.latitude, lng: h.longitude });
    if (d < nearestDist) {
      nearestDist = d;
      nearest = h as any;
    }
  }

  if (nearest && nearestDist <= DEFAULT_NEARBY_METERS) {
    const newCount = (nearest.report_count ?? 0) + 1;
    const severityScore: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    const s = severityScore[report.severity] ?? 2;
    const avg = ((nearest.avg_severity ?? s) * (newCount - 1) + s) / newCount;

    const { error: updErr } = await supabaseAdmin
      .from("hotspots")
      .update({ report_count: newCount, avg_severity: avg, last_updated: new Date().toISOString() })
      .eq("id", nearest.id);
    if (updErr) throw updErr;

    await upsertReportEvent(env, {
      reportId,
      agentType: "geo_intelligence",
      stageStatus: "processing",
      message: `Linked to hotspot '${nearest.area_name}' (${Math.round(nearestDist)}m)`,
      metadata: { hotspot_id: nearest.id, distance_meters: nearestDist, action: "incremented" }
    });
    return;
  }

  const areaName = report.location_address?.slice(0, 80) || "Unknown area";
  const { data: created, error: insErr } = await supabaseAdmin
    .from("hotspots")
    .insert({
      area_name: areaName,
      latitude: lat,
      longitude: lng,
      report_count: 1,
      avg_severity: 2,
      last_updated: new Date().toISOString()
    })
    .select("*")
    .single();
  if (insErr) throw insErr;

  await upsertReportEvent(env, {
    reportId,
    agentType: "geo_intelligence",
    stageStatus: "processing",
    message: `Created new hotspot '${created.area_name}'`,
    metadata: { hotspot_id: created.id, action: "created" }
  });
}

