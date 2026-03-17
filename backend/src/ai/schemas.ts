import { z } from "zod";

const VALID_CATEGORIES = ["organic", "plastic", "e_waste", "construction", "hazardous", "mixed", "other"] as const;

export const WasteVerificationSchema = z.object({
  waste_category: z.string().transform((val) => {
    // Normalize AI output to valid enum values
    const lower = val.toLowerCase().replace(/[^a-z_]/g, "");
    if ((VALID_CATEGORIES as readonly string[]).includes(lower)) return lower as typeof VALID_CATEGORIES[number];
    if (lower.includes("organic")) return "organic";
    if (lower.includes("plastic") || lower.includes("recycl")) return "plastic";
    if (lower.includes("electronic") || lower.includes("ewaste") || lower.includes("e_waste")) return "e_waste";
    if (lower.includes("construct") || lower.includes("debris") || lower.includes("rubble")) return "construction";
    if (lower.includes("hazard") || lower.includes("chemical") || lower.includes("toxic")) return "hazardous";
    return "other";
  }),
  ai_quality_score: z.number().min(0).max(1),
  contamination_at_source: z.boolean(),
  contamination_feedback: z.string().default("No feedback provided"),

  // Authenticity signals: detect stock-photo watermarks, screenshot UI, or obvious internet branding.
  // Defaults keep backward compatibility if the model doesn't return them.
  source_authenticity: z.enum(["genuine", "likely_internet", "uncertain"]).default("uncertain"),
  has_watermark_or_stock_branding: z.boolean().default(false),
  has_screenshot_ui: z.boolean().default(false),
  internet_evidence: z.array(z.string()).default([])
});

export type WasteVerificationResult = z.infer<typeof WasteVerificationSchema>;

