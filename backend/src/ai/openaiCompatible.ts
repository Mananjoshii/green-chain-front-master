import OpenAI from "openai";
import type { z } from "zod";
import type { Env } from "../env.js";

export class AiJsonError extends Error {
  statusCode = 502 as const;
}

function extractJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) throw new AiJsonError("AI response did not contain JSON object");
  return text.slice(first, last + 1);
}

export function getOpenAI(env: Env) {
  return new OpenAI({
    apiKey: env.AI_API_KEY,
    baseURL: env.AI_BASE_URL
  });
}

export async function getStructuredJson<T>(
  env: Env,
  opts: {
    model: string;
    system: string;
    user: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;
    schema: z.ZodType<T>;
    maxRetries?: number;
  }
): Promise<T> {
  const client = getOpenAI(env);
  const maxRetries = opts.maxRetries ?? 2;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: opts.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              {
                type: "text",
                text:
                  `${opts.system}\n\n` +
                  "Return ONLY a single JSON object. No markdown, no code fences, no extra text."
              }
            ]
          },
          {
            role: "user",
            content: opts.user
          }
        ]
      });

      const raw = completion.choices?.[0]?.message?.content ?? "";
      const jsonText = extractJsonObject(raw);
      const parsed = JSON.parse(jsonText);
      return opts.schema.parse(parsed);
    } catch (err) {
      lastErr = err;
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : "Unknown AI error";
  throw new AiJsonError(`AI structured JSON failed: ${msg}`);
}

