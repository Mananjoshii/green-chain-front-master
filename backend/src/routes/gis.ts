/**
 * gis.ts — GIS API Routes
 * -----------------------
 * Exposes ward and authority contact data for frontend consumption.
 *
 * GET /gis/wards                  — all wards (id, ward_no, name, zone, centroid)
 * GET /gis/wards/:wardNo          — single ward info
 * GET /gis/ward-contacts/:wardNo  — full authority contact card
 */

import { Router } from "express";
import { z } from "zod";
import type { Env } from "../env.js";
import { getAllWards, getWardContacts, resolveWard } from "../services/geo.js";
import { getAdminSupabase } from "../supabase/clients.js";

export function gisRouter(env: Env) {
  const router = Router();

  // ── GET /gis/wards ──────────────────────────────────────────────────────────
  router.get("/wards", async (_req, res, next) => {
    try {
      const wards = await getAllWards(env);
      return res.status(200).json({ wards });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /gis/wards/:wardNo ───────────────────────────────────────────────────
  router.get("/wards/:wardNo", async (req, res, next) => {
    try {
      const { wardNo } = z.object({ wardNo: z.coerce.number().int().min(1) }).parse(req.params);

      const supabase = getAdminSupabase(env);
      const { data, error } = await supabase
        .from("wards")
        .select("id, ward_no, ward_name, zone_name, centroid_lat, centroid_lng")
        .eq("ward_no", wardNo)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: `Ward ${wardNo} not found` });

      return res.status(200).json({ ward: data });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /gis/ward-contacts/:wardNo ───────────────────────────────────────────
  router.get("/ward-contacts/:wardNo", async (req, res, next) => {
    try {
      const { wardNo } = z.object({ wardNo: z.coerce.number().int().min(1) }).parse(req.params);

      const contacts = await getWardContacts(env, wardNo);
      if (!contacts) {
        return res.status(404).json({
          error: `No contacts found for ward ${wardNo}`,
          hint: "Run: npx tsx backend/src/scripts/importWardContacts.ts"
        });
      }

      return res.status(200).json({ contacts });
    } catch (err) {
      next(err);
    }
  });

  // ── GET /gis/resolve?lat=&lng= ──────────────────────────────────────────────
  // Utility endpoint: resolve a GPS point to a ward (useful for debugging)
  router.get("/resolve", async (req, res, next) => {
    try {
      const { lat, lng } = z.object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180)
      }).parse(req.query);

      const ward = await resolveWard(env, lat, lng);
      if (!ward) {
        return res.status(404).json({ error: "No ward found for coordinates" });
      }

      return res.status(200).json({ ward });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
