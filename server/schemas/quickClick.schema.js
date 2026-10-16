import { z } from "zod";
const NO_PLACEHOLDER_REGEX = /(\[.*?\]|\<.*?\>|\{.*?\}|\b(todo|tbd|placeholder|lorem ipsum|sample|dummy|template|insert)\b)/i;
const TIMESTAMP_REGEX = /^(?:(?:\d{2}:)?\d{2}:\d{2})$/;
const TIMESTAMP_RANGE_REGEX = /^(?:(?:\d{2}:)?\d{2}:\d{2})\s*-\s*(?:(?:\d{2}:)?\d{2}:\d{2})$/;
const cleanString = (min = 1, max = 500) => z.string().trim().min(min, { message: `String darf nicht k\xFCrzer als ${min} Zeichen sein.` }).max(max, { message: `String darf maximal ${max} Zeichen lang sein.` }).refine((val) => !NO_PLACEHOLDER_REGEX.test(val), {
  message: "Enth\xE4lt verbotene Dummy-Werte oder Platzhalter-Tokens ([...], <...>, TODO, etc.)."
});
const hashtagSchema = z.string().trim().regex(/^#[a-zA-Z0-9_]+$/, { message: "Muss ein g\xFCltiges Hashtag sein (beginnend mit '#')." });
const QuickClickResponseSchema = z.object({
  clip_analysis: z.object({
    virality_score: z.number().int().min(0, "Score kann nicht kleiner als 0 sein.").max(100, "Score kann nicht gr\xF6\xDFer als 100 sein."),
    highlight_summary: cleanString(10, 300),
    hook_timestamp: z.string().trim().regex(TIMESTAMP_RANGE_REGEX, "Ung\xFCltiges Timestamp-Intervall (Erwartet: MM:SS - MM:SS)."),
    peak_action_timestamp: z.string().trim().regex(TIMESTAMP_RANGE_REGEX, "Ung\xFCltiges Timestamp-Intervall (Erwartet: MM:SS - MM:SS)."),
    recommended_trim: z.object({
      start: z.string().trim().regex(TIMESTAMP_REGEX, "Ung\xFCltiges Start-Format (Erwartet: MM:SS)."),
      end: z.string().trim().regex(TIMESTAMP_REGEX, "Ung\xFCltiges End-Format (Erwartet: MM:SS).")
    })
  }),
  content_generation: z.object({
    viral_hooks: z.array(cleanString(5, 120)).min(1, "Mindestens 1 Hook erforderlich.").max(5, "Maximal 5 Hooks erlaubt."),
    social_posts: z.object({
      tiktok: z.object({
        title: cleanString(3, 100),
        caption: cleanString(10, 500),
        hashtags: z.array(hashtagSchema).min(1).max(10)
      }),
      youtube_shorts: z.object({
        title: cleanString(5, 100),
        description: cleanString(10, 1e3),
        hashtags: z.array(hashtagSchema).min(1).max(10)
      }),
      reels: z.object({
        caption: cleanString(10, 500),
        hashtags: z.array(hashtagSchema).min(1).max(10)
      })
    }),
    call_to_action: cleanString(5, 150)
  })
});
function parseAndValidateAIResponse(rawResponse) {
  let jsonString;
  if (typeof rawResponse === "string") {
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    jsonString = cleaned.trim();
  } else if (rawResponse && typeof rawResponse === "object") {
    return QuickClickResponseSchema.parse(rawResponse);
  } else {
    throw new Error(`Ung\xFCltige KI-Antwort erhalten: ${String(rawResponse)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(
      `KI-Antwort konnte nicht als JSON geparst werden: ${err?.message || err}. Rohdaten: ${jsonString.slice(0, 200)}`
    );
  }
  return QuickClickResponseSchema.parse(parsed);
}
export {
  QuickClickResponseSchema,
  parseAndValidateAIResponse
};
