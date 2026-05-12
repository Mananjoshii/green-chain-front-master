/**
 * E2E: useReports hooks
 * Tests report creation, fetching, and event polling against mocked Supabase.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// --- Supabase mock ---
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

// --- Auth mock ---
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const fakeReport = {
  id: "report-uuid-1",
  user_id: "user-1",
  category: "plastic",
  severity: "medium",
  status: "pending",
  location_address: "123 Main St",
  latitude: 22.7,
  longitude: 75.8,
  description: "Plastic waste near park",
  image_url: "https://cdn.example.com/img.jpg",
  token_reward: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const fakeEvents = [
  { id: "ev-1", report_id: "report-uuid-1", agent_type: "waste_verification", stage_status: "completed", message: "No contamination", created_at: new Date().toISOString() },
  { id: "ev-2", report_id: "report-uuid-1", agent_type: "geo_intelligence", stage_status: "processing", message: null, created_at: new Date().toISOString() },
];

function makeChain(data: unknown, count?: number) {
  const base = {
    select: () => base,
    eq: () => base,
    order: () => base,
    range: () => base,
    limit: () => base,
    single: () => Promise.resolve({ data, error: null }),
    maybeSingle: () => Promise.resolve({ data, error: null }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data, error: null }) }) }),
    then: undefined as any,
  };
  // Make it thenable for direct await (count queries)
  (base as any)[Symbol.iterator] = undefined;
  // For count queries
  Object.defineProperty(base, "then", {
    get() {
      return (resolve: Function) => resolve({ data: Array.isArray(data) ? data : [data], error: null, count: count ?? 1 });
    },
  });
  return base;
}

describe("useReports hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("useReport fetches a single report by id", async () => {
    mockFrom.mockReturnValue(makeChain(fakeReport));

    const { useReport } = await import("@/hooks/useReports");
    const { result } = renderHook(() => useReport("report-uuid-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("report-uuid-1");
    expect(result.current.data?.category).toBe("plastic");
  });

  it("useReportEvents returns events sorted by created_at", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: fakeEvents, error: null }),
        }),
      }),
    });

    const { useReportEvents } = await import("@/hooks/useReports");
    const { result } = renderHook(() => useReportEvents("report-uuid-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].agent_type).toBe("waste_verification");
    expect(result.current.data?.[1].stage_status).toBe("processing");
  });

  it("useCreateReport inserts a report and returns it", async () => {
    mockFrom.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: fakeReport, error: null }),
        }),
      }),
    });

    const { useCreateReport } = await import("@/hooks/useReports");
    const { result } = renderHook(() => useCreateReport(), { wrapper });

    const created = await result.current.mutateAsync({
      location_address: "123 Main St",
      category: "plastic",
      severity: "medium",
      description: "Plastic waste near park",
      latitude: 22.7,
      longitude: 75.8,
    });

    expect(created.id).toBe("report-uuid-1");
    expect(created.status).toBe("pending");
  });

  it("useCitizenStats aggregates totals correctly", async () => {
    const reports = [
      { status: "resolved", token_reward: 15 },
      { status: "resolved", token_reward: 20 },
      { status: "pending", token_reward: null },
    ];
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: reports, error: null }),
      }),
    });

    const { useCitizenStats } = await import("@/hooks/useReports");
    const { result } = renderHook(() => useCitizenStats(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalReports).toBe(3);
    expect(result.current.data?.resolvedReports).toBe(2);
    expect(result.current.data?.tokensEarned).toBe(35);
  });
});
