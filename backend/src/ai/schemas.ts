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
  contamination_feedback: z.string().default("No feedback provided")
});

export type WasteVerificationResult = z.infer<typeof WasteVerificationSchema>;

