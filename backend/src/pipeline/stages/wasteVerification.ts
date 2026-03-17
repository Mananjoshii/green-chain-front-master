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
      "IMPORTANT: The user-selected category/description may be wrong or misleading. Do NOT anchor on it; use it only as weak context.\n" +
      "Always prioritize what is visible in the image.\n" +
      "CRITICAL: Specifically look for 'Contamination at source' (examples: plastic mixed in organic bin, food waste in recycling, batteries in general waste).\n" +
      "ALSO CRITICAL: Detect if the image appears to be internet-sourced (stock photo / screenshot / watermark).\n" +
      "Signals include: visible watermarks (iStock, Getty Images, Shutterstock, Adobe Stock), overlaid captions, website/app UI (search bars, nav buttons), or large text banners.\n" +
      "If likely internet-sourced, set source_authenticity=likely_internet and include evidence strings in internet_evidence.\n" +
      "Before returning JSON, do a quick self-check: re-scan the image for the dominant waste type and any watermark/UI text.\n" +
      "waste_category MUST be exactly one of: organic, plastic, e_waste, construction, hazardous, mixed, other.",
    maxRetries: 4,
    user: [
      {
        type: "text",
        text:
          `Report context:\n` +
          `- user_selected_category: ${report.category}\n` +
          `- description: ${report.description}\n` +
          `- location_address: ${report.location_address}\n\n` +
          "Return JSON with fields:\n" +
          "- waste_category\n" +
          "- ai_quality_score (0..1)\n" +
          "- contamination_at_source (bool)\n" +
          "- contamination_feedback (string)\n" +
          "- source_authenticity (genuine | likely_internet | uncertain)\n" +
          "- has_watermark_or_stock_branding (bool)\n" +
          "- has_screenshot_ui (bool)\n" +
          "- internet_evidence (string[])"
      },
      { type: "image_url", image_url: { url: report.image_url } }
    ]
  });

  const metadata = {
    waste_category: result.waste_category,
    ai_quality_score: result.ai_quality_score,
    contamination_at_source: result.contamination_at_source,
    contamination_feedback: result.contamination_feedback,
    source_authenticity: result.source_authenticity,
    has_watermark_or_stock_branding: result.has_watermark_or_stock_branding,
    has_screenshot_ui: result.has_screenshot_ui,
    internet_evidence: result.internet_evidence
  };

  await upsertReportEvent(env, {
    reportId,
    agentType: "waste_verification",
    stageStatus: "processing",
    message:
      result.source_authenticity === "likely_internet"
        ? `Likely internet-sourced image: ${(result.internet_evidence ?? []).slice(0, 3).join("; ") || "watermark/UI detected"}`
        : result.contamination_at_source
          ? result.contamination_feedback
          : "No contamination detected",
    metadata
  });

  if (result.source_authenticity === "likely_internet") {
    // Auto-reject: internet-sourced / stock / screenshot images should not be eligible.
    const { error: rejErr } = await supabaseAdmin
      .from("reports")
      .update({ status: "rejected", token_reward: null })
      .eq("id", reportId);
    if (rejErr) throw rejErr;
    return;
  }

  if (result.ai_quality_score >= 0.6 && result.waste_category) {
    const { error: updErr } = await supabaseAdmin
      .from("reports")
      .update({ category: result.waste_category })
      .eq("id", reportId);
    if (updErr) throw updErr;
  }
}

