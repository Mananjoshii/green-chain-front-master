/**
 * E2E: Frontend API Client
 * Tests the ApiClient class that bridges frontend → backend.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase session
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-token-abc" } },
      }),
    },
  },
}));

// We test the ApiClient in isolation by mocking fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Import after mocks
const { apiClient } = await import("@/services/api/client");

describe("ApiClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("GET attaches Bearer token from session", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await apiClient.get("/healthz");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Authorization"]).toBe("Bearer mock-token-abc");
  });

  it("POST sends JSON body with auth header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await apiClient.post("/api/reports/123/process", { foo: "bar" });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ foo: "bar" });
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(apiClient.get("/api/forbidden")).rejects.toThrow("API error: 403");
  });

  it("uploadFile sends FormData without Content-Type header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "https://cdn.example.com/img.jpg" }),
    });

    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const result = await apiClient.uploadFile("/api/reports/upload", file);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    expect(result.url).toBe("https://cdn.example.com/img.jpg");
  });
});
