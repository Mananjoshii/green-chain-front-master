/**
 * importWardContacts.ts
 * ---------------------
 * Parses the BBMP ward contacts CSV and upserts all 198 rows into
 * the `ward_contacts` table.
 *
 * CSV filename: 0b58bd23-4e2d-4063-9a7e-7285718e6a60.csv
 *
 * Run from repo root:
 *   npx tsx backend/src/scripts/importWardContacts.ts
 *
 * IMPORTANT: Run importBBMPWards.ts first — ward_contacts has a FK on wards.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../");

dotenv.config({ path: path.join(repoRoot, "backend", ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

// ── CSV parser (no external deps) ────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map(l => parseCSVLine(l));
  return { headers, rows };
}

// ── Column mapping (CSV header → DB column) ──────────────────────────────────

// CSV header: "Ward","Ward Names","Zones","Assembly Constituency",
//   "JC","Telephone-1","DC","Telephone-2","Superintend Engineer","Telephone-3",
//   "Chief Engineer","Telephone-4","EE","Telephone-5","AEE","Telephone-6",
//   "AE","Telephone-7","Jr. Health Insp","Telephone-8","Sr. Health Insp",
//   "Telephone-9","RO","Telephone-10","ARO","Telephone-11",
//   "Animal Husbandary","Telephone"

function rowToContact(headers: string[], values: string[]): Record<string, unknown> | null {
  const get = (header: string): string | null => {
    const idx = headers.indexOf(header);
    if (idx === -1) return null;
    const v = values[idx]?.trim() ?? "";
    return v || null;
  };

  const wardNoRaw = get("Ward");
  const wardNo = wardNoRaw ? parseInt(wardNoRaw, 10) : NaN;
  if (isNaN(wardNo)) return null;

  return {
    ward_no:                    wardNo,
    ward_name:                  get("Ward Names") ?? `Ward ${wardNo}`,
    zone_name:                  get("Zones"),
    assembly_constituency:      get("Assembly Constituency"),
    jc_name:                    get("JC"),
    jc_phone:                   get("Telephone-1"),
    dc_name:                    get("DC"),
    dc_phone:                   get("Telephone-2"),
    se_name:                    get("Superintend Engineer"),
    se_phone:                   get("Telephone-3"),
    ce_name:                    get("Chief Engineer"),
    ce_phone:                   get("Telephone-4"),
    ee_name:                    get("EE"),
    ee_phone:                   get("Telephone-5"),
    aee_name:                   get("AEE"),
    aee_phone:                  get("Telephone-6"),
    ae_name:                    get("AE"),
    ae_phone:                   get("Telephone-7"),
    jr_health_inspector_name:   get("Jr. Health Insp"),
    jr_health_inspector_phone:  get("Telephone-8"),
    sr_health_inspector_name:   get("Sr. Health Insp"),
    sr_health_inspector_phone:  get("Telephone-9"),
    ro_name:                    get("RO"),
    ro_phone:                   get("Telephone-10"),
    aro_name:                   get("ARO"),
    aro_phone:                  get("Telephone-11"),
    animal_husbandry_name:      get("Animal Husbandary"),
    animal_husbandry_phone:     get("Telephone")
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath = path.join(repoRoot, "0b58bd23-4e2d-4063-9a7e-7285718e6a60.csv");

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV not found at: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📂 Reading ${csvPath}…`);
  const content = fs.readFileSync(csvPath, "utf-8");
  const { headers, rows } = parseCSV(content);
  console.log(`✅ Parsed ${rows.length} rows, ${headers.length} columns`);
  console.log(`📋 Headers: ${headers.join(", ")}`);

  let successCount = 0;
  let errorCount = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const contacts = batch
      .map(row => rowToContact(headers, row))
      .filter((c): c is Record<string, unknown> => c !== null);

    if (contacts.length === 0) continue;

    const { error } = await supabase
      .from("ward_contacts")
      .upsert(contacts as object[], { onConflict: "ward_no" });

    if (error) {
      console.error(`❌ Batch ${i}–${i + BATCH_SIZE}: ${error.message}`);
      errorCount += contacts.length;
    } else {
      successCount += contacts.length;
      process.stdout.write(`\r✅ Inserted ${successCount}/${rows.length} ward contacts…`);
    }
  }

  console.log(`\n\n🎉 Done! ${successCount} contacts inserted, ${errorCount} errors.`);
}

main().catch(err => {
  console.error("💥 Fatal:", err);
  process.exit(1);
});
