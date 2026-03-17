import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useCitizenStats, useMyReports } from "@/hooks/useReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedPage, staggerContainer, fadeInUp } from "@/components/AnimatedPage";
import { StatCard } from "@/components/GlassCard";
import { FileText, CheckCircle2, Coins, Plus } from "lucide-react";
import { STATUS_COLORS, SEVERITY_COLORS } from "@/types";
import { format } from "date-fns";

const Dashboard = () => {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useCitizenStats();
  const { data: reportsData, isLoading: reportsLoading } = useMyReports({ pageSize: 5 });

  const statCards = [
    { label: "Total Reports", value: stats?.totalReports ?? 0, icon: FileText, iconBg: "bg-primary/10", iconColor: "text-primary" },
    { label: "Resolved", value: stats?.resolvedReports ?? 0, icon: CheckCircle2, iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
    { label: "Tokens Earned", value: stats?.tokensEarned ?? 0, icon: Coins, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
  ];

  return (
    <AnimatedPage className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Welcome, {user?.fullName || "Citizen"}</h1>
          <p className="text-muted-foreground">Your EcoChain dashboard</p>
        </div>
        <Link to="/report/new">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Report Waste</Button>
          </motion.div>
        </Link>
      </div>

      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 md:grid-cols-3">
        {statCards.map((s) => (
          <motion.div key={s.label} variants={fadeInUp}>
            {statsLoading ? (
              <Skeleton className="h-24 rounded-xl" />
            ) : (
              <StatCard icon={s.icon} label={s.label} value={s.value} iconBg={s.iconBg} iconColor={s.iconColor} />
            )}
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={fadeInUp} initial="initial" animate="animate">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Reports</CardTitle>
            <Link to="/reports">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {reportsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : !reportsData?.data.length ? (
              <p className="py-8 text-center text-muted-foreground">
                No reports yet. <Link to="/report/new" className="text-primary hover:underline">Create your first report</Link>
              </p>
            ) : (
              <div className="space-y-3">
                {reportsData.data.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.3 }}
                  >
                    <Link to={`/reports/${r.id}`} className="block">
                      <div className="flex items-center justify-between rounded-lg border p-4 transition-all hover:bg-muted/50 hover:shadow-sm hover:-translate-y-0.5">
                        <div className="space-y-1">
                          <p className="font-medium">{r.location_address}</p>
                          <p className="text-sm text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={SEVERITY_COLORS[r.severity]}>{r.severity}</Badge>
                          <Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatedPage>
  );
};

export default Dashboard;
