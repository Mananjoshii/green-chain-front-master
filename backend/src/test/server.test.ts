/**
 * E2E: Backend HTTP Server
 * Tests health endpoint, auth middleware, and route protection.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import request from "supertest";
import type { Env } from "../env.js";

// Mock Supabase clients before importing server
vi.mock("../supabase/clients.js", () => ({
  getAnonSupabase: vi.fn(),
  getAdminSupabase: vi.fn(),
}));

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

// Mock auth middleware to control auth behavior per test
const mockRequireAuth = vi.fn();
vi.mock("../middleware/requireAuth.js", () => ({
  requireAuth: () => mockRequireAuth,
}));

// Mock routes to avoid real DB calls
vi.mock("../routes/index.js", () => ({
  createRoutes: () => {
    const { Router } = require("express");
    const r = Router();
    r.get("/reports", (_req: any, res: any) => res.json({ reports: [] }));
    return r;
  },
}));

const { createApp } = await import("../server.js");

describe("Express server", () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp(mockEnv);
  });

  it("GET /healthz returns 200 { ok: true }", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns 401 when auth middleware rejects", async () => {
    mockRequireAuth.mockImplementationOnce((_req: any, res: any) => {
      res.status(401).json({ error: "Missing Bearer token" });
    });

    const res = await request(app).get("/api/reports");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Missing Bearer token");
  });

  it("passes through to routes when auth succeeds", async () => {
    mockRequireAuth.mockImplementationOnce((_req: any, _res: any, next: any) => next());

    const res = await request(app).get("/api/reports");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("reports");
  });

  it("sets CORS headers for allowed origin", async () => {
    const res = await request(app)
      .get("/healthz")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("does not expose X-Powered-By header", async () => {
    const res = await request(app).get("/healthz");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
