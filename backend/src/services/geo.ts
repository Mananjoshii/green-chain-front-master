/**
 * geo.ts — PostGIS Ward Resolution Service
 * -----------------------------------------
 * Single responsibility: resolve GPS coordinates to a BBMP ward
 * and fetch the responsible authority contacts for that ward.
 *
 * Uses Supabase rpc() to call PostGIS functions. No spatial
 * computation happens in Node.js — all handled by PostgreSQL.
 */

import type { Env } from "../env.js";
import { getAdminSupabase } from "../supabase/clients.js";

// ── Public types ─────────────────────────────────────────────────────────────

export interface WardInfo {
  id: string;
  ward_no: number;
  ward_name: string;
  zone_name: string | null;
  centroid_lat: number;
  centroid_lng: number;
  detection_method: "postgis_contains" | "postgis_nearest";
}

export interface WardContacts {
  ward_no: number;
  ward_name: string;
  zone_name: string | null;
  assembly_constituency: string | null;
  jc_name: string | null;
  jc_phone: string | null;
  dc_name: string | null;
  dc_phone: string | null;
  se_name: string | null;
  se_phone: string | null;
  ce_name: string | null;
  ce_phone: string | null;
  ee_name: string | null;
  ee_phone: string | null;
  aee_name: string | null;
  aee_phone: string | null;
  ae_name: string | null;
  ae_phone: string | null;
  jr_health_inspector_name: string | null;
  jr_health_inspector_phone: string | null;
  sr_health_inspector_name: string | null;
  sr_health_inspector_phone: string | null;
  ro_name: string | null;
  ro_phone: string | null;
  aro_name: string | null;
  aro_phone: string | null;
  animal_husbandry_name: string | null;
  animal_husbandry_phone: string | null;
}

// ── Ward Resolution ───────────────────────────────────────────────────────────

/**
 * Resolves a GPS coordinate to a BBMP ward using PostGIS.
 *
 * Strategy:
 * 1. Try exact ST_Contains match (fast, precise)
 * 2. Fallback to nearest ward (for points on boundaries or outside city)
 *
 * Returns null only if no wards exist in the database.
 */
export async function resolveWard(
  env: Env,
  lat: number,
  lng: number
): Promise<WardInfo | null> {
  const supabase = getAdminSupabase(env);

  // Step 1: exact point-in-polygon
  const { data: exactData, error: exactErr } = await supabase
    .rpc("fn_ward_from_point", { p_lat: lat, p_lng: lng });

  if (exactErr) {
    console.warn("[geo] fn_ward_from_point error:", exactErr.message);
  }

  if (exactData && exactData.length > 0) {
    const w = exactData[0];
    return {
      id:               w.id,
      ward_no:          w.ward_no,
      ward_name:        w.ward_name,
      zone_name:        w.zone_name ?? null,
      centroid_lat:     w.centroid_lat,
      centroid_lng:     w.centroid_lng,
      detection_method: "postgis_contains"
    };
  }

  // Step 2: fallback — nearest ward
  console.warn(`[geo] Point (${lat}, ${lng}) not inside any ward polygon — using nearest ward fallback`);

  const { data: nearestData, error: nearestErr } = await supabase
    .rpc("fn_nearest_ward", { p_lat: lat, p_lng: lng });

  if (nearestErr) {
    console.error("[geo] fn_nearest_ward error:", nearestErr.message);
    return null;
  }

  if (!nearestData || nearestData.length === 0) {
    console.error("[geo] No wards found in database — run importBBMPWards.ts");
    return null;
  }

  const w = nearestData[0];
  return {
    id:               w.id,
    ward_no:          w.ward_no,
    ward_name:        w.ward_name,
    zone_name:        w.zone_name ?? null,
    centroid_lat:     w.centroid_lat,
    centroid_lng:     w.centroid_lng,
    detection_method: "postgis_nearest"
  };
}

// ── Ward Contacts ─────────────────────────────────────────────────────────────

/**
 * Fetches the full authority contact card for a given ward number.
 * Returns null if ward contacts have not been seeded yet.
 */
export async function getWardContacts(
  env: Env,
  wardNo: number
): Promise<WardContacts | null> {
  const supabase = getAdminSupabase(env);

  const { data, error } = await supabase
    .from("ward_contacts")
    .select("*")
    .eq("ward_no", wardNo)
    .maybeSingle();

  if (error) {
    console.error(`[geo] getWardContacts(${wardNo}) error:`, error.message);
    return null;
  }

  return data as WardContacts | null;
}

/**
 * Fetches all wards (id, ward_no, ward_name, zone_name, centroid)
 * for dropdown/map use — no geometry returned.
 */
export async function getAllWards(env: Env): Promise<Omit<WardInfo, "detection_method">[]> {
  const supabase = getAdminSupabase(env);

  const { data, error } = await supabase
    .from("wards")
    .select("id, ward_no, ward_name, zone_name, centroid_lat, centroid_lng")
    .order("ward_no", { ascending: true });

  if (error) {
    console.error("[geo] getAllWards error:", error.message);
    return [];
  }

  return (data ?? []) as Omit<WardInfo, "detection_method">[];
}
