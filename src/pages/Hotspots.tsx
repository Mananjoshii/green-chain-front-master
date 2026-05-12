import { useEffect, useRef } from "react";
import { useHotspots } from "@/hooks/useHotspots";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AnimatedPage, staggerContainer, fadeInUp } from "@/components/AnimatedPage";
import { GlassCard } from "@/components/GlassCard";
import { MapPin, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const Hotspots = () => {
  const { data: hotspots, isLoading } = useHotspots();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading || !mapContainerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const center: [number, number] = hotspots?.length 
      ? [hotspots[0].latitude, hotspots[0].longitude] 
      : [22.7196, 75.8577];

    const map = L.map(mapContainerRef.current).setView(center, 12);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    hotspots?.forEach((h) => {
      const avgSeverity = Number(h.avg_severity ?? 0);
      const color = avgSeverity >= 3 ? "#ef4444" : avgSeverity >= 2 ? "#f59e0b" : "#22c55e";
      
      L.circleMarker([h.latitude, h.longitude], {
        radius: Math.max(8, h.report_count * 3),
        fillColor: color,
        color,
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.4,
      })
      .addTo(map)
      .bindPopup(
        `<div>
          <p style="font-weight:600">${h.area_name}</p>
          <p>${h.report_count} reports</p>
          <p>Avg severity: ${avgSeverity.toFixed(1)}</p>
        </div>`
      );
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [isLoading, hotspots]);

  return (
    <AnimatedPage className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Waste Hotspots</h1>
          <p className="text-muted-foreground">Areas with high concentration of unresolved waste reports.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/20 shadow-lg" style={{ height: "60vh", minHeight: "400px" }}>
        {isLoading ? (
          <Skeleton className="h-full w-full" />
        ) : (
          <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
        )}
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        ) : hotspots?.length === 0 ? (
          <p className="col-span-full py-8 text-center text-muted-foreground">No critical hotspots identified at this time. Great job!</p>
        ) : (
          hotspots?.map((h) => {
            const avgSeverity = Number(h.avg_severity ?? 0);
            return (
              <motion.div key={h.id} variants={fadeInUp}>
                <GlassCard className="p-5 hover:-translate-y-1 transition-transform">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold line-clamp-1" title={h.area_name}>{h.area_name}</h3>
                    </div>
                    <Badge variant="secondary" className="shrink-0">{h.report_count} reports</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Avg Severity: <span className="font-medium text-foreground">{avgSeverity.toFixed(1)} / 4</span></p>
                    <p className="text-xs text-muted-foreground">Updated: {new Date(h.last_updated).toLocaleDateString()}</p>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </AnimatedPage>
  );
};

export default Hotspots;
