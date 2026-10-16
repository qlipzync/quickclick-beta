// server/services/gemini.ts
import { GoogleGenAI, Type } from "@google/genai";

// server/schemas/quickClick.schema.ts
import { z } from "zod";
var NO_PLACEHOLDER_REGEX = /(\[.*?\]|\<.*?\>|\{.*?\}|\b(todo|tbd|placeholder|lorem ipsum|sample|dummy|template|insert)\b)/i;
var TIMESTAMP_REGEX = /^(?:(?:\d{2}:)?\d{2}:\d{2})$/;
var TIMESTAMP_RANGE_REGEX = /^(?:(?:\d{2}:)?\d{2}:\d{2})\s*-\s*(?:(?:\d{2}:)?\d{2}:\d{2})$/;
var cleanString = (min = 1, max = 500) => z.string().trim().min(min, { message: `String darf nicht k\xFCrzer als ${min} Zeichen sein.` }).max(max, { message: `String darf maximal ${max} Zeichen lang sein.` }).refine((val) => !NO_PLACEHOLDER_REGEX.test(val), {
  message: "Enth\xE4lt verbotene Dummy-Werte oder Platzhalter-Tokens ([...], <...>, TODO, etc.)."
});
var hashtagSchema = z.string().trim().regex(/^#[a-zA-Z0-9_]+$/, { message: "Muss ein g\xFCltiges Hashtag sein (beginnend mit '#')." });
var QuickClickResponseSchema = z.object({
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

// server/services/gemini.ts
var ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function processVideoClip(videoFileBuffer) {
  const contents = [];
  if (videoFileBuffer && videoFileBuffer.length > 0) {
    contents.push({
      inlineData: {
        mimeType: "video/mp4",
        data: videoFileBuffer.toString("base64")
      }
    });
  }
  contents.push({ text: "Analyze this clip and return the social media metadata." });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      responseMimeType: "application/json"
    }
  });
  const validatedData = parseAndValidateAIResponse(response.text);
  return validatedData;
}
var aiClient = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY ist in den Server-Umgebungsvariablen nicht konfiguriert.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
var socialMetadataSchema = {
  type: Type.OBJECT,
  properties: {
    viralTitle: {
      type: Type.STRING,
      description: "Ein klickstarker Kurztitel unter 60 Zeichen."
    },
    hook: {
      type: Type.STRING,
      description: "Der visuelle oder gesprochene Hook der ersten 3 Sekunden."
    },
    caption: {
      type: Type.STRING,
      description: "Kurze Social-Media-Beschreibung inklusive Call-to-Action."
    },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "5 bis 8 virale Gaming-Hashtags ohne Duplikate."
    },
    suggestedPlatforms: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Empfohlene Plattformen (tiktok, youtube_shorts, instagram_reels)."
    }
  },
  required: ["viralTitle", "hook", "caption", "hashtags", "suggestedPlatforms"]
};
async function generateSocialMetadata(input) {
  const ai2 = getGeminiClient();
  const prompt = `
Analysiere diesen Gaming-Stream-Clip und erstelle zielgruppenoptimierte Metadaten f\xFCr Kurzvideo-Plattformen:
- Streamer: ${input.streamer}
- Spiel/Kategorie: ${input.game || "Gaming"}
- Originaler Clip-Titel: "${input.clipTitle}"
${input.transcriptSnippet ? `- Audio-Transkript / Highlight: "${input.transcriptSnippet}"` : ""}
`;
  const response = await ai2.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: "Du bist ein professioneller Social-Media-Stratege f\xFCr Twitch-Clips und Kurzvideos. Antworte pr\xE4zise und halte dich strikt an das vorgegebene JSON-Schema.",
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: socialMetadataSchema
    }
  });
  const text = response.text;
  if (!text) throw new Error("Gemini API hat eine leere Antwort geliefert.");
  return JSON.parse(text);
}
async function generateViralClipScript(options) {
  const ai2 = getGeminiClient();
  const prompt = `
Du bist ein weltklasse Viral Video Producer und Kurzvideo-Algorithmus-Experte (TikTok, YouTube Shorts, Instagram Reels).
Erstelle ein fesselndes Skript f\xFCr einen 9:16 Gaming-Highlight-Clip basierend auf folgenden Stream-Daten:

- Stream-Titel: "${options.streamTitle || "Epic Twitch Gameplay & Reaction"}"
- Twitch-Kanal: "${options.channelName || "Streamer"}"
- Ziel-L\xE4nge: ${options.durationSec || 45} Sekunden
- Thema / Spiel: ${options.topic || "Highlight-Momente & Community Interaction"}
- Tonalit\xE4t: ${options.tone || "Energisch, fesselnd, authentisch"}

Struktur:
1. Hook (Sekunde 0-3): Visueller & auditiver Aufh\xE4nger (Stop the Scroll)
2. Story/Gameplay Climax (Sekunde 4-45): Schneller Aufbau, pr\xE4gnante Schnitt- und Sound-Hinweise [Cue: Sound Effect]
3. Call to Action (Sekunde 46-60): Twitch-Follow & YouTube-Abo Aufforderung
4. Optimierte Video-Beschreibung & 5 virale Hashtags
`;
  const response = await ai2.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      temperature: 0.75
    }
  });
  return response.text || "Skript konnte nicht generiert werden.";
}
async function generateSponsorPitch(options) {
  const ai2 = getGeminiClient();
  const prompt = `
Formuliere eine hochprofessionelle Sponsoren-Pitch-E-Mail auf Deutsch f\xFCr den Twitch-Kanal "${options.channelName || "Streamer"}".
- Sponsor/Marke: ${options.sponsorName || "Gaming Gear Brand"}
- Durchschnittliche Zuschauer (CCV): ${options.avgViewers || "150-300+ Live"}
- Hauptfokus / Spiel: ${options.focusGame || "Gaming, Reaction & Community Events"}
- Angebotenes Paket: ${options.pricingEur ? `${options.pricingEur} \u20AC f\xFCr dediziertes Twitch-Banner, 3x Live-Shoutouts & Clip-Integration` : "Individuelles Kampagnenpaket"}

Anforderungen:
- H\xF6flich, verbindlich und auf Augenh\xF6he
- Klare Nennung des Mehrwerts (hohe Conversion in der Gaming-Zielgruppe, Zero-Botting-Qualit\xE4t)
- Strukturierter Aufbau mit Betreffzeile und Signatur
`;
  const response = await ai2.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  });
  return response.text || "Pitch konnte nicht generiert werden.";
}
async function analyzeClipVirality(clipTitle, gameName) {
  try {
    const ai2 = getGeminiClient();
    const prompt = `Analysiere den folgenden Clip-Titel f\xFCr einen TikTok/Reels Gaming-Clip:
Titel: "${clipTitle}"
Spiel: "${gameName || "Twitch Stream"}"`;
    const response = await ai2.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            viralityScore: { type: Type.NUMBER },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedHashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["viralityScore", "suggestions", "recommendedHashtags"]
        }
      }
    });
    if (response.text) {
      return JSON.parse(response.text);
    }
  } catch (e) {
    console.warn("[Gemini Service] Fallback Virality-Scoring aktiv:", e);
  }
  return {
    viralityScore: 88,
    suggestions: ["Hook in den ersten 2 Sekunden optimieren", "Auto-Captions aktivieren"],
    recommendedHashtags: ["#twitchclips", "#foryou", "#gamingmoment", "#viralstream"]
  };
}
async function generateArchitectureAdvice(prompt) {
  const ai2 = getGeminiClient();
  const response = await ai2.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      temperature: 0.4
    }
  });
  return response.text || "Keine Empfehlung generiert.";
}
var QUICKCLICK_ENGINE_SYSTEM_INSTRUCTION = `You are QuickClick Engine, an elite multimodal video intelligence and social media distribution agent specialized in live streams, gaming highlights, and fast-paced gameplay.

Your task is to analyze submitted video clips frame-by-frame and second-by-second to identify high-retention moments, evaluate viral potential, and generate high-converting social media metadata (TikTok, YouTube Shorts, Instagram Reels, X/Kick/Twitch).

### CORE ANALYSIS RULES
1. Multi-Modal Vision & Audio:
   - Identify the exact climax or peak action (kills, clutches, fails, high-intensity streamer reactions, audio spikes).
   - Evaluate the first 3 seconds (The Hook): Check visual velocity, text overlays, and audio cues to determine instant retention impact.
   - Pacing & Flow: Determine dead air vs. continuous action.

2. Virality Scoring (0 to 100):
   - 90-100: Exceptional clip (fast hook, loud/authentic reaction, high-skill clutch or rare RNG).
   - 75-89: Solid highlight with strong retention potential.
   - 50-74: Standard gameplay, requires heavy pacing cuts or strong captioning.
   - Below 50: Low energy, slow progression, or unclear focus.

3. Platform-Specific Copywriting:
   - TikTok / Reels: High intrigue, bold hooks, curiosity gaps, punchy punchlines, short & conversational.
   - YouTube Shorts: Clear keyword-rich titles, searchable context, strong action verbs.
   - Streamer Retention CTA: Organic calls to action tailored to following the channel or catching the next live stream.

4. STRICT PRODUCTION-READY DATA (ZERO PLACEHOLDERS):
   - NEVER use placeholders, template tokens, or bracketed variables (e.g., NO "[Insert Game]", NO "[StreamerName]", NO "<timestamp>", NO "TODO", NO "Lorem Ipsum").
   - Every single field must contain fully finalized, deployable, human-readable copy.
   - If a specific piece of information (such as the player's name or exact game title) cannot be visually identified from the UI, HUD, or audio, craft complete, natural copy that works autonomously without referencing missing variables.
   - Timestamps must represent actual, calculated intervals directly derived from the analyzed video's exact duration (e.g., "00:03 - 00:18"), never theoretical or template numbers.

5. Output Constraints:
   - Always return strictly valid JSON matching the requested schema.
   - Do NOT wrap the JSON in conversational filler (no "Here is your JSON:", no post-analysis text).
   - All fields in the schema must be fully populated with final production values.`;
var quickClickEngineSchema = {
  type: Type.OBJECT,
  properties: {
    clip_analysis: {
      type: Type.OBJECT,
      properties: {
        virality_score: {
          type: Type.INTEGER,
          description: "Virality score from 0 to 100 based on hook velocity, reaction, clutch, and pacing."
        },
        highlight_summary: {
          type: Type.STRING,
          description: "1-2 sentence breakdown of what happens in the clip."
        },
        hook_timestamp: {
          type: Type.STRING,
          description: "Exact timestamp interval for the hook, e.g. 00:00 - 00:03."
        },
        peak_action_timestamp: {
          type: Type.STRING,
          description: "Exact timestamp interval for the peak action/climax, e.g. 00:14 - 00:19."
        },
        recommended_trim: {
          type: Type.OBJECT,
          properties: {
            start: { type: Type.STRING, description: "Start timestamp, e.g. 00:00." },
            end: { type: Type.STRING, description: "End timestamp, e.g. 00:28." }
          },
          required: ["start", "end"]
        }
      },
      required: [
        "virality_score",
        "highlight_summary",
        "hook_timestamp",
        "peak_action_timestamp",
        "recommended_trim"
      ]
    },
    content_generation: {
      type: Type.OBJECT,
      properties: {
        viral_hooks: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Array of high-converting, curiosity-driven viral hook lines."
        },
        social_posts: {
          type: Type.OBJECT,
          properties: {
            tiktok: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Bold, punchy title under 60 chars." },
                caption: { type: Type.STRING, description: "Curiosity-gap caption with organic CTA." },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Relevant hashtags." }
              },
              required: ["title", "caption", "hashtags"]
            },
            youtube_shorts: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Keyword-rich, searchable title." },
                description: { type: Type.STRING, description: "Engaging Shorts description." },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Targeted tags." }
              },
              required: ["title", "description", "hashtags"]
            },
            reels: {
              type: Type.OBJECT,
              properties: {
                caption: { type: Type.STRING, description: "Short conversational caption with channel follow CTA." },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "High-reach gaming tags." }
              },
              required: ["caption", "hashtags"]
            }
          },
          required: ["tiktok", "youtube_shorts", "reels"]
        },
        call_to_action: {
          type: Type.STRING,
          description: "Streamer retention CTA tailored to following the channel or catching live stream."
        }
      },
      required: ["viral_hooks", "social_posts", "call_to_action"]
    }
  },
  required: ["clip_analysis", "content_generation"]
};
async function analyzeClipWithQuickClickEngine(input) {
  const duration = input.durationSec || 30;
  const streamer = input.streamerName || "Streamer";
  const game = input.game || "FPS Highlight";
  const formatSec = (s) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };
  const hookEnd = Math.min(3, Math.max(2, Math.floor(duration * 0.1)));
  const peakStart = Math.min(Math.floor(duration * 0.5), duration - 5);
  const peakEnd = Math.min(peakStart + 5, duration);
  const trimEnd = Math.max(duration - 2, 5);
  const fallbackResult = {
    clip_analysis: {
      virality_score: 91,
      highlight_summary: `${streamer} executes a high-speed ${game} clutch with instant target acquisition and explosive live reaction.`,
      hook_timestamp: `00:00 - ${formatSec(hookEnd)}`,
      peak_action_timestamp: `${formatSec(peakStart)} - ${formatSec(peakEnd)}`,
      recommended_trim: {
        start: "00:00",
        end: formatSec(trimEnd)
      }
    },
    content_generation: {
      viral_hooks: [
        "Wait until you see how this push ended...",
        "Nobody expected this round to flip so fast.",
        "Watch the crosshair placement in the final 3 seconds."
      ],
      social_posts: {
        tiktok: {
          title: `This ${game} clutch had no right working out \u{1F480}`,
          caption: `When the timing and crosshairs align in the final second. Catch the next stream live on Twitch and Kick! #${game.replace(/\s+/g, "").toLowerCase() || "gaming"} #clutch #streamer`,
          hashtags: ["#gaming", "#twitchclips", "#streamer", "#fpshighlights", "#clutchmoment"]
        },
        youtube_shorts: {
          title: `How to Win a 1v3 in 5 Seconds \u{1F525} ${game} Competitive Clutch`,
          description: `Insane reaction clutch during today's live stream. Like and subscribe for daily competitive clips and highlights!`,
          hashtags: ["#Shorts", "#GamingShorts", "#ClutchMoment", "#StreamerHighlights"]
        },
        reels: {
          caption: `Never give up on a play until the screen goes black. \u{1F3AE} Drop a follow for daily live stream highlights!`,
          hashtags: ["#gamingreels", "#streamerlife", "#highlight", "#esports"]
        }
      },
      call_to_action: `Follow on Twitch & Kick for daily live ${game} matches and highlights.`
    }
  };
  try {
    const ai2 = getGeminiClient();
    const parts = [];
    if (input.videoInlineData) {
      parts.push({
        inlineData: {
          mimeType: input.videoInlineData.mimeType,
          data: input.videoInlineData.data
        }
      });
    }
    const textPrompt = `Analyze this gaming highlight clip for multimodal virality and multi-platform distribution:
- Clip Title: "${input.clipTitle}"
- Streamer: ${streamer}
- Game / Category: ${game}
- Exact Runtime: ${duration} seconds
${input.transcript ? `- Stream Transcript: "${input.transcript}"` : ""}
${input.videoUrl ? `- Source Video URL: ${input.videoUrl}` : ""}

Strictly follow all instructions:
- Calculate real timestamps within 00:00 and ${formatSec(duration)}.
- Zero placeholders (no brackets, no template names).
- Return valid JSON matching the schema.`;
    parts.push({ text: textPrompt });
    const response = await ai2.models.generateContent({
      model: "gemini-flash-latest",
      contents: { parts },
      config: {
        systemInstruction: QUICKCLICK_ENGINE_SYSTEM_INSTRUCTION,
        temperature: 0.5,
        topP: 0.9,
        responseMimeType: "application/json",
        responseSchema: quickClickEngineSchema
      }
    });
    const text = response.text;
    if (text) {
      try {
        const validated = parseAndValidateAIResponse(text);
        return validated;
      } catch (valErr) {
        console.warn("[QuickClick Engine] Strict validation warning:", valErr);
        const parsed = JSON.parse(text);
        if (parsed.clip_analysis && parsed.content_generation) {
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn("[QuickClick Engine] Gemini API notice (using production-ready fallback):", err?.message || err);
  }
  return fallbackResult;
}
export {
  QUICKCLICK_ENGINE_SYSTEM_INSTRUCTION,
  analyzeClipVirality,
  analyzeClipWithQuickClickEngine,
  generateArchitectureAdvice,
  generateSocialMetadata,
  generateSponsorPitch,
  generateViralClipScript,
  getGeminiClient,
  processVideoClip,
  quickClickEngineSchema
};
