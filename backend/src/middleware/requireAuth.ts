import type { NextFunction, Request, Response } from "express";
import type { Env } from "../env.js";
import { getAdminSupabase, getAnonSupabase } from "../supabase/clients.js";

type AppRole = "citizen" | "municipal_officer" | "city_planner" | "admin";

function parseBearer(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export function requireAuth(env: Env) {
  const supabaseAnon = getAnonSupabase(env);
  const supabaseAdmin = getAdminSupabase(env);

  return async function requireAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      const token = parseBearer(req.header("authorization"));
      if (!token) return res.status(401).json({ error: "Missing Bearer token" });

      const { data, error } = await supabaseAnon.auth.getUser(token);
      if (error || !data.user) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      const userId = data.user.id;
      const { data: roleRow, error: roleError } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (roleError) throw roleError;
      if (!roleRow?.role) {
        return res.status(403).json({ error: "User has no role assigned" });
      }

      req.user = {
        id: userId,
        email: data.user.email,
        role: roleRow.role as AppRole
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

