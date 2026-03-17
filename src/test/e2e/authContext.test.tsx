/**
 * E2E: Auth Context
 * Tests sign-in, sign-out, role resolution, and session hydration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";

// vi.hoisted runs before vi.mock hoisting, so the ref is available in the factory
const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
  },
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseMock,
}));

import { AuthProvider, useAuth } from "@/context/AuthContext";

function makeSupabaseUser(id = "user-1", email = "test@example.com") {
  return { id, email, user_metadata: { full_name: "Test User", role: "citizen" } };
}

function makeSession(user = makeSupabaseUser()) {
  return { user, access_token: "tok" };
}

function setupSupabaseMocks(session: ReturnType<typeof makeSession> | null) {
  supabaseMock.auth.getSession.mockResolvedValue({ data: { session } });
  supabaseMock.auth.onAuthStateChange.mockImplementation((cb: Function) => {
    setTimeout(() => cb("SIGNED_IN", session), 0);
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { full_name: "Test User", avatar_url: null }, error: null }),
          }),
        }),
      };
    }
    if (table === "user_roles") {
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [{ role: "citizen" }], error: null }),
        }),
      };
    }
    return {};
  });
}

const TestConsumer = () => {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  if (!user) return <div>no-user</div>;
  return <div data-testid="user">{user.email} | {user.roles.join(",")}</div>;
};

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates user from session on mount", async () => {
    setupSupabaseMocks(makeSession());

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toContain("test@example.com");
    });
  });

  it("shows no-user when session is null", async () => {
    setupSupabaseMocks(null);

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("no-user")).toBeTruthy();
    });
  });

  it("hasRole returns true for assigned role", async () => {
    setupSupabaseMocks(makeSession());

    const RoleChecker = () => {
      const { hasRole, loading } = useAuth();
      if (loading) return <div>loading</div>;
      return <div data-testid="role">{hasRole("citizen") ? "yes" : "no"}</div>;
    };

    render(
      <AuthProvider>
        <RoleChecker />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("role").textContent).toBe("yes");
    });
  });

  it("signIn calls supabase signInWithPassword", async () => {
    setupSupabaseMocks(null);
    supabaseMock.auth.signInWithPassword.mockResolvedValue({ error: null });

    const SignInBtn = () => {
      const { signIn } = useAuth();
      return <button onClick={() => signIn("a@b.com", "pass")}>sign in</button>;
    };

    render(
      <AuthProvider>
        <SignInBtn />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText("sign in").click();
    });

    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@b.com", password: "pass" });
  });

  it("signOut calls supabase signOut", async () => {
    setupSupabaseMocks(makeSession());
    supabaseMock.auth.signOut.mockResolvedValue({ error: null });

    const SignOutBtn = () => {
      const { signOut } = useAuth();
      return <button onClick={() => signOut()}>sign out</button>;
    };

    render(
      <AuthProvider>
        <SignOutBtn />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText("sign out").click();
    });

    expect(supabaseMock.auth.signOut).toHaveBeenCalled();
  });
});
