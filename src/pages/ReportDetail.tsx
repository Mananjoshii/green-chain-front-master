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
import { CheckCircle2, Clock, Loader2, XCircle, MapPin, Calendar, Play } from "lucide-react";
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

  const eventMap = new Map<AgentType | string, { status: AgentStageStatus | string; message?: string | null; time?: string }>();
  events?.forEach((e) => {
    // Some events might just have event_type instead of agent_type if they are custom timeline events
    // We inserted custom event_type in backend, but it's saved in agent_type column due to schema limits
    eventMap.set(e.agent_type, { status: e.stage_status, message: e.message, time: e.created_at });
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64 w-full" /></div>;
  if (!report) return <p className="py-12 text-center text-muted-foreground">Report not found.</p>;

  return (
    <AnimatedPage className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Report Details</h1>
          <p className="text-sm text-muted-foreground">ID: {report.id.slice(0, 8)}...</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={SEVERITY_COLORS[report.severity]}>{report.severity}</Badge>
          <Badge className={STATUS_COLORS[report.status] || "bg-gray-100 text-gray-800"}>{report.status.replace('_', ' ')}</Badge>
          {report.status === "pending" && (
            <Button size="sm" onClick={runPipeline} disabled={processing} className="gap-1.5">
              {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run Pipeline
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glass">
          <CardHeader><CardTitle className="text-lg">Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span>{report.location_address}</span></div>
            {report.latitude && report.longitude && <p className="text-muted-foreground">({report.latitude}, {report.longitude})</p>}
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span>{format(new Date(report.created_at), "PPpp")}</span></div>
            <p><span className="font-medium">Category:</span> {report.category.replace("_", " ")}</p>
            <p>{report.description}</p>
            {report.token_reward ? <p className="font-medium text-amber-600">Reward: {report.token_reward} Green Tokens</p> : null}
          </CardContent>
        </Card>

        {report.image_url && (
          <Card className="glass overflow-hidden h-fit">
            <CardContent className="p-0">
              <img src={report.image_url} alt="Waste report" className="w-full object-cover" />
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
      <Card className="glass">
        <CardHeader><CardTitle className="text-lg">AI Agent Pipeline</CardTitle></CardHeader>
        <CardContent>
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
