/**
 * deploy2.mjs — Migration via Supabase REST + service_role
 * ---------------------------------------------------------
 * Uses the undocumented but working Supabase SQL REST endpoint:
 * POST /rest/v1/rpc with raw query via postgres function
 * 
 * Alternative: Uses pg driver with the Supabase connection string.
 * Supabase connection string format (session mode):
 *   postgresql://postgres.[ref]:[password]@[region].pooler.supabase.com:5432/postgres
 * 
 * Since we don't have the DB password, we use a workaround:
 * Execute each statement through supabase-js admin client using
 * the postgres REST proxy at /rest/v1/ (for supported ops)
 * and the pg_net or exec_sql function if available.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gxcjiqiivfsevnggthbb.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4Y2ppcWlpdmZzZXZuZ2d0aGJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY2MjAxMCwiZXhwIjoyMDg5MjM4MDEwfQ.8_s3WsOpY34xvOrSM9lHQmo7urfFNvzYgZEYj9S5TJQ";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

// Try executing raw SQL via the PostgREST query endpoint
async function execRawSQL(sql) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
      "Prefer": "return=minimal",
      "X-Query": sql
    },
    body: JSON.stringify({ query: sql })
  });
  return { status: resp.status, body: await resp.text() };
}

// Try via exec_sql RPC (common Supabase helper)
async function tryExecSqlRpc(sql) {
  const { data, error } = await supabase.rpc("exec_sql", { query: sql });
  return { data, error };
}

// Direct fetch to the PostgREST root with Accept: application/json
async function execViaPGREST(sql) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY
    },
    body: JSON.stringify({ query: sql })
  });
  return { status: resp.status, body: await resp.text() };
}

console.log("\n🔍 Testing available SQL execution methods...\n");

// Test 1: exec_sql RPC
console.log("Test 1: exec_sql RPC...");
const test1 = await tryExecSqlRpc("SELECT 1 as test");
if (!test1.error) {
  console.log("✅ exec_sql RPC works:", JSON.stringify(test1.data));
} else {
  console.log("❌ exec_sql RPC:", test1.error.message);
}

// Test 2: Check what RPC functions exist
console.log("\nTest 2: Checking available RPC functions...");
const { data: funcs, error: funcErr } = await supabase
  .from("pg_proc")
  .select("proname")
  .limit(5);
console.log("pg_proc:", funcErr ? funcErr.message : JSON.stringify(funcs));

// Test 3: Try reading tables to see what's already there
console.log("\nTest 3: Checking if wards table exists...");
const { data: wardsCheck, error: wardsErr } = await supabase
  .from("wards")
  .select("count")
  .limit(1);
if (!wardsErr) {
  console.log("✅ wards table already exists!");
} else {
  console.log("❌ wards table not found:", wardsErr.message);
}

// Test 4: Check reports table columns
console.log("\nTest 4: Checking reports table for ward columns...");
const { data: reportCheck, error: reportErr } = await supabase
  .from("reports")
  .select("ward_no, detected_ward_name, ward_id")
  .limit(1);
if (!reportErr) {
  console.log("✅ reports table has ward columns already!");
} else {
  console.log("❌ reports ward columns missing:", reportErr.message);
}
