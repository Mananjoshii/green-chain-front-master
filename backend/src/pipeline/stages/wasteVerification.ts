import type { Env } from "../../env.js";
import { getAdminSupabase } from "../../supabase/clients.js";
import { getStructuredJson } from "../../ai/openaiCompatible.js";
import { WasteVerificationSchema } from "../../ai/schemas.js";
import { upsertReportEvent } from "../events.js";

export async function stageWasteVerification(env: Env, reportId: string) {
  const supabaseAdmin = getAdminSupabase(env);

  const { data: report, error } = await supabaseAdmin
    .from("reports")
    .select("id,image_url,category,description,location_address")
    .eq("id", reportId)
    .single();
  if (error) throw error;

  if (!report.image_url) {
    const e = new Error("Report has no image_url");
    (e as any).statusCode = 400;
    throw e;
  }

  const result = await getStructuredJson(env, {
    model: env.AI_VISION_MODEL,
    schema: WasteVerificationSchema,
    system:
      "You are a waste verification vision agent for EcoChain.\n" +
      "Your task: verify the waste type visible in the image and detect contamination at source.\n" +
      "CRITICAL: Specifically look for 'Contamination at source' (examples: plastic mixed in organic bin, food waste in recycling, batteries in general waste).\n" +
      "waste_category MUST be exactly one of: organic, plastic, e_waste, construction, hazardous, mixed, other.",
    user: [
      {
        type: "text",
        text:
          `Report context:\n` +
          `- user_selected_category: ${report.category}\n` +
          `- description: ${report.description}\n` +
          `- location_address: ${report.location_address}\n\n` +
          "Return JSON with fields: waste_category, ai_quality_score (0..1), contamination_at_source (bool), contamination_feedback (string)."
      },
      { type: "image_url", image_url: { url: report.image_url } }
    ]
  });

  const metadata = {
    waste_category: result.waste_category,
    ai_quality_score: result.ai_quality_score,
    contamination_at_source: result.contamination_at_source,
    contamination_feedback: result.contamination_feedback
  };

  await upsertReportEvent(env, {
    reportId,
    agentType: "waste_verification",
    stageStatus: "processing",
    message: result.contamination_at_source ? result.contamination_feedback : "No contamination detected",
    metadata
  });

  if (result.ai_quality_score >= 0.6 && result.waste_category) {
    const { error: updErr } = await supabaseAdmin
      .from("reports")
      .update({ category: result.waste_category })
      .eq("id", reportId);
    if (updErr) throw updErr;
  }
}

