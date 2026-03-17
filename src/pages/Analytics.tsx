import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedPage, staggerContainer, fadeInUp } from "@/components/AnimatedPage";
import { StatCard, GlassCard } from "@/components/GlassCard";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { Mic, BarChart3, Wifi, TrendingUp, Clock, CheckCircle2, AlertTriangle, MapPin } from "lucide-react";
import { differenceInHours } from "date-fns";

const CHART_COLORS = ["hsl(152, 60%, 36%)", "hsl(38, 92%, 50%)", "hsl(200, 80%, 55%)", "hsl(270, 60%, 55%)", "hsl(0, 72%, 60%)", "hsl(82, 70%, 55%)"];
const SEVERITY_COLORS: Record<string, string> = { low: "hsl(152, 60%, 36%)", medium: "hsl(38, 92%, 50%)", high: "hsl(25, 95%, 53%)", critical: "hsl(0, 72%, 60%)" };

function useAnalyticsData() {
  return useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const { data: reports, error } = await supabase.from("reports").select("location_address, severity, status, token_reward, created_at, updated_at, category");
      if (error) throw error;
      const all = reports ?? [];
      const byArea: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      const byMonth: Record<string, number> = {};
      const resolutionTimes: number[] = [];

      all.forEach((r) => {
        const area = r.location_address?.split(",")[0]?.trim() || "Unknown";
        byArea[area] = (byArea[area] || 0) + 1;
        bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
        byCategory[r.category] = (byCategory[r.category] || 0) + 1;
        const month = r.created_at.slice(0, 7);
        byMonth[month] = (byMonth[month] || 0) + (Number(r.token_reward) || 0);
        if (r.status === "resolved" && r.updated_at) resolutionTimes.push(differenceInHours(new Date(r.updated_at), new Date(r.created_at)));
      });

      const avgResolutionHrs = resolutionTimes.length ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) : 0;
      const totalResolved = all.filter((r) => r.status === "resolved").length;
      const resolutionRate = all.length ? Math.round((totalResolved / all.length) * 100) : 0;
      const criticalOpen = all.filter((r) => r.severity === "critical" && r.status !== "resolved" && r.status !== "rejected").length;

      return {
        reportsByArea: Object.entries(byArea).map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count).slice(0, 10),
        severityDist: Object.entries(bySeverity).map(([severity, count]) => ({ severity, count })),
        categoryDist: Object.entries(byCategory).map(([category, count]) => ({ category: category.replace("_", " "), count })),
        tokensOverTime: Object.entries(byMonth).sort().map(([date, tokens]) => ({ date, tokens })),
        totalReports: all.length, totalResolved, totalTokens: all.reduce((s, r) => s + (Number(r.token_reward) || 0), 0),
        avgResolutionHrs, resolutionRate, criticalOpen,
      };
    },
  });
}

const Analytics = () => {
  const { data, isLoading } = useAnalyticsData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">City Analytics</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <AnimatedPage className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">City Analytics</h1>
        <p className="mt-1 text-muted-foreground">Overview of waste management metrics across the city</p>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div variants={fadeInUp}><StatCard icon={TrendingUp} label="Total Reports" value={data?.totalReports ?? 0} /></motion.div>
        <motion.div variants={fadeInUp}><StatCard icon={CheckCircle2} label="Resolved" value={`${data?.totalResolved ?? 0}`} sub={`${data?.resolutionRate ?? 0}% resolution rate`} iconBg="bg-emerald-100" iconColor="text-emerald-700" /></motion.div>
        <motion.div variants={fadeInUp}><StatCard icon={Clock} label="Avg Resolution" value={`${data?.avgResolutionHrs ?? 0}h`} sub="Average time to resolve" iconBg="bg-sky-100" iconColor="text-sky-600" /></motion.div>
        <motion.div variants={fadeInUp}><StatCard icon={AlertTriangle} label="Critical Open" value={data?.criticalOpen ?? 0} sub="Needs immediate attention" iconBg="bg-red-100" iconColor="text-red-600" /></motion.div>
      </motion.div>

      <motion.div variants={fadeInUp} initial="initial" animate="animate">
        <GlassCard className="p-5 eco-gradient relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent" />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-foreground/80">Total Green Tokens Distributed</p>
              <p className="text-3xl font-bold text-primary-foreground">{data?.totalTokens ?? 0} GT</p>
            </div>
            <MapPin className="h-8 w-8 text-primary-foreground/40" />
          </div>
        </GlassCard>
      </motion.div>

      <Tabs defaultValue="area" className="space-y-4">
        <TabsList>
          <TabsTrigger value="area">By Area</TabsTrigger>
          <TabsTrigger value="severity">By Severity</TabsTrigger>
          <TabsTrigger value="category">By Category</TabsTrigger>
          <TabsTrigger value="tokens">Tokens Over Time</TabsTrigger>
        </TabsList>

        <TabsContent value="area">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Card className="glass">
              <CardHeader><CardTitle>Reports by Area</CardTitle><CardDescription>Top 10 areas with highest report counts</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data?.reportsByArea} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" /><YAxis dataKey="area" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip /><Bar dataKey="count" fill="hsl(152, 60%, 36%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="severity">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Card className="glass">
              <CardHeader><CardTitle>Severity Distribution</CardTitle><CardDescription>Breakdown of reports by severity level</CardDescription></CardHeader>
              <CardContent className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart><Pie data={data?.severityDist} dataKey="count" nameKey="severity" cx="50%" cy="50%" outerRadius={110} innerRadius={60} label={({ severity, percent }) => `${severity} ${(percent * 100).toFixed(0)}%`}>
                    {data?.severityDist.map((entry, i) => <Cell key={i} fill={SEVERITY_COLORS[entry.severity] || CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie><Tooltip /><Legend /></PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="category">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Card className="glass">
              <CardHeader><CardTitle>Reports by Category</CardTitle><CardDescription>Waste type distribution across all reports</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data?.categoryDist}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="category" tick={{ fontSize: 12 }} /><YAxis /><Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>{data?.categoryDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="tokens">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Card className="glass">
              <CardHeader><CardTitle>Tokens Over Time</CardTitle><CardDescription>Monthly green token distribution trend</CardDescription></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={data?.tokensOverTime}>
                    <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip />
                    <Line type="monotone" dataKey="tokens" stroke="hsl(152, 60%, 36%)" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Future Scope */}
      <div>
        <h2 className="mb-4 text-2xl font-bold">Future Scope</h2>
        <motion.div variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }} className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Mic, title: "Voice-based Multilingual Reporting", desc: "Enable citizens to report waste issues using voice commands in multiple local languages for maximum accessibility." },
            { icon: BarChart3, title: "ESG Dashboards", desc: "Environmental, Social, and Governance metrics dashboards for corporate sponsors and city governance reporting." },
            { icon: Wifi, title: "IoT Smart Bins Integration", desc: "Connected waste bins that report fill levels in real-time, enabling predictive collection scheduling." },
          ].map((item, i) => (
            <motion.div key={i} variants={fadeInUp}>
              <GlassCard className="p-6 border-dashed border h-full">
                <div className="flex items-start gap-4">
                  <motion.div whileHover={{ rotate: 12, scale: 1.1 }} transition={{ type: "spring", stiffness: 300 }} className="rounded-lg bg-muted p-2">
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                  </motion.div>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </AnimatedPage>
  );
};

export default Analytics;
