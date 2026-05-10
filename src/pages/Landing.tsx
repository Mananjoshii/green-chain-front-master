import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Leaf, MapPin, Search, AlertTriangle, AlertCircle, Info, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useHotspots } from "@/hooks/useHotspots";

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

const Landing = () => {
  const { t } = useTranslation();
  const { data: hotspots, isLoading } = useHotspots();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredHotspots = hotspots?.filter(h => 
    h.area_name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  useEffect(() => {
    if (isLoading || !mapContainerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    
    // Default to Bengaluru or a central point if no hotspots
    const center: [number, number] = hotspots?.length ? [hotspots[0].latitude, hotspots[0].longitude] : [12.9716, 77.5946];
    const map = L.map(mapContainerRef.current, {
      zoomControl: false // We will add it manually or rely on default position
    }).setView(center, 12);
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { 
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const childMarkers = cluster.getAllChildMarkers();
        let totalReports = 0;
        let weightedSeveritySum = 0;
        
        childMarkers.forEach((marker: any) => {
          const rc = marker.options.reportCount || 0;
          const sev = marker.options.avgSeverity || 0;
          totalReports += rc;
          weightedSeveritySum += (rc * sev);
        });

        const avgSeverity = totalReports > 0 ? weightedSeveritySum / totalReports : 0;
        const { fill } = zoneColor(avgSeverity);

        const size = clamp(36 + Math.log2(Math.max(totalReports, 1)) * 4, 36, 60);
        const iconHtml = `<div style="background-color: ${fill}; border: 3px solid rgba(255,255,255,0.9); color: white; border-radius: 50%; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 15px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.2);">${totalReports}</div>`;
        
        return L.divIcon({
          html: iconHtml,
          className: 'custom-cluster-icon',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        });
      }
    });

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
        fillOpacity: clamp(0.4 + avgSeverity / 10 + Math.min(0.2, count / 200), 0.4, 0.8),
      })
        .addTo(map)
        .bindPopup(
          `<div>` +
            `<p style="font-weight:600">${h.area_name}</p>` +
            `<p>${count} reports</p>` +
            `<p>Avg severity: ${avgSeverity.toFixed(1)}</p>` +
            `</div>`
        );

      const iconHtml = `<div style="background-color: ${fill}; border: 2px solid white; color: white; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">${count}</div>`;
      
      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-leaflet-icon',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([h.latitude, h.longitude], { 
        icon: customIcon,
        reportCount: count,
        avgSeverity: avgSeverity
      } as any);
      
      marker.bindPopup(`<div><p style="font-weight:600">${h.area_name}</p><p>${count} reports</p><p>Avg severity: ${avgSeverity.toFixed(1)}</p></div>`);
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; };
  }, [isLoading, hotspots]);

  // Navigate to location when clicking a hotspot card
  const flyToHotspot = (lat: number, lng: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo([lat, lng], 15, { duration: 1.5 });
    }
  };

  const handleReportWaste = () => {
    if (user) {
      navigate('/report/new');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Navbar */}
      <header className="flex-none z-50 glass border-b shadow-sm relative">
        <div className="flex h-16 w-full items-center justify-between px-4 lg:px-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="eco-gradient-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>EcoChain</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
            <Link to="/login" className="hidden sm:inline-flex">
              <Button variant="outline" size="sm">{t('nav.municipal_login', 'Municipal Login')}</Button>
            </Link>
            {!user && (
              <Link to="/signup">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
                  <Button size="sm">{t('nav.get_started', 'Get Started')}</Button>
                </motion.div>
              </Link>
            )}
            {user && (
              <Link to="/dashboard">
                <Button size="sm" variant="secondary">{t('nav.dashboard', 'Dashboard')}</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Sidebar */}
        <div className="w-full md:w-[400px] lg:w-[450px] bg-card flex flex-col border-r shadow-lg z-10 flex-shrink-0 h-full">
          {/* Sidebar Header & Search */}
          <div className="p-4 border-b space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={t('landing.search_placeholder', "Search by area name...")}
                className="pl-9 bg-background/50" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* WhatsApp Banner (Optional/Mock as per UI reference) */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-lg p-3 flex items-start gap-3 relative">
              <div className="bg-emerald-500 rounded-full p-1.5 flex-shrink-0 mt-0.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-white fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
              </div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                {t('landing.report_whatsapp', "Report via WhatsApp!")} <span className="font-normal text-emerald-700 dark:text-emerald-400">{t('landing.report_whatsapp_desc', "Send a photo to get started instantly.")}</span>
              </p>
              <button className="absolute top-2 right-2 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* List Header */}
          <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
            <h2 className="font-bold text-lg">{t('landing.hotspots', 'Hotspots')}</h2>
            <span className="text-sm text-muted-foreground">{hotspots?.length || 0} {t('landing.total', 'total')}</span>
          </div>

          {/* Scrollable List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))
            ) : filteredHotspots.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
                <AlertCircle className="h-10 w-10 mb-3 opacity-20" />
                <p>{t('landing.no_hotspots', 'No hotspots found matching your search.')}</p>
              </div>
            ) : (
              filteredHotspots.map((h) => {
                const avgSeverity = Number(h.avg_severity ?? 0);
                const { fill } = zoneColor(avgSeverity);
                return (
                  <motion.div 
                    key={h.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => flyToHotspot(h.latitude, h.longitude)}
                    className="p-3 border rounded-xl bg-card hover:bg-accent/50 cursor-pointer transition-colors shadow-sm group flex items-start gap-4"
                  >
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full font-bold text-white shadow-inner" style={{ backgroundColor: fill }}>
                      {h.report_count}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-sm truncate pr-2">{h.area_name}</h3>
                        <Badge variant="secondary" className="text-[10px] whitespace-nowrap bg-muted">
                          {t('landing.severity', 'Severity')}: {avgSeverity.toFixed(1)}
                        </Badge>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{h.latitude.toFixed(4)}, {h.longitude.toFixed(4)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Info className="h-3 w-3" /> {t('landing.updated', 'Updated')} {new Date(h.last_updated).toLocaleDateString()}
                        </div>
                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Sticky Bottom Action */}
          <div className="p-4 border-t bg-card/95 backdrop-blur-sm shadow-[0_-4px_10px_rgba(0,0,0,0.05)] relative z-20">
            <Button 
              size="lg" 
              className="w-full gap-2 bg-destructive hover:bg-destructive/90 text-white font-bold h-14 text-lg"
              onClick={handleReportWaste}
            >
              <AlertTriangle className="h-5 w-5" /> {t('landing.report_waste_btn', 'Report Waste')}
            </Button>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative bg-muted h-full z-0">
          {isLoading ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <div ref={mapContainerRef} className="h-full w-full absolute inset-0 z-0" />
          )}
          
          {/* Floating Map Legend */}
          <div className="absolute bottom-6 left-6 z-[1000] bg-card/90 backdrop-blur-md border shadow-lg rounded-xl p-4 text-sm max-w-[200px]">
            <div className="font-bold mb-2">{t('landing.hotspot_severity', 'Hotspot Severity')}</div>
            <div className="space-y-2">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#ef4444]"></span><span>{t('landing.high', 'High')} (≥ 3.2)</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#f97316]"></span><span>{t('landing.elevated', 'Elevated')} (≥ 2.4)</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#eab308]"></span><span>{t('landing.moderate', 'Moderate')} (≥ 1.6)</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#22c55e]"></span><span>{t('landing.low', 'Low')} (&lt; 1.6)</span></div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground pt-2 border-t">{t('landing.reports_indicator', 'Numbers indicate total reports')}</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Landing;
