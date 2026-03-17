import React, { createContext, useContext, useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, AuthUser } from "@/types";

interface AuthContextType {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: AppRole) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserProfile(supaUser: User): Promise<AuthUser> {
  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", supaUser.id)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", supaUser.id),
  ]);

  if (profileError) {
    console.error("Failed to load profile:", profileError);
  }
  if (rolesError) {
    console.error("Failed to load roles:", rolesError);
  }

  const fallbackRole = (supaUser.user_metadata?.role as AppRole | undefined) ?? "citizen";

  return {
    id: supaUser.id,
    email: supaUser.email ?? "",
    fullName: profile?.full_name ?? (supaUser.user_metadata?.full_name as string | undefined) ?? "",
    avatarUrl: profile?.avatar_url ?? undefined,
    roles: ((roles ?? []).map((r) => r.role as AppRole).length
      ? (roles ?? []).map((r) => r.role as AppRole)
      : [fallbackRole]),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const hydrateUser = async (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);

      if (!nextSession?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const profile = await fetchUserProfile(nextSession.user);
        if (!isMounted) return;
        setUser(profile);
      } catch (error) {
        console.error("Failed to hydrate auth user:", error);
        if (!isMounted) return;

        const fallbackRole = (nextSession.user.user_metadata?.role as AppRole | undefined) ?? "citizen";
        setUser({
          id: nextSession.user.id,
          email: nextSession.user.email ?? "",
          fullName: (nextSession.user.user_metadata?.full_name as string | undefined) ?? "",
          avatarUrl: undefined,
          roles: [fallbackRole],
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void hydrateUser(nextSession);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        void hydrateUser(currentSession);
      })
      .catch((error) => {
        console.error("Failed to restore session:", error);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: AppRole) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const hasRole = (role: AppRole) => user?.roles.includes(role) ?? false;

  return (
    <AuthContext.Provider value={{ session, user, loading, signUp, signIn, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
