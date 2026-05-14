/**
 * useGIS.ts — GIS Data Hooks
 * --------------------------
 * Provides React hooks for fetching ward and authority contact data
 * from the backend GIS API.
 */

import { useState, useEffect } from "react";
import type { Ward, WardContacts } from "@/types";

const API_BASE = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001/api";

// ── useWards ─────────────────────────────────────────────────────────────────

interface UseWardsResult {
  wards: Ward[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches all 198 BBMP wards for dropdown / map overlay use.
 */
export function useWards(): UseWardsResult {
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchWards() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/gis/wards`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { wards: data } = await res.json();
        if (!cancelled) setWards(data ?? []);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWards();
    return () => { cancelled = true; };
  }, []);

  return { wards, loading, error };
}

// ── useWardContacts ───────────────────────────────────────────────────────────

interface UseWardContactsResult {
  contacts: WardContacts | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches authority contacts for a specific ward number.
 * Returns null while loading or if ward has no contacts seeded.
 */
export function useWardContacts(wardNo: number | null | undefined): UseWardContactsResult {
  const [contacts, setContacts] = useState<WardContacts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wardNo) {
      setContacts(null);
      return;
    }

    let cancelled = false;

    async function fetchContacts() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/gis/ward-contacts/${wardNo}`);
        if (res.status === 404) {
          if (!cancelled) setContacts(null);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { contacts: data } = await res.json();
        if (!cancelled) setContacts(data);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchContacts();
    return () => { cancelled = true; };
  }, [wardNo]);

  return { contacts, loading, error };
}

// ── Unique zones derived from wards ──────────────────────────────────────────

/**
 * Returns a sorted list of unique zone names from the wards list.
 * Use after calling useWards().
 */
export function getUniqueZones(wards: Ward[]): string[] {
  const zones = new Set<string>();
  for (const w of wards) {
    if (w.zone_name) zones.add(w.zone_name);
  }
  return Array.from(zones).sort();
}
