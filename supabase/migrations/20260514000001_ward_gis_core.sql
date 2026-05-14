-- ============================================================
-- Ward-Centric GIS Core Migration
-- Enables PostGIS-backed ward detection and authority contact
-- resolution for the Urban Waste Reporting System.
-- ============================================================

-- 1. Enable PostGIS (already confirmed installed)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 2. Wards table (polygon geometry + metadata)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_no         INTEGER NOT NULL UNIQUE,
  ward_name       TEXT    NOT NULL,
  zone_name       TEXT,
  geom            GEOMETRY(MULTIPOLYGON, 4326),
  centroid_lat    DOUBLE PRECISION,
  centroid_lng    DOUBLE PRECISION,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wards_geom    ON public.wards USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_wards_ward_no ON public.wards(ward_no);

ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wards_public_read" ON public.wards FOR SELECT USING (true);

-- ============================================================
-- 3. Ward contacts table (14 officials per ward)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ward_contacts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_no                     INTEGER NOT NULL UNIQUE REFERENCES public.wards(ward_no),
  ward_name                   TEXT    NOT NULL,
  zone_name                   TEXT,
  assembly_constituency        TEXT,
  -- Joint Commissioner
  jc_name                     TEXT,
  jc_phone                    TEXT,
  -- Deputy Commissioner
  dc_name                     TEXT,
  dc_phone                    TEXT,
  -- Superintending Engineer
  se_name                     TEXT,
  se_phone                    TEXT,
  -- Chief Engineer
  ce_name                     TEXT,
  ce_phone                    TEXT,
  -- Executive Engineer
  ee_name                     TEXT,
  ee_phone                    TEXT,
  -- Assistant Executive Engineer
  aee_name                    TEXT,
  aee_phone                   TEXT,
  -- Assistant Engineer
  ae_name                     TEXT,
  ae_phone                    TEXT,
  -- Health Inspectors
  jr_health_inspector_name    TEXT,
  jr_health_inspector_phone   TEXT,
  sr_health_inspector_name    TEXT,
  sr_health_inspector_phone   TEXT,
  -- Revenue Officers
  ro_name                     TEXT,
  ro_phone                    TEXT,
  aro_name                    TEXT,
  aro_phone                   TEXT,
  -- Animal Husbandry
  animal_husbandry_name       TEXT,
  animal_husbandry_phone      TEXT,
  created_at                  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ward_contacts_ward_no ON public.ward_contacts(ward_no);

ALTER TABLE public.ward_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ward_contacts_public_read" ON public.ward_contacts FOR SELECT USING (true);

-- ============================================================
-- 4. Extend reports table with ward metadata
-- ============================================================
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS ward_id            UUID REFERENCES public.wards(id),
  ADD COLUMN IF NOT EXISTS ward_no            INTEGER,
  ADD COLUMN IF NOT EXISTS detected_ward_name TEXT;

CREATE INDEX IF NOT EXISTS idx_reports_ward_id ON public.reports(ward_id);
CREATE INDEX IF NOT EXISTS idx_reports_ward_no ON public.reports(ward_no);

-- ============================================================
-- 5. PostGIS RPC: exact ward from GPS point (ST_Contains)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_ward_from_point(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS TABLE(
  id            UUID,
  ward_no       INTEGER,
  ward_name     TEXT,
  zone_name     TEXT,
  centroid_lat  DOUBLE PRECISION,
  centroid_lng  DOUBLE PRECISION
)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    id,
    ward_no,
    ward_name,
    zone_name,
    centroid_lat,
    centroid_lng
  FROM public.wards
  WHERE ST_Contains(
    geom,
    ST_SetSRID(ST_Point(p_lng, p_lat), 4326)
  )
  LIMIT 1;
$$;

-- ============================================================
-- 6. Helper RPC: upsert a ward row with geometry from GeoJSON string
--    Called by importBBMPWards.ts script
-- ============================================================
CREATE OR REPLACE FUNCTION public.upsert_ward_with_geom(
  p_ward_no       INTEGER,
  p_ward_name     TEXT,
  p_zone_name     TEXT,
  p_geom_geojson  TEXT,
  p_centroid_lat  DOUBLE PRECISION,
  p_centroid_lng  DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.wards (ward_no, ward_name, zone_name, geom, centroid_lat, centroid_lng)
  VALUES (
    p_ward_no,
    p_ward_name,
    p_zone_name,
    ST_Multi(ST_GeomFromGeoJSON(p_geom_geojson))::geometry(MULTIPOLYGON, 4326),
    p_centroid_lat,
    p_centroid_lng
  )
  ON CONFLICT (ward_no) DO UPDATE SET
    ward_name    = EXCLUDED.ward_name,
    zone_name    = EXCLUDED.zone_name,
    geom         = EXCLUDED.geom,
    centroid_lat = EXCLUDED.centroid_lat,
    centroid_lng = EXCLUDED.centroid_lng;
END;
$$;

-- ============================================================
-- 7. PostGIS RPC: nearest ward fallback (for boundary edge cases)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_nearest_ward(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS TABLE(
  id               UUID,
  ward_no          INTEGER,
  ward_name        TEXT,
  zone_name        TEXT,
  centroid_lat     DOUBLE PRECISION,
  centroid_lng     DOUBLE PRECISION,
  distance_meters  DOUBLE PRECISION
)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT
    id,
    ward_no,
    ward_name,
    zone_name,
    centroid_lat,
    centroid_lng,
    ST_Distance(
      geom::geography,
      ST_SetSRID(ST_Point(p_lng, p_lat), 4326)::geography
    ) AS distance_meters
  FROM public.wards
  ORDER BY distance_meters ASC
  LIMIT 1;
$$;
