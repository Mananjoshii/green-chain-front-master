import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Hotspot } from "@/types";

export function useHotspots() {
  return useQuery({
    queryKey: ["hotspots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hotspots")
        .select("*")
        .order("report_count", { ascending: false });
      if (error) throw error;
      return data as Hotspot[];
    },
  });
}

export function useHotspotReports(hotspotId: string) {
  return useQuery({
    queryKey: ["hotspot-reports", hotspotId],
    enabled: !!hotspotId,
    queryFn: async () => {
      const { data: hotspot } = await supabase
        .from("hotspots")
        .select("latitude, longitude")
        .eq("id", hotspotId)
        .single();
      if (!hotspot) return [];

      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .gte("latitude", hotspot.latitude - 0.01)
        .lte("latitude", hotspot.latitude + 0.01)
        .gte("longitude", hotspot.longitude - 0.01)
        .lte("longitude", hotspot.longitude + 0.01);
      if (error) throw error;
      return data;
    },
  });
}
