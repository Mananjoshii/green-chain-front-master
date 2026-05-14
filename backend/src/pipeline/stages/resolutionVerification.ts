import type { Env } from "../../env.js";
import { getAdminSupabase } from "../../supabase/clients.js";
import { getOpenAI } from "../../ai/openaiCompatible.js";
import type { VerificationResponse, VerificationResult } from "../../types/index.js";
import { upsertReportEvent } from "../events.js";
import { sendTelegramMessage, sendTelegramMediaGroup } from "../../supabase/telegram_utils.js";

const RESOLUTION_VERIFICATION_SYSTEM_PROMPT = `You are an AI verification agent for a municipal waste management system.
You will be given TWO images:
  - Image 1: The BEFORE image — taken by a citizen to report a waste problem.
  - Image 2: The AFTER image — taken by a municipal officer claiming the area has been cleaned.

Your task is to determine whether the waste issue shown in the BEFORE image has been resolved in the AFTER image.

IMPORTANT RULES:
- Be conservative. If you are not sure, set confidence below 0.80.
- Check that the AFTER image shows the SAME location or area as the BEFORE image.
  If the images appear to be from different locations entirely, set same_location to false and confidence to 0.10.
- Minor residual litter that is clearly incidental (not the reported waste) is acceptable for a confirmed resolution.
- If the AFTER image is blurry, taken at night with no visibility, or clearly does not show the area, set confidence to 0.15.
- Do NOT be fooled by stock images or obviously unrelated photos.
- If the after image appears to be a stock photo, watermarked image, or screenshot, set confidence to 0.05.

Respond ONLY with a valid JSON object in this exact format (no markdown, no preamble, no trailing text):
{
  "waste_present_in_after": boolean,
  "same_location": boolean,
  "confidence": number,
  "before_description": "one sentence describing what waste was visible in the before image",
  "after_description": "one sentence describing the state of the area in the after image",
  "reasoning": "2-3 sentences explaining your decision",
  "red_flags": ["array of any concerns, empty array if none"]
}`;

const PROMPT_VERSION = 'v1.0';
const CONFIDENCE_THRESHOLD = 0.80;

async function downloadImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: ${url} — ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

async function mintToken(env: Env, reportId: string): Promise<void> {
  const supabaseAdmin = getAdminSupabase(env);
  const { data: report, error } = await supabaseAdmin
    .from('reports')
    .select('token_reward, user_id')
    .eq('id', reportId)
    .single();

  if (error || !report) throw new Error(`Could not fetch report for minting: ${reportId}`);

  // Need to get the suggested reward from reward_optimization
  const { data: rewardEvent } = await supabaseAdmin
    .from('report_events')
    .select('metadata')
    .eq('report_id', reportId)
    .eq('agent_type', 'reward_optimization')
    .maybeSingle();

  const suggested = Number((rewardEvent?.metadata as any)?.suggested_token_reward) || 10;

  await supabaseAdmin.from('token_transactions').insert({
    report_id: reportId,
    user_id: report.user_id,
    tokens: suggested,
    status: 'minted',
    tx_hash: null
  });

  await supabaseAdmin
    .from('reports')
    .update({ token_minted: true, token_reward: suggested })
    .eq('id', reportId);
}

export async function runResolutionVerificationAgent(
  env: Env,
  reportId: string
): Promise<VerificationResult> {
  const supabaseAdmin = getAdminSupabase(env);
  
  // 1. Fetch report
  const { data: report, error: reportError } = await supabaseAdmin
    .from('reports')
    .select('image_url, resolution_image_url, category, description, location_address')
    .eq('id', reportId)
    .single();

  if (reportError || !report) {
    throw new Error(`Report not found: ${reportId}`);
  }

  const { image_url: beforeUrl, resolution_image_url: afterUrl } = report;

  if (!beforeUrl) {
    // No before image — route to manual review
    await supabaseAdmin.from('reports').update({
      verification_status: 'manual_review',
      verification_reasoning: 'Original complaint image unavailable — manual review required',
    }).eq('id', reportId);
    await upsertReportEvent(env, { reportId, agentType: 'resolution_verification', stageStatus: 'failed', message: 'before_image_missing', metadata: {} });
    return { decision: 'uncertain', confidence: 0, reasoning: 'Before image unavailable', red_flags: ['before_image_missing'] };
  }

  if (!afterUrl) {
    throw new Error(`Resolution image not found for report: ${reportId}`);
  }

  // 2. Download both images
  let beforeBase64: string;
  let afterBase64: string;

  try {
    [beforeBase64, afterBase64] = await Promise.all([
      downloadImageAsBase64(beforeUrl),
      downloadImageAsBase64(afterUrl),
    ]);
  } catch (err) {
    await supabaseAdmin.from('reports').update({
      verification_status: 'manual_review',
      verification_reasoning: 'Could not download one or both images — manual review required',
    }).eq('id', reportId);
    await upsertReportEvent(env, { reportId, agentType: 'resolution_verification', stageStatus: 'failed', message: 'image_download_failed', metadata: {} });
    return { decision: 'uncertain', confidence: 0, reasoning: 'Image download failed', red_flags: ['image_download_failed'] };
  }

  const startMs = Date.now();

  // 3. Call vision model
  let parsed: VerificationResponse;
  const aiClient = getOpenAI(env);
  try {
    const response = await aiClient.chat.completions.create({
      model: env.AI_VISION_MODEL!,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages: [
        { role: 'system', content: RESOLUTION_VERIFICATION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Report category: ${report.category}\nOriginal complaint: ${report.description}\nLocation: ${report.location_address}\n\nImage 1 is the BEFORE (complaint). Image 2 is the AFTER (officer resolution). Assess whether the waste has been cleared.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${beforeBase64}` },
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${afterBase64}` },
            },
          ],
        },
      ],
    });

    const rawText = response.choices[0].message.content ?? '{}';
    parsed = JSON.parse(rawText) as VerificationResponse;
  } catch (err) {
    await supabaseAdmin.from('reports').update({
      verification_status: 'manual_review',
      verification_reasoning: 'AI verification service unavailable — manual review required',
    }).eq('id', reportId);
    await upsertReportEvent(env, { reportId, agentType: 'resolution_verification', stageStatus: 'failed', message: 'ai_api_error', metadata: {} });
    return { decision: 'uncertain', confidence: 0, reasoning: 'AI API error', red_flags: ['ai_api_error'] };
  }

  const processingMs = Date.now() - startMs;

  // 4. Determine decision
  let decision: 'confirmed' | 'failed' | 'uncertain';
  if (parsed.confidence >= CONFIDENCE_THRESHOLD) {
    decision = parsed.waste_present_in_after ? 'failed' : 'confirmed';
  } else {
    decision = 'uncertain';
  }

  // 5. Write to verification_logs
  const { error: logError } = await supabaseAdmin.from('verification_logs').insert({
    report_id: reportId,
    before_image_url: beforeUrl,
    after_image_url: afterUrl,
    ai_model: env.AI_VISION_MODEL!,
    ai_prompt_version: PROMPT_VERSION,
    raw_response: parsed as unknown as Record<string, unknown>,
    confidence_score: parsed.confidence,
    decision,
    reasoning: parsed.reasoning,
    processing_ms: processingMs,
  });
  if (logError) console.error("Error inserting verification_log:", logError);

  // 6. Update report
  const verificationStatus =
    decision === 'confirmed' ? 'confirmed' :
    decision === 'failed'    ? 'failed'    :
                               'manual_review';

  const newReportStatus =
    decision === 'confirmed' ? 'resolved'             :
    decision === 'failed'    ? 'in_progress'          :
                               'pending_verification'; 

  const updatePayload: any = {
    verification_status: verificationStatus,
    verification_score: parsed.confidence,
    verification_reasoning: parsed.reasoning,
    verification_ran_at: new Date().toISOString(),
    status: newReportStatus,
  };

  if (decision === 'failed') {
    updatePayload.resolution_image_url = null;
    updatePayload.resolution_image_path = null;
  }

  const { error: repUpdateErr } = await supabaseAdmin.from('reports').update(updatePayload).eq('id', reportId);

  if (repUpdateErr) {
    console.error("Failed to update report status:", repUpdateErr);
    throw repUpdateErr;
  }

  // 7. Mint token only on confirmed
  if (decision === 'confirmed') {
    await mintToken(env, reportId);

    // After marking resolved and minting tokens, notify reporter via Telegram if chat_id exists
    try {
      const { data: updatedReport } = await supabaseAdmin
        .from('reports')
        .select('id, telegram_chat_id, location_address, image_url, resolution_image_url, verification_reasoning')
        .eq('id', reportId)
        .single();

      if (updatedReport?.telegram_chat_id) {
        const chatId = Number(updatedReport.telegram_chat_id);
        const botToken = env.TELEGRAM_BOT_TOKEN;
        const shortId = (updatedReport.id || "").toString().slice(0, 8);
        
        const summary = `<b>Resolution Summary:</b>\n${updatedReport.verification_reasoning || "The area has been successfully cleared and verified by our AI agent."}`;
        
        const caption = `✅ <b>Report Resolved!</b>\n\n` +
          `Your report #${shortId} has been closed.\n\n` +
          `${summary}\n\n` +
          `🌟 <b>Reward tokens have been added to your wallet!</b>\n` +
          (updatedReport.location_address ? `📍 ${updatedReport.location_address}` : "");

        const media: any[] = [];
        if (updatedReport.image_url) {
          media.push({ type: 'photo', media: updatedReport.image_url, caption: updatedReport.resolution_image_url ? undefined : caption, parse_mode: 'HTML' });
        }
        if (updatedReport.resolution_image_url) {
          media.push({ type: 'photo', media: updatedReport.resolution_image_url, caption: caption, parse_mode: 'HTML' });
        }

        if (media.length > 0) {
          await sendTelegramMediaGroup(botToken, chatId, media);
        } else {
          await sendTelegramMessage(botToken, chatId, caption);
        }
      }
    } catch (notifyErr) {
      console.error("Failed to notify reporter via Telegram about resolution:", notifyErr);
    }
  }

  // 8. Insert timeline event
  const finalAgentType = decision === 'confirmed' ? 'verification_confirmed' : 
                         decision === 'failed'    ? 'verification_failed' : 
                                                    'verification_manual_review';

  await upsertReportEvent(env, {
    reportId,
    agentType: finalAgentType as any,
    stageStatus: 'completed',
    message: decision === 'confirmed' ? 'Verification confirmed' : (decision === 'failed' ? 'Verification failed' : 'Flagged for manual review'),
    metadata: {
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      red_flags: parsed.red_flags,
    }
  });

  return {
    decision,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    red_flags: parsed.red_flags,
  };
}
