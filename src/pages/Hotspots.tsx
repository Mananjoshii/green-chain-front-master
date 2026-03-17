import { useHotspots } from "@/hooks/useHotspots";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedPage, staggerContainer, fadeInUp } from "@/components/AnimatedPage";
import { GlassCard } from "@/components/GlassCard";
import { MapPin } from "lucide-react";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function zoneColor(avgSeverity: number) {
  if (avgSeverity >= 3.2) return { stroke: "#b91c1c", fill: "#ef4444" }; // red
  if (avgSeverity >= 2.4) return { stroke: "#c2410c", fill: "#f97316" }; // orange
  if (avgSeverity >= 1.6) return { stroke: "#a16207", fill: "#eab308" }; // yellow
  return { stroke: "#15803d", fill: "#22c55e" }; // green
}

const Hotspots = () => {
  const { data: hotspots, isLoading } = useHotspots();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading || !mapContainerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    const center: [number, number] = hotspots?.length ? [hotspots[0].latitude, hotspots[0].longitude] : [22.7196, 75.8577];
    const map = L.map(mapContainerRef.current).setView(center, 12);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    hotspots?.forEach((h) => {
      const avgSeverity = Number(h.avg_severity ?? 0);
      const { stroke, fill } = zoneColor(avgSeverity);
      const count = Number(h.report_count ?? 0);
      const radiusMeters = clamp(120 + Math.sqrt(count) * 120, 150, 1400);

      L.circle([h.latitude, h.longitude], {
        radius: radiusMeters,
        color: stroke,
        weight: 2,
        fillColor: fill,
        fillOpacity: clamp(0.18 + avgSeverity / 10 + Math.min(0.25, count / 200), 0.18, 0.6),
      })
        .addTo(map)
        .bindPopup(
          `<div>` +
            `<p style="font-weight:600">${h.area_name}</p>` +
            `<p>${count} reports</p>` +
            `<p>Avg severity: ${avgSeverity.toFixed(1)}</p>` +
            `</div>`
        );

      L.marker([h.latitude, h.longitude])
        .addTo(map)
        .bindPopup(`<div><p style="font-weight:600">${h.area_name}</p><p>${count} reports</p><p>Avg severity: ${avgSeverity.toFixed(1)}</p></div>`);
    });

    const legend = L.control({ position: "bottomright" });
    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-control leaflet-bar");
      div.style.background = "rgba(15, 23, 42, 0.75)";
      div.style.color = "white";
      div.style.padding = "10px 12px";
      div.style.borderRadius = "12px";
      div.style.border = "1px solid rgba(255,255,255,0.15)";
      div.style.backdropFilter = "blur(8px)";
      div.style.fontSize = "12px";
      div.style.lineHeight = "1.2";
      div.innerHTML =
        `<div style="font-weight:700; margin-bottom:6px;">Hotspot severity</div>` +
        `<div style="display:flex; align-items:center; gap:8px; margin:4px 0;"><span style="width:10px; height:10px; border-radius:999px; display:inline-block; background:#ef4444;"></span><span>High (≥ 3.2)</span></div>` +
        `<div style="display:flex; align-items:center; gap:8px; margin:4px 0;"><span style="width:10px; height:10px; border-radius:999px; display:inline-block; background:#f97316;"></span><span>Elevated (≥ 2.4)</span></div>` +
        `<div style="display:flex; align-items:center; gap:8px; margin:4px 0;"><span style="width:10px; height:10px; border-radius:999px; display:inline-block; background:#eab308;"></span><span>Moderate (≥ 1.6)</span></div>` +
        `<div style="display:flex; align-items:center; gap:8px; margin:4px 0;"><span style="width:10px; height:10px; border-radius:999px; display:inline-block; background:#22c55e;"></span><span>Low (&lt; 1.6)</span></div>` +
        `<div style="margin-top:6px; opacity:0.9;">Zone size scales with report count</div>`;
      return div;
    };
    legend.addTo(map);

    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; };
  }, [isLoading, hotspots]);

  return (
    <AnimatedPage className="space-y-6">
      <h1 className="text-3xl font-bold">Waste Hotspots</h1>

      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="overflow-hidden rounded-xl border shadow-sm" style={{ height: 450 }}>
        {isLoading ? <Skeleton className="h-full w-full" /> : <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />}
      </motion.div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />) : hotspots?.map((h) => {
          const avgSeverity = Number(h.avg_severity ?? 0);
          return (
            <motion.div key={h.id} variants={fadeInUp}>
              <GlassCard className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><h3 className="font-semibold">{h.area_name}</h3></div>
                  <Badge variant="secondary">{h.report_count} reports</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Average Severity: {avgSeverity.toFixed(1)} / 4</p>
                <p className="text-xs text-muted-foreground">Last updated: {new Date(h.last_updated).toLocaleDateString()}</p>
              </GlassCard>
            </motion.div>
          );
        })}
        {!isLoading && !hotspots?.length && <p className="col-span-full py-12 text-center text-muted-foreground">No hotspots identified yet. As reports accumulate, hotspots will appear here.</p>}
      </motion.div>
    </AnimatedPage>
  );
};

export default Hotspots;
