import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useMyReports } from "@/hooks/useReports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedPage, staggerContainer, fadeInUp } from "@/components/AnimatedPage";
import { SEVERITY_COLORS, STATUS_COLORS } from "@/types";
import { Constants } from "@/integrations/supabase/types";
import type { ReportStatus, SeverityLevel } from "@/types";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MyReports = () => {
  const [status, setStatus] = useState<ReportStatus | "all">("all");
  const [severity, setSeverity] = useState<SeverityLevel | "all">("all");
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const { data, isLoading } = useMyReports({
    status: status === "all" ? undefined : status,
    severity: severity === "all" ? undefined : severity,
    page, pageSize,
  });

  const totalPages = Math.ceil((data?.count ?? 0) / pageSize);

  return (
    <AnimatedPage className="space-y-6">
      <h1 className="text-3xl font-bold">My Reports</h1>

      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v as any); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Constants.public.Enums.report_status.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(v) => { setSeverity(v as any); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            {Constants.public.Enums.severity_level.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !data?.data.length ? (
            <p className="p-12 text-center text-muted-foreground">No reports found.</p>
          ) : (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="divide-y">
              {data.data.map((r) => (
                <motion.div key={r.id} variants={fadeInUp}>
                  <Link to={`/reports/${r.id}`} className="block transition-all hover:bg-muted/50">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        {r.image_url && (
                          <img src={r.image_url} alt="" className="h-12 w-12 rounded-lg object-cover shadow-sm" />
                        )}
                        <div>
                          <p className="font-medium">{r.location_address}</p>
                          <p className="text-sm text-muted-foreground">{format(new Date(r.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.token_reward ? (
                          <Badge variant="outline" className="text-amber-600">{r.token_reward} GT</Badge>
                        ) : null}
                        <Badge className={SEVERITY_COLORS[r.severity]}>{r.severity}</Badge>
                        <Badge className={STATUS_COLORS[r.status]}>{r.status}</Badge>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </AnimatedPage>
  );
};

export default MyReports;
