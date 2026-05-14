import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "next-themes";
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
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [searchQuery, setSearchQuery] = useState("");

  const filteredHotspots = hotspots
    ?.filter(h => h.area_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => Number(b.report_count ?? 0) - Number(a.report_count ?? 0)) || [];

  useEffect(() => {
    if (isLoading || !mapContainerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    // Always center on Bengaluru city center
    const center: [number, number] = [12.9716, 77.5946];
    const map = L.map(mapContainerRef.current, {
      zoomControl: false // We will add it manually or rely on default position
    }).setView(center, 12);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapRef.current = map;
    const initialTileUrl = isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    tileLayerRef.current = L.tileLayer(initialTileUrl, {
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

  // Swap tile layer when theme changes (no full map reinit needed)
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    const tileUrl = isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapRef.current);
  }, [isDark]);

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
            <span className="eco-gradient-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>NammaWaste</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
            {!user && (
              <Link to="/login" className="hidden sm:inline-flex">
                <Button variant="outline" size="sm">{t('nav.sign_in', 'Sign In')}</Button>
              </Link>
            )}
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

            {/* Telegram Banner */}
            <a
              href="https://t.me/EcoChain_waste_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-sky-50 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900 rounded-lg p-3 flex items-start gap-3 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors cursor-pointer"
            >
              <div className="bg-[#2AABEE] rounded-full p-1.5 flex-shrink-0 mt-0.5">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-white fill-current">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-sky-800 dark:text-sky-300">
                Report via Telegram! <span className="font-normal text-sky-700 dark:text-sky-400">Send a photo to get started instantly.</span>
              </p>
            </a>
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
