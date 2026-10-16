import { z } from "zod";

// 1. Regex für typische Platzhalter, Klammer-Tokens und Dummy-Begriffe
const NO_PLACEHOLDER_REGEX = /(\[.*?\]|\<.*?\>|\{.*?\}|\b(todo|tbd|placeholder|lorem ipsum|sample|dummy|template|insert)\b)/i;

// 2. Regex für Timestamps (z. B. "00:15" oder "01:23:45")
const TIMESTAMP_REGEX = /^(?:(?:\d{2}:)?\d{2}:\d{2})$/;

// 3. Regex für Timestamp-Intervalle (z. B. "00:00 - 00:03")
const TIMESTAMP_RANGE_REGEX = /^(?:(?:\d{2}:)?\d{2}:\d{2})\s*-\s*(?:(?:\d{2}:)?\d{2}:\d{2})$/;

// Wiederverwendbarer String-Validator gegen Platzhalter & Leerstrings
const cleanString = (min = 1, max = 500) =>
  z
    .string()
    .trim()
    .min(min, { message: `String darf nicht kürzer als ${min} Zeichen sein.` })
    .max(max, { message: `String darf maximal ${max} Zeichen lang sein.` })
    .refine((val) => !NO_PLACEHOLDER_REGEX.test(val), {
      message: "Enthält verbotene Dummy-Werte oder Platzhalter-Tokens ([...], <...>, TODO, etc.).",
    });

// Validator für Hashtags (#gaming, #clutch)
const hashtagSchema = z
  .string()
  .trim()
  .regex(/^#[a-zA-Z0-9_]+$/, { message: "Muss ein gültiges Hashtag sein (beginnend mit '#')." });

// Haupt-Schema für QuickClick
export const QuickClickResponseSchema = z.object({
  clip_analysis: z.object({
    virality_score: z
      .number()
      .int()
      .min(0, "Score kann nicht kleiner als 0 sein.")
      .max(100, "Score kann nicht größer als 100 sein."),

    highlight_summary: cleanString(10, 300),

    hook_timestamp: z
      .string()
      .trim()
      .regex(TIMESTAMP_RANGE_REGEX, "Ungültiges Timestamp-Intervall (Erwartet: MM:SS - MM:SS)."),

    peak_action_timestamp: z
      .string()
      .trim()
      .regex(TIMESTAMP_RANGE_REGEX, "Ungültiges Timestamp-Intervall (Erwartet: MM:SS - MM:SS)."),

    recommended_trim: z.object({
      start: z
        .string()
        .trim()
        .regex(TIMESTAMP_REGEX, "Ungültiges Start-Format (Erwartet: MM:SS)."),
      end: z
        .string()
        .trim()
        .regex(TIMESTAMP_REGEX, "Ungültiges End-Format (Erwartet: MM:SS)."),
    }),
  }),

  content_generation: z.object({
    viral_hooks: z
      .array(cleanString(5, 120))
      .min(1, "Mindestens 1 Hook erforderlich.")
      .max(5, "Maximal 5 Hooks erlaubt."),

    social_posts: z.object({
      tiktok: z.object({
        title: cleanString(3, 100),
        caption: cleanString(10, 500),
        hashtags: z.array(hashtagSchema).min(1).max(10),
      }),
      youtube_shorts: z.object({
        title: cleanString(5, 100),
        description: cleanString(10, 1000),
        hashtags: z.array(hashtagSchema).min(1).max(10),
      }),
      reels: z.object({
        caption: cleanString(10, 500),
        hashtags: z.array(hashtagSchema).min(1).max(10),
      }),
    }),

    call_to_action: cleanString(5, 150),
  }),
});

// Automatische TypeScript-Typinferenz
export type QuickClickResponse = z.infer<typeof QuickClickResponseSchema>;

/**
 * Parst und validiert die rohe Antwort des Gemini-Modells strikt gegen das QuickClick-Schema.
 * Entfernt eventuelle Markdown-Code-Wrapper (z. B. ```json ... ```) und stellt sicher,
 * dass das Ergebnis frei von Dummy-Werten, wohlgeformt und typsicher ist.
 */
export function parseAndValidateAIResponse(rawResponse: unknown): QuickClickResponse {
  let jsonString: string;

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
    throw new Error(`Ungültige KI-Antwort erhalten: ${String(rawResponse)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error(
      `KI-Antwort konnte nicht als JSON geparst werden: ${err?.message || err}. Rohdaten: ${jsonString.slice(0, 200)}`
    );
  }

  return QuickClickResponseSchema.parse(parsed);
}
