import { Router } from "express";
import type { Env } from "../env.js";

import { reportsRouter } from "./reports.js";
import { municipalRouter } from "./municipal.js";
import { adminRouter } from "./admin.js";
import { gisRouter } from "./gis.js";

export function createRoutes(env: Env) {
  const router = Router();

  router.use("/reports", reportsRouter(env));
  router.use("/municipal", municipalRouter(env));
  router.use("/admin", adminRouter(env));
  router.use("/gis", gisRouter(env));

  return router;
}
