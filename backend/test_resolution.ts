import "dotenv/config";
import process from "process";
import { runResolutionVerificationAgent } from './src/pipeline/stages/resolutionVerification.js';
import { Env } from './src/env.js';
import { createClient } from '@supabase/supabase-js';

const env = process.env as unknown as Env;
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testResolutionAgent() {
  console.log("🔍 Starting AI Resolution Verification Test...");

  // 1. Find a report with a before image to test with
  const { data: report, error } = await supabase
    .from('reports')
    .select('id, image_url')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !report) {
    console.error("❌ No report found with an image. Please create a report first.");
    return;
  }

  console.log(`✅ Found report ${report.id}`);

  // 2. Temporarily set an "after" image and set status to pending_verification
  // For testing, we'll just use the exact same image to ensure it passes (or use a placeholder)
  const testAfterImage = report.image_url; 
  console.log(`Setting mock resolution image to: ${testAfterImage}`);

  await supabase.from('reports').update({
    resolution_image_url: testAfterImage,
    status: 'pending_verification',
    verification_status: 'pending'
  }).eq('id', report.id);

  // 3. Run the agent
  console.log("🤖 Running Resolution Verification Agent (this may take 10-20 seconds)...");
  try {
    const result = await runResolutionVerificationAgent(env, report.id);
    
    console.log("\n====== 🎯 VERIFICATION RESULT ======");
    console.log(`Decision:   ${result.decision.toUpperCase()}`);
    console.log(`Confidence: ${Math.round(result.confidence * 100)}%`);
    console.log(`Reasoning:  ${result.reasoning}`);
    console.log(`Red Flags:  ${result.red_flags.length > 0 ? result.red_flags.join(', ') : 'None'}`);
    console.log("====================================\n");

    if (result.decision === 'confirmed') {
      console.log("🎉 Test Passed! The agent successfully verified the resolution and minted tokens.");
    } else {
      console.log(`⚠️ Agent decided: ${result.decision}. Check the reasoning above.`);
    }

  } catch (err: any) {
    console.error("❌ Agent failed with error:", err.message || err);
  }
}

testResolutionAgent();
