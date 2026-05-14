import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useMunicipalReports, useMunicipalResolveReport, useUpdateReportStatus, useUpdateReportAdmin } from "@/hooks/useReports";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SEVERITY_COLORS, STATUS_COLORS } from "@/types";
import type { ReportStatus, SeverityLevel } from "@/types";
import { Constants } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, CheckCircle2, AlertTriangle, MapPin, Search, Users, Clock, Building2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useWards } from "@/hooks/useGIS";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const MunicipalDashboard = () => {
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | "all">("all");
  const [wardFilter, setWardFilter] = useState<string>("all");
  const [areaSearch, setAreaSearch] = useState("");
  const { data: reports, isLoading } = useMunicipalReports(statusFilter === "all" ? undefined : statusFilter);
  const { wards } = useWards();
  const { data: hotspots, isLoading: hotspotsLoading } = useHotspots();
  const updateStatus = useUpdateReportStatus();
  const updateAdmin = useUpdateReportAdmin();
  const resolveReport = useMunicipalResolveReport();
  const { toast } = useToast();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const filteredReports = (reports ?? []).filter((r: any) => {
    if (severityFilter !== "all" && r.severity !== severityFilter) return false;
    if (wardFilter !== "all" && String(r.ward_no) !== wardFilter) return false;
    if (areaSearch && !r.location_address.toLowerCase().includes(areaSearch.toLowerCase())) return false;
    return true;
  });

  const statusCounts = filteredReports.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name: name.replace("_", " "), value }));

  const severityCounts = filteredReports.reduce((acc, r) => {
    acc[r.severity] = (acc[r.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const severityData = Object.entries(severityCounts).map(([name, value]) => ({ name, value }));

  const CHART_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444", "#64748b"];

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

  const handleAdminUpdate = async (id: string, updates: { status?: ReportStatus; severity?: SeverityLevel }) => {
    try {
      await updateAdmin.mutateAsync({ id, updates });
      toast({ title: "Report successfully updated." });
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
            {wards.length > 0 && (
              <Select value={wardFilter} onValueChange={setWardFilter}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Filter by Ward" /></SelectTrigger>
                <SelectContent className="max-h-64 overflow-y-auto">
                  <SelectItem value="all">All Wards</SelectItem>
                  {wards.map((w) => (
                    <SelectItem key={w.ward_no} value={String(w.ward_no)}>
                      Ward {w.ward_no} — {w.ward_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 mb-4">
            <Card className="glass border-white/40 dark:border-white/10">
              <CardContent className="h-[220px] pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="glass border-white/40 dark:border-white/10">
              <CardContent className="h-[220px] pt-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={severityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} className="capitalize" />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px' }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {severityData.map((entry, i) => {
                        const color = entry.name === "critical" ? "#ef4444" : entry.name === "high" ? "#f97316" : entry.name === "medium" ? "#eab308" : "#22c55e";
                        return <Cell key={i} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="glass overflow-hidden">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : !filteredReports.length ? (
                <p className="p-12 text-center text-muted-foreground">No reports match your filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Location &amp; Details</TableHead>
                        <TableHead>Ward</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Severity Override</TableHead>
                        <TableHead>Status Override</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((r) => (
                        <TableRow key={r.id} className="transition-colors hover:bg-muted/30">
                          <TableCell className="max-w-[200px] lg:max-w-xs truncate">
                            <Link to={`/reports/${r.id}`} className="hover:underline font-medium block truncate text-primary">{r.location_address}</Link>
                            <span className="text-xs text-muted-foreground truncate block mt-0.5">{r.description}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {(r as any).ward_no ? (
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-primary">W{(r as any).ward_no}</span>
                                <span className="text-xs text-muted-foreground truncate max-w-[100px]">{(r as any).detected_ward_name ?? ""}</span>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                            {format(new Date(r.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={r.severity} 
                              onValueChange={(v) => handleAdminUpdate(r.id, { severity: v as SeverityLevel })}
                            >
                              <SelectTrigger className={`w-[130px] h-8 text-xs font-semibold ${SEVERITY_COLORS[r.severity]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Constants.public.Enums.severity_level.map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={r.status} 
                              onValueChange={(v) => handleAdminUpdate(r.id, { status: v as ReportStatus })}
                            >
                              <SelectTrigger className={`w-[140px] h-8 text-xs font-semibold ${STATUS_COLORS[r.status]}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Constants.public.Enums.report_status
                                  .filter(s => s !== "resolved" || r.status === "resolved")
                                  .map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex justify-end items-center gap-2">
                              {(r.status === "assigned" || r.status === "in_progress") && (
                                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="inline-block">
                                  <Button size="sm" onClick={() => handleAction(r.id, "resolved")} disabled={updateStatus.isPending || resolveReport.isPending || updateAdmin.isPending} className="h-8">
                                    Resolve & Reward
                                  </Button>
                                </motion.div>
                              )}
                              <Link to={`/reports/${r.id}`}>
                                <Button size="sm" variant="outline" className="h-8">View</Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
