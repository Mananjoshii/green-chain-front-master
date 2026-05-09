import "dotenv/config";
import process from "process";
import { processReport } from './src/pipeline/processReport.js';
import { Env } from './src/env.js';
import { createClient } from '@supabase/supabase-js';

const env = process.env as unknown as Env;
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testPipeline() {
  // Get the latest report with an image_url
  const { data, error } = await supabase.from('reports').select('id, user_id, image_url').not('image_url', 'is', null).order('created_at', { ascending: false }).limit(1).single();
  if (error || !data) {
    console.error("No report found:", error);
    return;
  }
  
  console.log("Processing report:", data.id, "Image:", data.image_url);
  
  try {
    await processReport(env, {
      reportId: data.id,
      requestedByUserId: data.user_id,
      requestedByRole: 'citizen'
    });
    console.log("Success!");
  } catch (err: any) {
    console.error("Pipeline failed with error:", err.message || err);
    if (err.statusCode) console.error("Status code:", err.statusCode);
  }
}

testPipeline();
