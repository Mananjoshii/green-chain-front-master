/**
 * wardLookup.ts — PostGIS Ward Resolution (replaces ray-casting)
 * ---------------------------------------------------------------
 * Previously used a hardcoded JSON of 5 wards + ray-casting algorithm.
 * Now delegates to the PostGIS geo service, covering all 198 BBMP wards.
 */

import type { Env } from "../../env.js";
import { resolveWard, type WardInfo as GeoWardInfo } from "../../services/geo.js";

// ── Public type (kept compatible with existing callers) ──────────────────────

export interface WardInfo {
  wardName: string;
  wardNo: number;      // now integer, not string
  wardId: string;      // now UUID from wards table
  zoneName: string | null;
  detectionMethod: "postgis_contains" | "postgis_nearest";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the BBMP ward containing the given GPS coordinate.
 * Uses PostGIS ST_Contains via Supabase RPC.
 * Falls back to nearest ward if the point is on a boundary or outside city limits.
 *
 * @param env - Hono/Express env with Supabase credentials
 * @param lat - Latitude (WGS-84)
 * @param lng - Longitude (WGS-84)
 */
export async function findWard(
  env: Env,
  lat: number,
  lng: number
): Promise<WardInfo | null> {
  const result: GeoWardInfo | null = await resolveWard(env, lat, lng);
  if (!result) return null;

  return {
    wardName:        result.ward_name,
    wardNo:          result.ward_no,
    wardId:          result.id,
    zoneName:        result.zone_name,
    detectionMethod: result.detection_method
  };
}
