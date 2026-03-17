/**
 * E2E: Agentic AI Pipeline
 * Tests the full processReport pipeline with mocked Supabase and AI.
 * Covers: stage sequencing, event upserts, fraud detection, reward calc, geo linking.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Env } from "../env.js";

const mockEnv: Env = {
  PORT: 3001,
  API_BASE_PATH: "/api",
  CORS_ORIGIN: "http://localhost:5173",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  AI_BASE_URL: "https://api.groq.com/openai/v1",
  AI_API_KEY: "gsk_test",
  AI_VISION_MODEL: "llama-4-scout",
  AI_TEXT_MODEL: undefined,
  NODE_ENV: "test",
};

// ---- Supabase mock factory ----
type TableState = {
  reports: Record<string, any>;
  report_events: Record<string, any>;
  hotspots: Record<string, any>;
};

// Builds a chainable Supabase-like filter that always resolves to `data`
function makeFilterChain(data: any[]): any {
  const chain: any = {
    neq: () => makeFilterChain([]),
    gte: () => chain,
    lte: () => chain,
    limit: () => Promise.resolve({ data, error: null }),
  };
  return chain;
}

function makeSupabaseMock(state: TableState) {
  const from = (table: keyof TableState) => {
    const rows = () => Object.values(state[table] ?? {});

    return {
      select: (_cols?: string, _opts?: any) => ({
        eq: (col: string, val: any) => ({
          single: () => {
            const found = rows().find((r: any) => r[col] === val);
            return Promise.resolve(found ? { data: found, error: null } : { data: null, error: { message: "Not found" } });
          },
          maybeSingle: () => {
            const found = rows().find((r: any) => r[col] === val);
            return Promise.resolve({ data: found ?? null, error: null });
          },
          eq: (col2: string, val2: any) => ({
            maybeSingle: () => {
              const found = rows().find((r: any) => r[col] === val && r[col2] === val2);
              return Promise.resolve({ data: found ?? null, error: null });
            },
          }),
        }),
        // Chainable filter builder — supports arbitrary .neq/.gte/.lte/.limit chains
        neq: () => makeFilterChain([]),
        gte: () => makeFilterChain(rows()),
        order: () => ({ limit: () => Promise.resolve({ data: rows(), error: null }) }),
        limit: () => Promise.resolve({ data: rows(), error: null }),
      }),
      update: (payload: any) => ({
        eq: (col: string, val: any) => {
          const found = rows().find((r: any) => r[col] === val);
          if (found) Object.assign(found, payload);
          return Promise.resolve({ data: found, error: null });
        },
      }),
      insert: (payload: any) => {
        const id = payload.id ?? `gen-${Math.random().toString(36).slice(2)}`;
        const row = { ...payload, id };
        (state[table] as any)[id] = row;
        return {
          select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }),
          then: (resolve: Function) => resolve({ data: row, error: null }),
        };
      },
    };
  };

  return { from };
}

vi.mock("../supabase/clients.js", () => ({
  getAdminSupabase: vi.fn(),
  getAnonSupabase: vi.fn(),
}));

vi.mock("../ai/openaiCompatible.js", () => ({
  getStructuredJson: vi.fn(),
}));

import { getAdminSupabase } from "../supabase/clients.js";
import { getStructuredJson } from "../ai/openaiCompatible.js";

// ---- Geo utility (real, no mock) ----
describe("haversineMeters", () => {
  it("returns ~0 for same point", async () => {
    const { haversineMeters } = await import("../pipeline/utils/geo.js");
    expect(haversineMeters({ lat: 22.7, lng: 75.8 }, { lat: 22.7, lng: 75.8 })).toBe(0);
  });

  it("returns ~111km for 1 degree latitude difference", async () => {
    const { haversineMeters } = await import("../pipeline/utils/geo.js");
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("returns ~50m for very close points", async () => {
    const { haversineMeters } = await import("../pipeline/utils/geo.js");
    const d = haversineMeters({ lat: 22.7196, lng: 75.8577 }, { lat: 22.71964, lng: 75.85774 });
    expect(d).toBeLessThan(100);
  });
});

// ---- AI Schemas ----
describe("WasteVerificationSchema", () => {
  it("parses valid AI response", async () => {
    const { WasteVerificationSchema } = await import("../ai/schemas.js");
    const result = WasteVerificationSchema.parse({
      waste_category: "plastic",
      ai_quality_score: 0.85,
      contamination_at_source: true,
      contamination_feedback: "Plastic mixed in organic bin",
    });
    expect(result.waste_category).toBe("plastic");
    expect(result.contamination_at_source).toBe(true);
  });

  it("rejects invalid waste_category", async () => {
    const { WasteVerificationSchema } = await import("../ai/schemas.js");
    expect(() =>
      WasteVerificationSchema.parse({
        waste_category: "nuclear",
        ai_quality_score: 0.5,
        contamination_at_source: false,
        contamination_feedback: "ok",
      })
    ).toThrow();
  });

  it("rejects ai_quality_score > 1", async () => {
    const { WasteVerificationSchema } = await import("../ai/schemas.js");
    expect(() =>
      WasteVerificationSchema.parse({
        waste_category: "plastic",
        ai_quality_score: 1.5,
        contamination_at_source: false,
        contamination_feedback: "ok",
      })
    ).toThrow();
  });
});

// ---- Fraud Detection Stage ----
describe("stageFraudDetection", () => {
  it("marks report as verified when no nearby duplicates", async () => {
    const state: TableState = {
      reports: {
        "r1": { id: "r1", latitude: 22.7196, longitude: 75.8577, user_id: "u1", created_at: new Date().toISOString() },
      },
      report_events: {},
      hotspots: {},
    };
    const mock = makeSupabaseMock(state);
    vi.mocked(getAdminSupabase).mockReturnValue(mock as any);

    const { stageFraudDetection } = await import("../pipeline/stages/fraudDetection.js");
    await stageFraudDetection(mockEnv, "r1");

    expect(state.reports["r1"].status).toBe("verified");
  });

  it("marks report as rejected when same user has nearby report", async () => {
    const now = new Date().toISOString();
    const state: TableState = {
      reports: {
        "r1": { id: "r1", latitude: 22.7196, longitude: 75.8577, user_id: "u1", created_at: now },
        "r2": { id: "r2", latitude: 22.71961, longitude: 75.85771, user_id: "u1", created_at: now },
      },
      report_events: {},
      hotspots: {},
    };

    // Override the candidates query to return r2 when querying for r1
    const mock = {
      from: (table: string) => {
        if (table === "reports") {
          return {
            select: () => ({
              eq: (col: string, val: any) => ({
                single: () => Promise.resolve({ data: state.reports[val], error: null }),
              }),
              neq: () => {
                const chain: any = {
                  gte: () => chain,
                  lte: () => chain,
                  limit: () => Promise.resolve({ data: [state.reports["r2"]], error: null }),
                };
                return chain;
              },
            }),
            update: (payload: any) => ({
              eq: (_col: string, val: any) => {
                Object.assign(state.reports[val], payload);
                return Promise.resolve({ error: null });
              },
            }),
          };
        }
        if (table === "report_events") {
          return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
            insert: (p: any) => ({ then: (r: Function) => r({ data: p, error: null }) }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }
        return {};
      },
    };

    vi.mocked(getAdminSupabase).mockReturnValue(mock as any);

    const { stageFraudDetection } = await import("../pipeline/stages/fraudDetection.js");
    await stageFraudDetection(mockEnv, "r1");

    expect(state.reports["r1"].status).toBe("rejected");
  });

  it("skips geo checks and marks verified when no lat/lng", async () => {
    const state: TableState = {
      reports: {
        "r1": { id: "r1", latitude: null, longitude: null, user_id: "u1", created_at: new Date().toISOString() },
      },
      report_events: {},
      hotspots: {},
    };
    const mock = makeSupabaseMock(state);
    vi.mocked(getAdminSupabase).mockReturnValue(mock as any);

    const { stageFraudDetection } = await import("../pipeline/stages/fraudDetection.js");
    await stageFraudDetection(mockEnv, "r1");

    expect(state.reports["r1"].status).toBe("verified");
  });
});

// ---- Reward Optimization Stage ----
describe("stageRewardOptimization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calculates correct token reward for high severity with good AI score", async () => {
    const state: TableState = {
      reports: { "r1": { id: "r1", severity: "high" } },
      report_events: {
        "ev1": { id: "ev1", report_id: "r1", agent_type: "waste_verification", metadata: { ai_quality_score: 0.9, contamination_at_source: false } },
      },
      hotspots: {},
    };
    const mock = makeSupabaseMock(state);
    vi.mocked(getAdminSupabase).mockReturnValue(mock as any);

    const { stageRewardOptimization } = await import("../pipeline/stages/rewardOptimization.js");
    await stageRewardOptimization(mockEnv, "r1");

    // base=20, multiplier=1+0.5*0.9=1.45, bonus=0 → round(20*1.45)=29
    expect(state.reports["r1"].token_reward).toBe(29);
  });

  it("adds contamination bonus of 5 tokens", async () => {
    const state: TableState = {
      reports: { "r1": { id: "r1", severity: "medium" } },
      report_events: {
        "ev1": { id: "ev1", report_id: "r1", agent_type: "waste_verification", metadata: { ai_quality_score: 0.5, contamination_at_source: true } },
      },
      hotspots: {},
    };
    const mock = makeSupabaseMock(state);
    vi.mocked(getAdminSupabase).mockReturnValue(mock as any);

    const { stageRewardOptimization } = await import("../pipeline/stages/rewardOptimization.js");
    await stageRewardOptimization(mockEnv, "r1");

    // base=10, multiplier=1+0.5*0.5=1.25, bonus=5 → round(10*1.25)+5=17
    expect(state.reports["r1"].token_reward).toBe(18);
  });

  it("uses default quality score of 0.5 when no AI event exists", async () => {
    const state: TableState = {
      reports: { "r1": { id: "r1", severity: "low" } },
      report_events: {},
      hotspots: {},
    };
    const mock = makeSupabaseMock(state);
    vi.mocked(getAdminSupabase).mockReturnValue(mock as any);

    const { stageRewardOptimization } = await import("../pipeline/stages/rewardOptimization.js");
    await stageRewardOptimization(mockEnv, "r1");

    // base=5, multiplier=1+0.5*0.5=1.25, bonus=0 → round(5*1.25)=6
    expect(state.reports["r1"].token_reward).toBe(6);
  });
});

// ---- Municipal Coordination Stage ----
describe("stageMunicipalCoordination", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes hazardous waste to hazmat facility with critical severity", async () => {
    const state: TableState = {
      reports: { "r1": { id: "r1", category: "hazardous", severity: "low", status: "pending", assigned_to: null } },
      report_events: {},
      hotspots: {},
    };
    const mock = makeSupabaseMock(state);
    vi.mocked(getAdminSupabase).mockReturnValue(mock as any);

    const { stageMunicipalCoordination } = await import("../pipeline/stages/municipalCoordination.js");
    await stageMunicipalCoordination(mockEnv, "r1");

    expect(state.reports["r1"].assigned_to).toBe("facility:hazmat_unit_1");
    expect(state.reports["r1"].severity).toBe("high"); // score=3+4=7 → high (>=6)
  });

  it("routes e_waste to specialized facility", async () => {
    const state: TableState = {
      reports: { "r1": { id: "r1", category: "e_waste", severity: "medium", status: "pending", assigned_to: null } },
      report_events: {},
      hotspots: {},
    };
    const mock = makeSupabaseMock(state);
    vi.mocked(getAdminSupabase).mockReturnValue(mock as any);

    const { stageMunicipalCoordination } = await import("../pipeline/stages/municipalCoordination.js");
    await stageMunicipalCoordination(mockEnv, "r1");

    expect(state.reports["r1"].assigned_to).toBe("facility:ewaste_center_1");
    expect(state.reports["r1"].status).toBe("assigned");
  });

  it("boosts severity when contamination detected", async () => {
    const state: TableState = {
      reports: { "r1": { id: "r1", category: "plastic", severity: "low", status: "pending", assigned_to: null } },
      report_events: {
        "ev1": { id: "ev1", report_id: "r1", agent_type: "waste_verification", metadata: { contamination_at_source: true } },
      },
      hotspots: {},
    };
    const mock = makeSupabaseMock(state);
    vi.mocked(getAdminSupabase).mockReturnValue(mock as any);

    const { stageMunicipalCoordination } = await import("../pipeline/stages/municipalCoordination.js");
    await stageMunicipalCoordination(mockEnv, "r1");

    // score = 3 + 2(contamination) = 5 → medium
    expect(state.reports["r1"].severity).toBe("medium");
  });
});

// ---- Full Pipeline Integration ----
describe("processReport (full pipeline)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("runs all 5 stages and marks events completed", async () => {
    const reportId = "r-full";
    const state: TableState = {
      reports: {
        [reportId]: {
          id: reportId,
          user_id: "u1",
          category: "plastic",
          severity: "medium",
          status: "pending",
          image_url: "https://cdn.example.com/img.jpg",
          location_address: "Test Street",
          latitude: 22.7196,
          longitude: 75.8577,
          description: "Test waste",
          assigned_to: null,
          token_reward: null,
        },
      },
      report_events: {},
      hotspots: {},
    };

    // AI mock returns valid waste verification
    vi.mocked(getStructuredJson).mockResolvedValue({
      waste_category: "plastic",
      ai_quality_score: 0.8,
      contamination_at_source: false,
      contamination_feedback: "No contamination detected",
    });

    // Build a comprehensive mock that handles all pipeline queries
    const eventStore: Record<string, any> = {};
    const hotspotStore: Record<string, any> = {};

    const adminMock = {
      from: (table: string) => {
        if (table === "reports") {
          return {
            select: (_cols?: string) => ({
              eq: (col: string, val: any) => ({
                single: () => Promise.resolve({ data: state.reports[val] ?? null, error: state.reports[val] ? null : { message: "not found" } }),
              }),
              neq: () => makeFilterChain([]),
            }),
            update: (payload: any) => ({
              eq: (_col: string, val: any) => {
                if (state.reports[val]) Object.assign(state.reports[val], payload);
                return Promise.resolve({ data: state.reports[val], error: null });
              },
            }),
          };
        }

        if (table === "report_events") {
          return {
            select: (_cols?: string) => ({
              eq: (col: string, val: any) => ({
                eq: (col2: string, val2: any) => ({
                  maybeSingle: () => {
                    const found = Object.values(eventStore).find((e: any) => e[col] === val && e[col2] === val2);
                    return Promise.resolve({ data: found ?? null, error: null });
                  },
                }),
                order: () => ({ limit: () => Promise.resolve({ data: Object.values(eventStore).filter((e: any) => e[col] === val), error: null }) }),
                maybeSingle: () => {
                  const found = Object.values(eventStore).find((e: any) => e[col] === val);
                  return Promise.resolve({ data: found ?? null, error: null });
                },
              }),
            }),
            insert: (payload: any) => {
              const id = `ev-${Math.random().toString(36).slice(2)}`;
              eventStore[id] = { ...payload, id };
              return { then: (r: Function) => r({ data: eventStore[id], error: null }) };
            },
            update: (payload: any) => ({
              eq: (_col: string, val: any) => {
                const found = Object.values(eventStore).find((e: any) => e.id === val);
                if (found) Object.assign(found, payload);
                return Promise.resolve({ error: null });
              },
            }),
          };
        }

        if (table === "hotspots") {
          return {
            select: () => ({
              gte: () => ({ lte: () => ({ gte: () => ({ lte: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
            }),
            insert: (payload: any) => {
              const id = `hs-${Math.random().toString(36).slice(2)}`;
              hotspotStore[id] = { ...payload, id };
              return { select: () => ({ single: () => Promise.resolve({ data: hotspotStore[id], error: null }) }) };
            },
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }

        return {};
      },
    };

    vi.mocked(getAdminSupabase).mockReturnValue(adminMock as any);

    const { processReport } = await import("../pipeline/processReport.js");
    await processReport(mockEnv, { reportId, requestedByUserId: "u1", requestedByRole: "citizen" });

    // Report should be processed through all stages
    const report = state.reports[reportId];
    expect(report.status).toBe("verified"); // fraud detection sets this
    expect(report.token_reward).toBeGreaterThan(0);
    expect(report.assigned_to).toBeTruthy();

    // A hotspot should have been created
    expect(Object.keys(hotspotStore).length).toBeGreaterThan(0);
  });

  it("throws 403 when citizen tries to process another user's report", async () => {
    const state: TableState = {
      reports: {
        "r-other": { id: "r-other", user_id: "other-user" },
      },
      report_events: {},
      hotspots: {},
    };
    const mock = makeSupabaseMock(state);
    vi.mocked(getAdminSupabase).mockReturnValue(mock as any);

    const { processReport } = await import("../pipeline/processReport.js");
    await expect(
      processReport(mockEnv, { reportId: "r-other", requestedByUserId: "u1", requestedByRole: "citizen" })
    ).rejects.toMatchObject({ message: "Forbidden" });
  });
});
