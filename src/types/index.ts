import type { Tables, Enums } from "@/integrations/supabase/types";

// Re-export database row types
export type Profile = Tables<"profiles">;
export type Report = Tables<"reports">;
export type ReportEvent = Tables<"report_events">;
export type Hotspot = Tables<"hotspots">;
export type TokenTransaction = Tables<"token_transactions">;
export type UserRole = Tables<"user_roles">;

// Re-export enums
export type AppRole = Enums<"app_role">;
export type ReportStatus = Enums<"report_status">;
export type WasteCategory = Enums<"waste_category">;
export type SeverityLevel = Enums<"severity_level">;
export type AgentType = Enums<"agent_type">;
export type AgentStageStatus = Enums<"agent_stage_status">;

// Extended user type for auth context
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  roles: AppRole[];
}

// API response types
export interface CitizenStats {
  totalReports: number;
  resolvedReports: number;
  tokensEarned: number;
}

export interface AdminMetrics {
  reportsByArea: { area: string; count: number }[];
  severityDistribution: { severity: string; count: number }[];
  tokensOverTime: { date: string; tokens: number }[];
  totalReports: number;
  totalResolved: number;
  totalTokens: number;
}

export const AGENT_LABELS: Record<AgentType, string> = {
  waste_verification: "Waste Verification Agent",
  geo_intelligence: "Geo-Intelligence Agent",
  municipal_coordination: "Municipal Coordination Agent",
  reward_optimization: "Reward Optimization Agent",
  fraud_detection: "Fraud Detection Agent",
};

export const AGENT_ORDER: AgentType[] = [
  "waste_verification",
  "geo_intelligence",
  "municipal_coordination",
  "reward_optimization",
  "fraud_detection",
];

export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  verified: "bg-blue-100 text-blue-800",
  assigned: "bg-purple-100 text-purple-800",
  in_progress: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
};
