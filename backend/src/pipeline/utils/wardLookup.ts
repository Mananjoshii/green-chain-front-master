/**
 * Ward lookup utility — point-in-polygon check against a subset of BBMP wards.
 *
 * Only the 5 wards we currently care about are loaded:
 *   Kengeri, Rajarajeshwari Nagar, Hemmigepura, Uttarahalli, Jnana Bharathi
 *
 * Uses the ray-casting algorithm (works for simple and multi-ring polygons).
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the pre-filtered GeoJSON features at module initialisation time.
// The file is small (~5 wards) so this is fine to keep in memory.
const TARGET_WARDS: GeoJSONFeature[] = require(
  path.join(__dirname, "target_wards.json")
);

// ── Minimal GeoJSON types ────────────────────────────────────────────────────

type Position = [number, number]; // [lng, lat]
type Ring = Position[];

interface PolygonGeometry {
  type: "Polygon";
  coordinates: Ring[]; // [outerRing, ...holes]
}

interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: Ring[][];
}

interface GeoJSONFeature {
  type: "Feature";
  geometry: PolygonGeometry | MultiPolygonGeometry;
  properties: {
    KGISWardName: string;
    KGISWardNo: string;
    KGISWardID: number;
    KGISWardCode: string;
  };
}

// ── Ray-casting point-in-polygon ─────────────────────────────────────────────

/**
 * Returns true if (lng, lat) is inside the given ring.
 * Standard ray-casting algorithm.
 */
function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Returns true if (lng, lat) is inside the polygon (outer ring) and NOT
 * inside any hole ring.
 */
function pointInPolygon(lng: number, lat: number, rings: Ring[]): boolean {
  if (!pointInRing(lng, lat, rings[0])) return false;
  for (let h = 1; h < rings.length; h++) {
    if (pointInRing(lng, lat, rings[h])) return false; // inside a hole
  }
  return true;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface WardInfo {
  wardName: string;
  wardNo: string;
  wardId: number;
}

/**
 * Returns the ward that contains the given coordinates, or null if the point
 * does not fall inside any of the 5 target wards.
 *
 * @param lat  Latitude  (WGS-84)
 * @param lng  Longitude (WGS-84)
 */
export function findWard(lat: number, lng: number): WardInfo | null {
  for (const feature of TARGET_WARDS) {
    const geom = feature.geometry;

    if (geom.type === "Polygon") {
      if (pointInPolygon(lng, lat, geom.coordinates)) {
        return {
          wardName: feature.properties.KGISWardName,
          wardNo: feature.properties.KGISWardNo,
          wardId: feature.properties.KGISWardID,
        };
      }
    } else if (geom.type === "MultiPolygon") {
      for (const rings of geom.coordinates) {
        if (pointInPolygon(lng, lat, rings)) {
          return {
            wardName: feature.properties.KGISWardName,
            wardNo: feature.properties.KGISWardNo,
            wardId: feature.properties.KGISWardID,
          };
        }
      }
    }
  }
  return null;
}
