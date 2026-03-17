import type { NextFunction, Request, Response } from "express";

type AppRole = "citizen" | "municipal_officer" | "city_planner" | "admin";

const rank: Record<AppRole, number> = {
  citizen: 1,
  municipal_officer: 2,
  city_planner: 3,
  admin: 4
};

function requireMinRole(minRole: AppRole) {
  return function (req: Request, res: Response, next: NextFunction) {
    const role = req.user?.role;
    if (!role) return res.status(401).json({ error: "Unauthorized" });
    if (rank[role] < rank[minRole]) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

export const requireRoleAtLeastCitizen = requireMinRole("citizen");
export const requireMunicipal = (req: Request, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (!role) return res.status(401).json({ error: "Unauthorized" });
  if (role !== "municipal_officer" && role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};
export const requirePlannerOrAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (!role) return res.status(401).json({ error: "Unauthorized" });
  if (role !== "city_planner" && role !== "admin") return res.status(403).json({ error: "Forbidden" });
  next();
};

