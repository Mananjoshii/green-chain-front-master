import type { Tables, Enums } from "@/integrations/supabase/types";

// Re-export database row types
export type Profile = Tables<"profiles">;
export type VerificationStatus = 'not_started' | 'pending' | 'confirmed' | 'failed' | 'manual_review';

export type Report = Tables<"reports"> & {
  resolution_image_url?: string | null;
  resolution_image_path?: string | null;
  resolution_submitted_at?: string | null;
  resolution_submitted_by?: string | null;
  verification_status?: VerificationStatus | null;
  verification_score?: number | null;
  verification_reasoning?: string | null;
  verification_ran_at?: string | null;
  token_minted?: boolean | null;
  // GIS fields (added by ward detection pipeline)
  ward_id?: string | null;
  ward_no?: number | null;
  detected_ward_name?: string | null;
};
export type ReportEvent = Tables<"report_events">;
export type Hotspot = Tables<"hotspots">;
export type TokenTransaction = Tables<"token_transactions">;
export type UserRole = Tables<"user_roles">;

// ── GIS Types ────────────────────────────────────────────────────────────────

export interface Ward {
  id: string;
  ward_no: number;
  ward_name: string;
  zone_name: string | null;
  centroid_lat: number;
  centroid_lng: number;
}

export interface WardContacts {
  ward_no: number;
  ward_name: string;
  zone_name: string | null;
  assembly_constituency: string | null;
  jc_name: string | null;
  jc_phone: string | null;
  dc_name: string | null;
  dc_phone: string | null;
  se_name: string | null;
  se_phone: string | null;
  ce_name: string | null;
  ce_phone: string | null;
  ee_name: string | null;
  ee_phone: string | null;
  aee_name: string | null;
  aee_phone: string | null;
  ae_name: string | null;
  ae_phone: string | null;
  jr_health_inspector_name: string | null;
  jr_health_inspector_phone: string | null;
  sr_health_inspector_name: string | null;
  sr_health_inspector_phone: string | null;
  ro_name: string | null;
  ro_phone: string | null;
  aro_name: string | null;
  aro_phone: string | null;
  animal_husbandry_name: string | null;
  animal_husbandry_phone: string | null;
}

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
