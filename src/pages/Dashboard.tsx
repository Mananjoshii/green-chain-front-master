import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useCitizenStats } from "@/hooks/useReports";
import { useTokenTransactions } from "@/hooks/useTokens";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedPage, staggerContainer, fadeInUp } from "@/components/AnimatedPage";
import { StatCard } from "@/components/GlassCard";
import { FileText, CheckCircle2, Coins, Plus, Trash2, Wind } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar
} from "recharts";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

const Dashboard = () => {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useCitizenStats();
  const { data: transactions, isLoading: txLoading } = useTokenTransactions();
  const { t } = useTranslation();

  // Derived environmental metrics
  const pendingReports = Math.max(0, (stats?.totalReports || 0) - (stats?.resolvedReports || 0));

  const pieData = [
    { name: t('dashboard.resolved', 'Resolved'), value: stats?.resolvedReports || 0, color: "#10b981" },
    { name: t('dashboard.pending', 'Pending'), value: pendingReports, color: "#f59e0b" },
  ];

  // Process transactions for Area chart
  const chartData = [...(transactions || [])]
    .reverse()
    .slice(-10)
    .map((tx) => ({
      date: format(new Date(tx.created_at), "MMM dd"),
      tokens: Number(tx.tokens),
    }));

  const statCards = [
    { label: t('dashboard.total_reports', 'Total Reports'), value: stats?.totalReports ?? 0, icon: FileText, iconBg: "bg-primary/10", iconColor: "text-primary" },
    { label: t('dashboard.resolved', 'Resolved'), value: stats?.resolvedReports ?? 0, icon: CheckCircle2, iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
    { label: t('dashboard.tokens_earned', 'Tokens Earned'), value: stats?.tokensEarned ?? 0, icon: Coins, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
  ];

  const categoryData = Object.entries(stats?.categoryCounts || {})
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
    .sort((a, b) => b.value - a.value);

  return (
    <AnimatedPage className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('dashboard.welcome', { name: user?.fullName || "Citizen" })}</h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle', 'Your NammaWaste impact dashboard')}</p>
        </div>
        <Link to="/report/new">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
            <Button className="gap-2 shadow-md"><Plus className="h-4 w-4" /> {t('dashboard.report_waste_btn', 'Report Waste')}</Button>
          </motion.div>
        </Link>
      </div>

      {/* High-level Stats */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 md:grid-cols-3">
        {statCards.map((s) => (
          <motion.div key={s.label} variants={fadeInUp}>
            {statsLoading ? (
              <Skeleton className="h-28 rounded-2xl" />
            ) : (
              <StatCard icon={s.icon} label={s.label} value={s.value} iconBg={s.iconBg} iconColor={s.iconColor} />
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Analytics Section */}
      <motion.div variants={fadeInUp} initial="initial" animate="animate" className="grid gap-6 md:grid-cols-5">
        
        {/* Left Column: Impact & Pie Chart */}
        <div className="md:col-span-2 space-y-6">
          <Card className="glass border-white/40 dark:border-white/10 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-muted-foreground">{t('dashboard.reports_by_category', 'Reports by Category')}</CardTitle>
            </CardHeader>
            <CardContent className="h-[200px]">
              {statsLoading ? (
                <Skeleton className="h-full w-full rounded-2xl" />
              ) : categoryData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">{t('dashboard.no_reports', 'No reports yet.')}</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "currentColor", opacity: 0.7 }} axisLine={false} tickLine={false} width={90} className="capitalize" />
                    <RechartsTooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="value" name="Reports" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="glass border-white/40 dark:border-white/10 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-muted-foreground">{t('dashboard.report_resolution_rate', 'Report Resolution Rate')}</CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] flex flex-col items-center justify-center relative">
              {statsLoading ? (
                <Skeleton className="h-48 w-48 rounded-full" />
              ) : stats?.totalReports === 0 ? (
                <div className="text-center text-muted-foreground">
                  <PieChart className="mx-auto mb-2 opacity-20" size={48} />
                  <p>{t('dashboard.no_reports_submitted', 'No reports submitted yet.')}</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {!statsLoading && stats?.totalReports !== 0 && (
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none mt-4">
                  <span className="text-2xl font-bold">{Math.round(((stats?.resolvedReports || 0) / (stats?.totalReports || 1)) * 100)}%</span>
                  <span className="text-xs text-muted-foreground">{t('dashboard.resolved', 'Resolved')}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Area Chart */}
        <Card className="glass border-white/40 dark:border-white/10 shadow-lg md:col-span-3">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-muted-foreground">{t('dashboard.token_earnings', 'Token Earnings Over Time')}</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            {txLoading ? (
              <Skeleton className="h-full w-full rounded-2xl" />
            ) : chartData.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground space-y-4">
                <Coins className="h-12 w-12 opacity-20" />
                <p>{t('dashboard.no_earnings', 'No earnings history available.')}</p>
                <Link to="/report/new">
                  <Button variant="outline" size="sm" className="mt-2 text-primary border-primary/20">{t('dashboard.submit_to_earn', 'Submit a report to earn tokens')}</Button>
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "currentColor", opacity: 0.7 }} tickLine={false} axisLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 12, fill: "currentColor", opacity: 0.7 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: '#000' }}
                    itemStyle={{ color: '#10b981', fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="tokens" name="Tokens Earned" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTokens)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </motion.div>
    </AnimatedPage>
  );
};

export default Dashboard;
