/**
 * importBBMPWards.ts
 * ------------------
 * Reads BBMP.geojson from the repo root and upserts all 198 ward polygon
 * features into the `wards` PostGIS table.
 *
 * Run from repo root:
 *   npx tsx backend/src/scripts/importBBMPWards.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../");

// Load environment variables from backend/.env
dotenv.config({ path: path.join(repoRoot, "backend", ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

// ── GeoJSON property key auto-detection ─────────────────────────────────────

const WARD_NO_KEYS  = ["KGISWardNo", "ward_no", "WARD_NO", "wardnumber", "WARD_NUMBER", "ward_num", "id"];
const WARD_NAME_KEYS = ["KGISWardName", "ward_name", "WARD_NAME", "name", "WardName"];
const ZONE_KEYS     = ["zone_name", "ZONE_NAME", "Zone", "zone"];

function detectKey(props: Record<string, unknown>, candidates: string[]): string | null {
  for (const key of candidates) {
    if (key in props) return key;
  }
  return null;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

interface GeoJSONGeometry {
  type: string;
  coordinates: unknown;
}

function toMultiPolygon(geom: GeoJSONGeometry): GeoJSONGeometry {
  if (geom.type === "MultiPolygon") return geom;
  if (geom.type === "Polygon") {
    return { type: "MultiPolygon", coordinates: [geom.coordinates] };
  }
  throw new Error(`Unsupported geometry type: ${geom.type}`);
}

function computeCentroid(geom: GeoJSONGeometry): { lat: number; lng: number } {
  // Simple bounding-box centroid — good enough for ward labelling
  const coords: number[][] = [];
  const flatten = (x: unknown) => {
    if (!Array.isArray(x)) return;
    if (typeof x[0] === "number") {
      coords.push(x as number[]);
    } else {
      (x as unknown[]).forEach(flatten);
    }
  };
  flatten(geom.coordinates);

  if (coords.length === 0) return { lat: 12.9716, lng: 77.5946 };

  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const geojsonPath = path.join(repoRoot, "BBMP.geojson");

  if (!fs.existsSync(geojsonPath)) {
    console.error(`❌ BBMP.geojson not found at: ${geojsonPath}`);
    process.exit(1);
  }

  console.log(`📂 Reading ${geojsonPath}…`);
  const raw = fs.readFileSync(geojsonPath, "utf-8");
  const fc = JSON.parse(raw);

  if (!fc.features || !Array.isArray(fc.features)) {
    console.error("❌ GeoJSON has no features array");
    process.exit(1);
  }

  const features = fc.features as Array<{ properties: Record<string, unknown>; geometry: GeoJSONGeometry }>;
  console.log(`✅ Loaded ${features.length} features`);

  // Detect property keys from first feature
  const firstProps = features[0]?.properties ?? {};
  const wardNoKey   = detectKey(firstProps, WARD_NO_KEYS);
  const wardNameKey = detectKey(firstProps, WARD_NAME_KEYS);
  const zoneKey     = detectKey(firstProps, ZONE_KEYS);

  console.log(`🔍 Detected keys: ward_no="${wardNoKey}", ward_name="${wardNameKey}", zone="${zoneKey ?? "none"}"`);

  if (!wardNoKey || !wardNameKey) {
    console.error("❌ Could not detect ward_no or ward_name keys. Properties found:", Object.keys(firstProps));
    process.exit(1);
  }

  let successCount = 0;
  let errorCount = 0;
  const BATCH_SIZE = 20;

  for (let i = 0; i < features.length; i += BATCH_SIZE) {
    const batch = features.slice(i, i + BATCH_SIZE);
    const rows: object[] = [];

    for (const feature of batch) {
      const props = feature.properties;
      const rawNo = props[wardNoKey];
      const wardNo = parseInt(String(rawNo), 10);

      if (isNaN(wardNo)) {
        console.warn(`⚠️  Skipping feature with invalid ward_no: ${rawNo}`);
        errorCount++;
        continue;
      }

      const wardName = String(props[wardNameKey] ?? `Ward ${wardNo}`);
      const zoneName = zoneKey ? String(props[zoneKey] ?? "") : null;

      let multiGeom: GeoJSONGeometry;
      try {
        multiGeom = toMultiPolygon(feature.geometry);
      } catch (e) {
        console.warn(`⚠️  Ward ${wardNo}: ${(e as Error).message}`);
        errorCount++;
        continue;
      }

      const centroid = computeCentroid(multiGeom);
      const geomGeoJSON = JSON.stringify(multiGeom);

      rows.push({
        ward_no:      wardNo,
        ward_name:    wardName,
        zone_name:    zoneName || null,
        // We use raw_geom placeholder — actual PostGIS insert done via RPC
        _geom_geojson: geomGeoJSON,
        centroid_lat: centroid.lat,
        centroid_lng: centroid.lng
      });
    }

    // Insert each row individually via RPC to use ST_GeomFromGeoJSON
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const geomJSON = r["_geom_geojson"] as string;

      const { error } = await supabase.rpc("upsert_ward_with_geom", {
        p_ward_no:      r["ward_no"],
        p_ward_name:    r["ward_name"],
        p_zone_name:    r["zone_name"],
        p_geom_geojson: geomJSON,
        p_centroid_lat: r["centroid_lat"],
        p_centroid_lng: r["centroid_lng"]
      });

      if (error) {
        console.error(`❌ Ward ${r["ward_no"]}: ${error.message}`);
        errorCount++;
      } else {
        successCount++;
        if (successCount % 20 === 0) {
          process.stdout.write(`\r✅ Inserted ${successCount}/${features.length} wards…`);
        }
      }
    }
  }

  console.log(`\n\n🎉 Done! ${successCount} wards inserted, ${errorCount} errors.`);
}

main().catch(err => {
  console.error("💥 Fatal:", err);
  process.exit(1);
});
