import { GoogleGenAI, Type } from '@google/genai';
import type { Schema } from '@google/genai';
import { parseAndValidateAIResponse } from '../schemas/quickClick.schema.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function processVideoClip(videoFileBuffer?: Buffer) {
  const contents: any[] = [];
  if (videoFileBuffer && videoFileBuffer.length > 0) {
    contents.push({
      inlineData: {
        mimeType: 'video/mp4',
        data: videoFileBuffer.toString('base64'),
      },
    });
  }
  contents.push({ text: 'Analyze this clip and return the social media metadata.' });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      responseMimeType: 'application/json',
    },
  });

  // HIER EINFÜGEN: Rohe Antwort direkt vor der Weiterverarbeitung validieren
  const validatedData = parseAndValidateAIResponse(response.text);

  // validatedData ist ab hier garantiert frei von Dummy-Werten und typsicher:
  return validatedData;
}

// Lazy-Initialisierung des Gemini-Clients zur Vermeidung von Boot-Crashes bei fehlendem Key
let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY ist in den Server-Umgebungsvariablen nicht konfiguriert.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// -----------------------------------------------------------------------------
// 1. Social-Media Metadaten (TikTok, Shorts, Reels)
// -----------------------------------------------------------------------------
export interface ClipMetadataInput {
  streamer: string;
  game?: string;
  clipTitle: string;
  transcriptSnippet?: string;
}

export interface GeneratedSocialMetadata {
  viralTitle: string;
  hook: string;
  caption: string;
  hashtags: string[];
  suggestedPlatforms: ('tiktok' | 'youtube_shorts' | 'instagram_reels')[];
}

const socialMetadataSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    viralTitle: {
      type: Type.STRING,
      description: 'Ein klickstarker Kurztitel unter 60 Zeichen.',
    },
    hook: {
      type: Type.STRING,
      description: 'Der visuelle oder gesprochene Hook der ersten 3 Sekunden.',
    },
    caption: {
      type: Type.STRING,
      description: 'Kurze Social-Media-Beschreibung inklusive Call-to-Action.',
    },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '5 bis 8 virale Gaming-Hashtags ohne Duplikate.',
    },
    suggestedPlatforms: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Empfohlene Plattformen (tiktok, youtube_shorts, instagram_reels).',
    },
  },
  required: ['viralTitle', 'hook', 'caption', 'hashtags', 'suggestedPlatforms'],
};

export async function generateSocialMetadata(
  input: ClipMetadataInput
): Promise<GeneratedSocialMetadata> {
  const ai = getGeminiClient();
  const prompt = `
Analysiere diesen Gaming-Stream-Clip und erstelle zielgruppenoptimierte Metadaten für Kurzvideo-Plattformen:
- Streamer: ${input.streamer}
- Spiel/Kategorie: ${input.game || 'Gaming'}
- Originaler Clip-Titel: "${input.clipTitle}"
${input.transcriptSnippet ? `- Audio-Transkript / Highlight: "${input.transcriptSnippet}"` : ''}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction:
        'Du bist ein professioneller Social-Media-Stratege für Twitch-Clips und Kurzvideos. Antworte präzise und halte dich strikt an das vorgegebene JSON-Schema.',
      temperature: 0.7,
      responseMimeType: 'application/json',
      responseSchema: socialMetadataSchema,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini API hat eine leere Antwort geliefert.');
  return JSON.parse(text) as GeneratedSocialMetadata;
}

// -----------------------------------------------------------------------------
// 2. Virales Kurzvideo-Skript
// -----------------------------------------------------------------------------
export interface ViralScriptOptions {
  streamTitle?: string;
  channelName?: string;
  durationSec?: number;
  topic?: string;
  tone?: string;
}

export async function generateViralClipScript(options: ViralScriptOptions): Promise<string> {
  const ai = getGeminiClient();
  const prompt = `
Du bist ein weltklasse Viral Video Producer und Kurzvideo-Algorithmus-Experte (TikTok, YouTube Shorts, Instagram Reels).
Erstelle ein fesselndes Skript für einen 9:16 Gaming-Highlight-Clip basierend auf folgenden Stream-Daten:

- Stream-Titel: "${options.streamTitle || 'Epic Twitch Gameplay & Reaction'}"
- Twitch-Kanal: "${options.channelName || 'Streamer'}"
- Ziel-Länge: ${options.durationSec || 45} Sekunden
- Thema / Spiel: ${options.topic || 'Highlight-Momente & Community Interaction'}
- Tonalität: ${options.tone || 'Energisch, fesselnd, authentisch'}

Struktur:
1. Hook (Sekunde 0-3): Visueller & auditiver Aufhänger (Stop the Scroll)
2. Story/Gameplay Climax (Sekunde 4-45): Schneller Aufbau, prägnante Schnitt- und Sound-Hinweise [Cue: Sound Effect]
3. Call to Action (Sekunde 46-60): Twitch-Follow & YouTube-Abo Aufforderung
4. Optimierte Video-Beschreibung & 5 virale Hashtags
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      temperature: 0.75,
    },
  });

  return response.text || 'Skript konnte nicht generiert werden.';
}

// -----------------------------------------------------------------------------
// 3. Sponsoren-Pitch
// -----------------------------------------------------------------------------
export interface SponsorPitchOptions {
  sponsorName?: string;
  channelName?: string;
  avgViewers?: string;
  focusGame?: string;
  pricingEur?: number;
}

export async function generateSponsorPitch(options: SponsorPitchOptions): Promise<string> {
  const ai = getGeminiClient();
  const prompt = `
Formuliere eine hochprofessionelle Sponsoren-Pitch-E-Mail auf Deutsch für den Twitch-Kanal "${options.channelName || 'Streamer'}".
- Sponsor/Marke: ${options.sponsorName || 'Gaming Gear Brand'}
- Durchschnittliche Zuschauer (CCV): ${options.avgViewers || '150-300+ Live'}
- Hauptfokus / Spiel: ${options.focusGame || 'Gaming, Reaction & Community Events'}
- Angebotenes Paket: ${
    options.pricingEur
      ? `${options.pricingEur} € für dediziertes Twitch-Banner, 3x Live-Shoutouts & Clip-Integration`
      : 'Individuelles Kampagnenpaket'
  }

Anforderungen:
- Höflich, verbindlich und auf Augenhöhe
- Klare Nennung des Mehrwerts (hohe Conversion in der Gaming-Zielgruppe, Zero-Botting-Qualität)
- Strukturierter Aufbau mit Betreffzeile und Signatur
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  return response.text || 'Pitch konnte nicht generiert werden.';
}

// -----------------------------------------------------------------------------
// 4. Clip-Virality-Analyse
// -----------------------------------------------------------------------------
export async function analyzeClipVirality(
  clipTitle: string,
  gameName?: string
): Promise<{
  viralityScore: number;
  suggestions: string[];
  recommendedHashtags: string[];
}> {
  const ai = getGeminiClient();
  const prompt = `Analysiere den folgenden Clip-Titel für einen TikTok/Reels Gaming-Clip:
Titel: "${clipTitle}"
Spiel: "${gameName || 'Twitch Stream'}"`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          viralityScore: { type: Type.NUMBER },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedHashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['viralityScore', 'suggestions', 'recommendedHashtags'],
      },
    },
  });

  if (!response.text) {
    throw new Error('Gemini API hat keine Analyse-Antwort geliefert.');
  }
  return JSON.parse(response.text);
}

// -----------------------------------------------------------------------------
// 5. Architektur-Advisor (für AiArchitectureAdvisor.tsx)
// -----------------------------------------------------------------------------
export async function generateArchitectureAdvice(prompt: string): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      temperature: 0.4,
    },
  });

  return response.text || 'Keine Empfehlung generiert.';
}

// -----------------------------------------------------------------------------
// 6. QuickClick Engine Multimodal Video Intelligence Agent (Google AI Studio)
// -----------------------------------------------------------------------------
export const QUICKCLICK_ENGINE_SYSTEM_INSTRUCTION = `You are QuickClick Engine, an elite multimodal video intelligence and social media distribution agent specialized in live streams, gaming highlights, and fast-paced gameplay.

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

export interface QuickClickClipInput {
  clipTitle: string;
  streamerName?: string;
  game?: string;
  durationSec?: number;
  transcript?: string;
  videoUrl?: string;
  videoInlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface QuickClickEngineResult {
  clip_analysis: {
    virality_score: number;
    highlight_summary: string;
    hook_timestamp: string;
    peak_action_timestamp: string;
    recommended_trim: {
      start: string;
      end: string;
    };
  };
  content_generation: {
    viral_hooks: string[];
    social_posts: {
      tiktok: {
        title: string;
        caption: string;
        hashtags: string[];
      };
      youtube_shorts: {
        title: string;
        description: string;
        hashtags: string[];
      };
      reels: {
        caption: string;
        hashtags: string[];
      };
    };
    call_to_action: string;
  };
}

export const quickClickEngineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    clip_analysis: {
      type: Type.OBJECT,
      properties: {
        virality_score: {
          type: Type.INTEGER,
          description: 'Virality score from 0 to 100 based on hook velocity, reaction, clutch, and pacing.',
        },
        highlight_summary: {
          type: Type.STRING,
          description: '1-2 sentence breakdown of what happens in the clip.',
        },
        hook_timestamp: {
          type: Type.STRING,
          description: 'Exact timestamp interval for the hook, e.g. 00:00 - 00:03.',
        },
        peak_action_timestamp: {
          type: Type.STRING,
          description: 'Exact timestamp interval for the peak action/climax, e.g. 00:14 - 00:19.',
        },
        recommended_trim: {
          type: Type.OBJECT,
          properties: {
            start: { type: Type.STRING, description: 'Start timestamp, e.g. 00:00.' },
            end: { type: Type.STRING, description: 'End timestamp, e.g. 00:28.' },
          },
          required: ['start', 'end'],
        },
      },
      required: [
        'virality_score',
        'highlight_summary',
        'hook_timestamp',
        'peak_action_timestamp',
        'recommended_trim',
      ],
    },
    content_generation: {
      type: Type.OBJECT,
      properties: {
        viral_hooks: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Array of high-converting, curiosity-driven viral hook lines.',
        },
        social_posts: {
          type: Type.OBJECT,
          properties: {
            tiktok: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Bold, punchy title under 60 chars.' },
                caption: { type: Type.STRING, description: 'Curiosity-gap caption with organic CTA.' },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Relevant hashtags.' },
              },
              required: ['title', 'caption', 'hashtags'],
            },
            youtube_shorts: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Keyword-rich, searchable title.' },
                description: { type: Type.STRING, description: 'Engaging Shorts description.' },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Targeted tags.' },
              },
              required: ['title', 'description', 'hashtags'],
            },
            reels: {
              type: Type.OBJECT,
              properties: {
                caption: { type: Type.STRING, description: 'Short conversational caption with channel follow CTA.' },
                hashtags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'High-reach gaming tags.' },
              },
              required: ['caption', 'hashtags'],
            },
          },
          required: ['tiktok', 'youtube_shorts', 'reels'],
        },
        call_to_action: {
          type: Type.STRING,
          description: 'Streamer retention CTA tailored to following the channel or catching live stream.',
        },
      },
      required: ['viral_hooks', 'social_posts', 'call_to_action'],
    },
  },
  required: ['clip_analysis', 'content_generation'],
};

export async function analyzeClipWithQuickClickEngine(
  input: QuickClickClipInput
): Promise<QuickClickEngineResult> {
  const duration = input.durationSec || 30;
  const streamer = input.streamerName || 'Streamer';
  const game = input.game || 'FPS Highlight';

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const ai = getGeminiClient();

  const parts: any[] = [];
  if (input.videoInlineData) {
    parts.push({
      inlineData: {
        mimeType: input.videoInlineData.mimeType,
        data: input.videoInlineData.data,
      },
    });
  }

  const textPrompt = `Analyze this gaming highlight clip for multimodal virality and multi-platform distribution:
- Clip Title: "${input.clipTitle}"
- Streamer: ${streamer}
- Game / Category: ${game}
- Exact Runtime: ${duration} seconds
${input.transcript ? `- Stream Transcript: "${input.transcript}"` : ''}
${input.videoUrl ? `- Source Video URL: ${input.videoUrl}` : ''}

Strictly follow all instructions:
- Calculate real timestamps within 00:00 and ${formatSec(duration)}.
- Zero placeholders (no brackets, no template names).
- Return valid JSON matching the schema.`;

  parts.push({ text: textPrompt });

  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: { parts },
    config: {
      systemInstruction: QUICKCLICK_ENGINE_SYSTEM_INSTRUCTION,
      temperature: 0.5,
      topP: 0.9,
      responseMimeType: 'application/json',
      responseSchema: quickClickEngineSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('QuickClick Engine hat keine gültige Antwort von Gemini erhalten.');
  }

  const validated = parseAndValidateAIResponse(text);
  return validated as unknown as QuickClickEngineResult;
}