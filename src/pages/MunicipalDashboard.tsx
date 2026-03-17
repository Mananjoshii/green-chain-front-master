import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useMunicipalReports, useMunicipalResolveReport, useUpdateReportStatus } from "@/hooks/useReports";
import { useHotspots } from "@/hooks/useHotspots";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedPage, staggerContainer, fadeInUp } from "@/components/AnimatedPage";
import { StatCard, GlassCard } from "@/components/GlassCard";
import { SEVERITY_COLORS, STATUS_COLORS } from "@/types";
import type { ReportStatus, SeverityLevel } from "@/types";
import { Constants } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, CheckCircle2, AlertTriangle, MapPin, Search, Users, Clock } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const MunicipalDashboard = () => {
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | "all">("all");
  const [areaSearch, setAreaSearch] = useState("");
  const { data: reports, isLoading } = useMunicipalReports(statusFilter === "all" ? undefined : statusFilter);
  const { data: hotspots, isLoading: hotspotsLoading } = useHotspots();
  const updateStatus = useUpdateReportStatus();
  const resolveReport = useMunicipalResolveReport();
  const { toast } = useToast();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const filteredReports = (reports ?? []).filter((r) => {
    if (severityFilter !== "all" && r.severity !== severityFilter) return false;
    if (areaSearch && !r.location_address.toLowerCase().includes(areaSearch.toLowerCase())) return false;
    return true;
  });

  const totalPending = (reports ?? []).filter((r) => r.status === "pending" || r.status === "verified").length;
  const totalAssigned = (reports ?? []).filter((r) => r.status === "assigned" || r.status === "in_progress").length;
  const totalResolved = (reports ?? []).filter((r) => r.status === "resolved").length;
  const criticalCount = (reports ?? []).filter((r) => r.severity === "critical" && r.status !== "resolved" && r.status !== "rejected").length;

  const handleAction = async (id: string, status: ReportStatus) => {
    try {
      if (status === "resolved") {
        await resolveReport.mutateAsync({ id });
        toast({ title: "Report resolved", description: "Reward credited (if any) and report removed." });
      } else {
        await updateStatus.mutateAsync({ id, status });
        toast({ title: `Report ${status.replace("_", " ")}` });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    if (hotspotsLoading || !mapContainerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    const center: [number, number] = hotspots?.length ? [hotspots[0].latitude, hotspots[0].longitude] : [22.7196, 75.8577];
    const map = L.map(mapContainerRef.current).setView(center, 12);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    hotspots?.forEach((h) => {
      const avgSeverity = Number(h.avg_severity ?? 0);
      const color = avgSeverity >= 3 ? "#ef4444" : avgSeverity >= 2 ? "#f59e0b" : "#22c55e";
      L.circleMarker([h.latitude, h.longitude], { radius: Math.max(8, h.report_count * 3), fillColor: color, color, weight: 2, opacity: 0.8, fillOpacity: 0.4 })
        .addTo(map).bindPopup(`<div><p style="font-weight:600">${h.area_name}</p><p>${h.report_count} reports</p><p>Avg severity: ${avgSeverity.toFixed(1)}</p></div>`);
    });
    setTimeout(() => map.invalidateSize(), 100);
    return () => { map.remove(); mapRef.current = null; };
  }, [hotspotsLoading, hotspots]);

  return (
    <AnimatedPage className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Municipal Dashboard</h1>
        <p className="text-muted-foreground">Manage waste reports and monitor hotspots</p>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={fadeInUp}><StatCard icon={Clock} label="Needs Action" value={totalPending} iconBg="bg-amber-100" iconColor="text-amber-700" /></motion.div>
        <motion.div variants={fadeInUp}><StatCard icon={Users} label="Assigned" value={totalAssigned} iconBg="bg-violet-100" iconColor="text-violet-700" /></motion.div>
        <motion.div variants={fadeInUp}><StatCard icon={CheckCircle2} label="Resolved" value={totalResolved} iconBg="bg-emerald-100" iconColor="text-emerald-700" /></motion.div>
        <motion.div variants={fadeInUp}><StatCard icon={AlertTriangle} label="Critical Open" value={criticalCount} iconBg="bg-red-100" iconColor="text-red-700" /></motion.div>
      </motion.div>

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports" className="gap-2"><ClipboardList className="h-4 w-4" /> Reports</TabsTrigger>
          <TabsTrigger value="hotspots" className="gap-2"><MapPin className="h-4 w-4" /> Hotspot Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by ward/area..." className="pl-9 w-64 transition-shadow focus:shadow-md focus:shadow-primary/10" value={areaSearch} onChange={(e) => setAreaSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Constants.public.Enums.report_status.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as any)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                {Constants.public.Enums.severity_level.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card className="glass overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : !filteredReports.length ? (
                <p className="p-12 text-center text-muted-foreground">No reports match your filters.</p>
              ) : (
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="divide-y">
                  {filteredReports.map((r) => (
                    <motion.div key={r.id} variants={fadeInUp} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
                      <Link to={`/reports/${r.id}`} className="flex-1 space-y-1">
                        <p className="font-medium leading-tight">{r.location_address}</p>
                        <p className="text-sm text-muted-foreground">{r.description.slice(0, 80)}{r.description.length > 80 ? "..." : ""}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy · h:mm a")}</p>
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={SEVERITY_COLORS[r.severity]}>{r.severity}</Badge>
                        <Badge className={STATUS_COLORS[r.status]}>{r.status.replace("_", " ")}</Badge>
                        {(r.status === "pending" || r.status === "verified") && (
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button size="sm" variant="outline" onClick={() => handleAction(r.id, "assigned")} disabled={updateStatus.isPending}>Assign</Button>
                          </motion.div>
                        )}
                        {(r.status === "assigned" || r.status === "in_progress") && (
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button size="sm" onClick={() => handleAction(r.id, "resolved")} disabled={updateStatus.isPending || resolveReport.isPending}>Resolve</Button>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hotspots" className="space-y-4">
          <div className="overflow-hidden rounded-xl border shadow-sm" style={{ height: 450 }}>
            {hotspotsLoading ? <Skeleton className="h-full w-full" /> : <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />}
          </div>
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {hotspotsLoading ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />) : hotspots?.map((h) => {
              const avgSeverity = Number(h.avg_severity ?? 0);
              return (
                <motion.div key={h.id} variants={fadeInUp}>
                  <GlassCard className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><h3 className="font-semibold">{h.area_name}</h3></div>
                      <Badge variant="secondary">{h.report_count} reports</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">Avg Severity: {avgSeverity.toFixed(1)} / 4</p>
                    <p className="text-xs text-muted-foreground">Updated: {new Date(h.last_updated).toLocaleDateString()}</p>
                  </GlassCard>
                </motion.div>
              );
            })}
            {!hotspotsLoading && !hotspots?.length && <p className="col-span-full py-8 text-center text-muted-foreground">No hotspots identified yet.</p>}
          </motion.div>
        </TabsContent>
      </Tabs>
    </AnimatedPage>
  );
};

export default MunicipalDashboard;
