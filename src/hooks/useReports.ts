import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Report, ReportEvent, ReportStatus, SeverityLevel } from "@/types";
import { apiClient } from "@/services/api/client";

export function useMyReports(filters?: {
  status?: ReportStatus;
  severity?: SeverityLevel;
  page?: number;
  pageSize?: number;
}) {
  const { user } = useAuth();
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 10;

  return useQuery({
    queryKey: ["my-reports", user?.id, filters],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("reports")
        .select("*", { count: "exact" })
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.severity) query = query.eq("severity", filters.severity);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as Report[], count: count ?? 0 };
    },
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ["report", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Report;
    },
  });
}

export function useReportEvents(reportId: string) {
  return useQuery({
    queryKey: ["report-events", reportId],
    enabled: !!reportId,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_events")
        .select("*")
        .eq("report_id", reportId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as ReportEvent[];
    },
  });
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (report: {
      image_url?: string;
      location_address: string;
      latitude?: number;
      longitude?: number;
      category: string;
      severity: string;
      description: string;
    }) => {
      const { data, error } = await supabase
        .from("reports")
        .insert({
          ...report,
          user_id: user!.id,
          category: report.category as Report["category"],
          severity: report.severity as Report["severity"],
        })
        .select()
        .single();
      if (error) throw error;
      return data as Report;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
    },
  });
}

export function useCitizenStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["citizen-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: reports, error } = await supabase
        .from("reports")
        .select("status, token_reward")
        .eq("user_id", user!.id);
      if (error) throw error;

      const total = reports.length;
      const resolved = reports.filter((r) => r.status === "resolved").length;
      const tokens = reports.reduce((sum, r) => sum + (Number(r.token_reward) || 0), 0);
      return { totalReports: total, resolvedReports: resolved, tokensEarned: tokens };
    },
  });
}

export function useMunicipalReports(statusFilter?: ReportStatus) {
  return useQuery({
    queryKey: ["municipal-reports", statusFilter],
    queryFn: async () => {
      let query = supabase.from("reports").select("*").order("created_at", { ascending: false });
      if (statusFilter) query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as Report[];
    },
  });
}

export function useUpdateReportStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReportStatus }) => {
      const { error } = await supabase.from("reports").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["municipal-reports"] });
      queryClient.invalidateQueries({ queryKey: ["report"] });
    },
  });
}

export function useMunicipalResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      // This endpoint mints rewards (if any) and deletes the report.
      await apiClient.post(`/municipal/reports/${id}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["municipal-reports"] });
      queryClient.invalidateQueries({ queryKey: ["my-reports"] });
    },
  });
}
