import { useParams } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { useReport, useReportEvents } from "@/hooks/useReports";
import { apiClient } from "@/services/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedPage, staggerContainer, fadeInUp } from "@/components/AnimatedPage";
import { AGENT_LABELS, AGENT_ORDER, SEVERITY_COLORS, STATUS_COLORS } from "@/types";
import type { AgentType, AgentStageStatus } from "@/types";
import { format } from "date-fns";
import { CheckCircle2, Clock, Loader2, XCircle, MapPin, Calendar, Play, FileText, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { ResolutionUploadPanel } from "@/components/ResolutionUploadPanel";
import { BeforeAfterPanel } from "@/components/BeforeAfterPanel";
import { ManualVerifyPanel } from "@/components/ManualVerifyPanel";

const stageIcon: Record<AgentStageStatus, React.ReactNode> = {
  pending: <Clock className="h-5 w-5 text-muted-foreground" />,
  processing: <Loader2 className="h-5 w-5 animate-spin text-primary" />,
  completed: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
  failed: <XCircle className="h-5 w-5 text-destructive" />,
};

const stageBorder: Record<AgentStageStatus, string> = {
  pending: "border-border",
  processing: "border-primary shadow-md shadow-primary/20",
  completed: "border-emerald-400",
  failed: "border-destructive",
};

const customEventLabels: Record<string, { icon: string; text: string }> = {
  resolution_photo_submitted: { icon: '📷', text: 'Officer submitted resolution photo — AI verifying' },
  verification_confirmed:     { icon: '✅', text: 'AI verified — area confirmed clean' },
  verification_failed:        { icon: '❌', text: 'Verification failed — report re-opened' },
  verification_manual_review: { icon: '👁', text: 'Flagged for manual review by supervisor' },
};

const ReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading, refetch: refetchReport } = useReport(id!);
  const { data: events, refetch: refetchEvents } = useReportEvents(id!);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isOfficerOrAdmin = user?.roles?.some(r => r === 'municipal_officer' || r === 'admin');
  const isPlannerOrAdmin = user?.roles?.some(r => r === 'city_planner' || r === 'admin');

  const runPipeline = async () => {
    setProcessing(true);
    try {
      await apiClient.post(`/reports/${id}/process`);
      toast({ title: "Pipeline started", description: "AI agents are now processing your report." });
      refetchReport();
      refetchEvents();
    } catch (err: any) {
      toast({
        title: "Pipeline failed",
        description: err.message ?? "Could not start pipeline. Is the backend running?",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const eventMap = new Map<AgentType | string, { status: AgentStageStatus | string; message?: string | null; time?: string; metadata?: Record<string, unknown> | null }>();
  events?.forEach((e) => {
    // Some events might just have event_type instead of agent_type if they are custom timeline events
    // We inserted custom event_type in backend, but it's saved in agent_type column due to schema limits
    eventMap.set(e.agent_type, { status: e.stage_status, message: e.message, time: e.created_at, metadata: e.metadata as Record<string, unknown> | null });
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!report) return <p className="py-12 text-center text-muted-foreground">Report not found.</p>;

  return (
    <AnimatedPage className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card/40 p-6 rounded-2xl border shadow-sm backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="z-10">
          <h1 className="text-3xl font-bold tracking-tight">Report Details</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-2">
            <span className="font-mono text-xs bg-background border px-2 py-1 rounded-md shadow-sm">ID: {report.id}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 z-10">
          <Badge className={`${SEVERITY_COLORS[report.severity]} px-3 py-1 text-sm shadow-sm`}>{report.severity}</Badge>
          <Badge className={`${STATUS_COLORS[report.status] || "bg-gray-100 text-gray-800"} px-3 py-1 text-sm shadow-sm`}>{report.status.replace('_', ' ')}</Badge>
          {report.status === "pending" && (
            <Button onClick={runPipeline} disabled={processing} className="gap-2 shadow-md transition-all hover:-translate-y-0.5 ml-2">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
              Run Pipeline
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass flex flex-col h-full border-white/40 dark:border-white/10 hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <CardTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-5">
               <div className="flex items-start gap-4">
                 <div className="mt-0.5 bg-primary/10 p-2.5 rounded-full"><MapPin className="h-5 w-5 text-primary" /></div>
                 <div>
                   <p className="font-medium text-base">{report.location_address}</p>
                   {report.latitude && report.longitude && (
                     <p className="text-xs text-muted-foreground mt-1.5 font-mono bg-muted inline-block px-2 py-0.5 rounded">
                       {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                     </p>
                   )}
                 </div>
               </div>
               
               <div className="flex items-center gap-4">
                 <div className="bg-primary/10 p-2.5 rounded-full"><Calendar className="h-5 w-5 text-primary" /></div>
                 <div>
                   <p className="font-medium">{format(new Date(report.created_at), "PPP 'at' p")}</p>
                 </div>
               </div>

               <div className="flex items-center gap-4">
                 <div className="bg-primary/10 p-2.5 rounded-full"><Tag className="h-5 w-5 text-primary" /></div>
                 <div>
                   <p className="font-medium capitalize">{report.category.replace("_", " ")}</p>
                   <p className="text-xs text-muted-foreground">Category</p>
                 </div>
               </div>
            </div>

            <div className="pt-5 border-t">
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Description</h4>
              <p className="text-sm leading-relaxed bg-muted/30 p-4 rounded-lg border border-white/20">{report.description}</p>
            </div>

            {report.token_reward ? (
              <div className="pt-4 border-t flex items-center justify-between">
                 <span className="font-semibold text-muted-foreground">Reward</span>
                 <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200 text-base py-1 px-3 shadow-sm">
                    +{report.token_reward} GT
                 </Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {report.image_url && (
          <Card className="glass overflow-hidden h-full flex flex-col hover:shadow-lg transition-all duration-300 group border-white/40 dark:border-white/10">
            <CardHeader className="pb-4 border-b bg-muted/20 hidden md:block opacity-0 invisible h-0 p-0 m-0"></CardHeader>
            <CardContent className="p-0 flex-grow relative bg-muted/20">
              <img src={report.image_url} alt="Waste report" className="w-full h-full object-cover min-h-[300px] md:min-h-[400px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </CardContent>
          </Card>
        )}
      </div>

      {report.status === 'in_progress' && isOfficerOrAdmin && (
        <ResolutionUploadPanel reportId={report.id} />
      )}

      {report.verification_status === 'manual_review' && isPlannerOrAdmin && report.resolution_image_url && report.image_url && (
        <ManualVerifyPanel 
          reportId={report.id} 
          beforeImageUrl={report.image_url}
          afterImageUrl={report.resolution_image_url}
          aiReasoning={report.verification_reasoning}
          aiConfidence={report.verification_score}
        />
      )}

      {report.resolution_image_url && report.image_url && (
        <BeforeAfterPanel 
          beforeImageUrl={report.image_url}
          afterImageUrl={report.resolution_image_url}
          reportedAt={report.created_at}
          resolvedAt={report.resolution_submitted_at}
          verificationStatus={report.verification_status}
          verificationScore={report.verification_score}
          verificationReasoning={report.verification_reasoning}
          tokenAmount={report.token_reward}
        />
      )}

      {/* AI Agent Pipeline */}
      <Card className="glass border-white/40 dark:border-white/10 hover:shadow-lg transition-shadow duration-300 mt-8">
        <CardHeader className="pb-4 border-b bg-muted/10">
          <CardTitle className="text-xl flex items-center gap-2">
            <Loader2 className="h-5 w-5 text-primary" /> AI Agent Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-0">
            {AGENT_ORDER.map((agent, i) => {
              const event = eventMap.get(agent);
              const status = event?.status as AgentStageStatus ?? "pending";
              return (
                <motion.div key={agent} variants={fadeInUp} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={status === "processing" ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                      transition={status === "processing" ? { duration: 1.5, repeat: Infinity } : { duration: 0.3 }}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card ${stageBorder[status]}`}
                    >
                      {stageIcon[status]}
                    </motion.div>
                    {/* Render line except for last item */}
                    {i < AGENT_ORDER.length - 1 && (
                      <div className={`h-8 w-0.5 ${status === "completed" ? "bg-emerald-400" : "bg-border"}`} />
                    )}
                  </div>
                  <div className="pb-6">
                    <p className="font-medium">{AGENT_LABELS[agent]}</p>
                    <p className="text-sm text-muted-foreground capitalize">{status}</p>
                    {event?.message && <p className="mt-1 text-sm">{event.message}</p>}
                    {agent === "geo_intelligence" && event?.metadata?.ward_name && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                        📍 Ward: {String(event.metadata.ward_name)}
                      </span>
                    )}
                    {agent === "geo_intelligence" && event?.metadata && event.metadata.ward_name === null && status === "completed" && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        📍 Outside monitored wards
                      </span>
                    )}
                    {event?.time && <p className="text-xs text-muted-foreground">{format(new Date(event.time), "h:mm a")}</p>}
                  </div>
                </motion.div>
              );
            })}
            {/* Custom events renderer */}
            {Object.keys(customEventLabels).map((eventName) => {
              const customEvent = eventMap.get(eventName);
              if (!customEvent) return null;
              const label = customEventLabels[eventName];
              
              return (
                <motion.div key={eventName} variants={fadeInUp} className="flex gap-4">
                  <div className="flex flex-col items-center">
                     <div className="h-8 w-0.5 bg-border -mt-6" />
                     <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 bg-card border-border">
                        <span className="text-sm">{label.icon}</span>
                     </div>
                  </div>
                  <div className="pb-6 pt-2">
                    <p className="font-medium">{label.text}</p>
                    {customEvent.time && <p className="text-xs text-muted-foreground">{format(new Date(customEvent.time), "PPpp")}</p>}
                    {customEvent.message && <p className="mt-1 text-sm text-muted-foreground">{customEvent.message}</p>}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </CardContent>
      </Card>
    </AnimatedPage>
  );
};

export default ReportDetail;
