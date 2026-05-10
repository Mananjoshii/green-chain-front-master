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
import { ChevronLeft, ChevronRight, Clock, Image as ImageIcon } from "lucide-react";

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Reports</h1>

        <div className="flex flex-wrap gap-3">
          <Select value={status} onValueChange={(v) => { setStatus(v as any); setPage(0); }}>
            <SelectTrigger className="w-36 bg-background/50 backdrop-blur-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Constants.public.Enums.report_status.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={(v) => { setSeverity(v as any); setPage(0); }}>
            <SelectTrigger className="w-36 bg-background/50 backdrop-blur-sm"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              {Constants.public.Enums.severity_level.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-[340px] w-full rounded-xl" />
          ))}
        </div>
      ) : !data?.data.length ? (
        <Card className="glass overflow-hidden border-dashed">
          <CardContent className="p-16 text-center flex flex-col items-center justify-center min-h-[400px]">
            <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
              <ImageIcon className="h-10 w-10 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No reports found</h3>
            <p className="text-muted-foreground max-w-md">We couldn't find any reports matching your current filters. Try adjusting your search criteria.</p>
            {(status !== "all" || severity !== "all") && (
              <Button variant="outline" className="mt-6" onClick={() => { setStatus("all"); setSeverity("all"); }}>
                Clear All Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.data.map((r) => (
            <motion.div key={r.id} variants={fadeInUp} className="h-full">
              <Link to={`/reports/${r.id}`} className="block h-full group">
                <Card className="h-full glass hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col hover:-translate-y-1 border-white/40 dark:border-white/10">
                  <div className="w-full h-48 overflow-hidden relative bg-muted/40">
                    {r.image_url ? (
                      <img src={r.image_url} alt="Report image" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700 ease-out" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground opacity-30" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                      <Badge className={`${STATUS_COLORS[r.status]} shadow-sm backdrop-blur-md`}>{r.status}</Badge>
                      <Badge className={`${SEVERITY_COLORS[r.severity]} shadow-sm backdrop-blur-md`}>{r.severity}</Badge>
                    </div>
                  </div>
                  
                  <CardContent className="p-5 flex flex-col flex-grow">
                    <h3 className="font-semibold text-base line-clamp-2 leading-snug group-hover:text-primary transition-colors duration-300 mb-3">
                      {r.location_address || "Unknown Location"}
                    </h3>
                    
                    <div className="mt-auto space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(r.created_at), "MMM d, yyyy")}
                        </div>
                        {r.token_reward ? (
                          <Badge variant="outline" className="text-amber-600 bg-amber-500/10 border-amber-500/20 font-semibold px-2 py-0.5">
                            +{r.token_reward} GT
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}

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
