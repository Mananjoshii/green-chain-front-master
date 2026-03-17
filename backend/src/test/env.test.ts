/**
 * E2E: Backend Environment Validation
 * Tests that loadEnv correctly validates and rejects bad configs.
 */
import { describe, it, expect } from "vitest";
import { loadEnv } from "../env.js";

const validEnv = {
  PORT: "3001",
  API_BASE_PATH: "/api",
  CORS_ORIGIN: "http://localhost:5173",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  AI_BASE_URL: "https://api.groq.com/openai/v1",
  AI_API_KEY: "gsk_test",
  AI_VISION_MODEL: "llama-4-scout",
};

describe("loadEnv", () => {
  it("parses valid env successfully", () => {
    const env = loadEnv(validEnv as any);
    expect(env.PORT).toBe(3001);
    expect(env.API_BASE_PATH).toBe("/api");
    expect(env.SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env.AI_VISION_MODEL).toBe("llama-4-scout");
  });

  it("applies default PORT=3001 when not set", () => {
    const { PORT: _, ...rest } = validEnv;
    const env = loadEnv(rest as any);
    expect(env.PORT).toBe(3001);
  });

  it("throws when SUPABASE_URL is missing", () => {
    const { SUPABASE_URL: _, ...rest } = validEnv;
    expect(() => loadEnv(rest as any)).toThrow("Invalid environment variables");
  });

  it("throws when AI_API_KEY is missing", () => {
    const { AI_API_KEY: _, ...rest } = validEnv;
    expect(() => loadEnv(rest as any)).toThrow("Invalid environment variables");
  });

  it("throws when AI_VISION_MODEL is missing", () => {
    const { AI_VISION_MODEL: _, ...rest } = validEnv;
    expect(() => loadEnv(rest as any)).toThrow("Invalid environment variables");
  });

  it("coerces PORT string to number", () => {
    const env = loadEnv({ ...validEnv, PORT: "8080" } as any);
    expect(env.PORT).toBe(8080);
  });

  it("AI_TEXT_MODEL is optional", () => {
    const env = loadEnv(validEnv as any);
    expect(env.AI_TEXT_MODEL).toBeUndefined();
  });
});
