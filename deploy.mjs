/**
 * deploy.mjs — One-shot deployment script
 * ----------------------------------------
 * Runs the ward GIS migration SQL directly against Supabase using
 * the service_role key + the pg-backed REST approach.
 *
 * Strategy: Supabase exposes a SQL execution endpoint via the
 * Management REST API at /rest/v1/rpc when using service_role.
 * We break DDL into individual statements and execute each one
 * via a direct fetch to the Supabase SQL runner endpoint.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://gxcjiqiivfsevnggthbb.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Y2ppcWlpdmZzZXZuZ2d0aGJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY2MjAxMCwiZXhwIjoyMDg5MjM4MDEwfQ.8_s3WsOpY34xvOrSM9lHQmo7urfFNvzYgZEYj9S5TJQ";
const PROJECT_REF = "gxcjiqiivfsevnggthbb";

// ── Execute SQL via Supabase Management API ───────────────────────────────────
async function execSQL(sql) {
  // Supabase Management API SQL endpoint
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ query: sql })
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${body}`);
  }
  return resp.json();
}

// ── Split SQL into individual statements ──────────────────────────────────────
function splitStatements(sql) {
  // Split on semicolons that are not inside $$ dollar-quoted blocks
  const stmts = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";
  let i = 0;

  while (i < sql.length) {
    // Detect dollar quoting: $$ or $tag$
    if (!inDollarQuote && sql[i] === "$") {
      const end = sql.indexOf("$", i + 1);
      if (end !== -1) {
        const tag = sql.slice(i, end + 1);
        inDollarQuote = true;
        dollarTag = tag;
        current += tag;
        i = end + 1;
        continue;
      }
    }
    if (inDollarQuote && sql.slice(i, i + dollarTag.length) === dollarTag) {
      current += dollarTag;
      i += dollarTag.length;
      inDollarQuote = false;
      dollarTag = "";
      continue;
    }
    if (!inDollarQuote && sql[i] === "-" && sql[i + 1] === "-") {
      // Line comment — skip to end of line
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }
    if (!inDollarQuote && sql[i] === ";") {
      const stmt = current.trim();
      if (stmt.length > 0) stmts.push(stmt);
      current = "";
      i++;
      continue;
    }
    current += sql[i];
    i++;
  }
  const last = current.trim();
  if (last.length > 0) stmts.push(last);
  return stmts;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const migrationPath = path.resolve(__dirname, "supabase/migrations/20260514000001_ward_gis_core.sql");
const sql = fs.readFileSync(migrationPath, "utf-8");
const statements = splitStatements(sql).filter(s => s.length > 0);

console.log(`\n🚀 Ward GIS Migration`);
console.log(`📋 ${statements.length} SQL statements to execute\n`);

let ok = 0;
let fail = 0;

for (let idx = 0; idx < statements.length; idx++) {
  const stmt = statements[idx];
  const preview = stmt.replace(/\s+/g, " ").slice(0, 80);
  process.stdout.write(`[${idx + 1}/${statements.length}] ${preview}… `);
  
  try {
    await execSQL(stmt + ";");
    console.log("✅");
    ok++;
  } catch (err) {
    // Idempotent errors are fine (already exists, etc.)
    const msg = err.message;
    if (
      msg.includes("already exists") ||
      msg.includes("duplicate") ||
      msg.includes("does not exist") && msg.includes("IF NOT EXISTS")
    ) {
      console.log(`⚠️  (skip: already applied)`);
      ok++;
    } else {
      console.log(`❌ ${msg.slice(0, 120)}`);
      fail++;
    }
  }
}

console.log(`\n${"─".repeat(60)}`);
console.log(`Migration complete: ${ok} succeeded, ${fail} failed\n`);

if (fail > 0) {
  console.error("⚠️  Some statements failed. Check errors above.");
  process.exit(1);
} else {
  console.log("✅ All statements applied successfully!");
}
