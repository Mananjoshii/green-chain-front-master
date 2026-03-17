import cors from "cors";
import express from "express";
import { pinoHttp } from "pino-http";
import { pino } from "pino";

import { requireAuth } from "./middleware/requireAuth.js";
import { createRoutes } from "./routes/index.js";
import type { Env } from "./env.js";

export function createApp(env: Env) {
  const app = express();

  const logger = pino({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    redact: ["req.headers.authorization"]
  });

  app.disable("x-powered-by");
  app.use(pinoHttp({ logger }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

  // All API endpoints require Supabase Bearer token.
  app.use(env.API_BASE_PATH, requireAuth(env));
  app.use(env.API_BASE_PATH, createRoutes(env));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as any)?.statusCode ?? 500;
    const message = (err as any)?.message ?? "Internal Server Error";
    res.status(status).json({ error: message });
  });

  return app;
}

