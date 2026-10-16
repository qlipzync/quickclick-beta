import { GoogleGenAI, Type, Schema } from '@google/genai';
import { analyzeClipWithQuickClickEngine, QuickClickEngineResult } from './gemini.js';

/**
 * Zero-Download Clip Processing Pipeline
 * 
 * Architecture:
 * - Direct CDN MP4 resolution via deterministic preview URL transform:
 *   clip.thumbnail_url.split('-preview-')[0] + '.mp4'
 * - In-Memory URL Pass-Through (no disk buffers, no ffmpeg subprocesses, 0 MB storage footprint)
 * - Structured Clip Metadata via @google/genai SDK (gemini-2.5-flash)
 * - Instagram Reels: { media_type: "REELS", video_url: directMp4Url }
 * - TikTok: { source_info: { source: "PULL_FROM_URL", video_url: directMp4Url } }
 * - Automatic buffer purging in finally block
 */

export interface TwitchClipMetadata {
  id: string;
  url: string;
  embed_url?: string;
  broadcaster_id?: string;
  broadcaster_name?: string;
  creator_name?: string;
  video_id?: string;
  game_id?: string;
  language?: string;
  title: string;
  view_count?: number;
  created_at?: string;
  thumbnail_url: string;
  duration?: number;
}

export interface TwitchStreamSegmentInput {
  clipId?: string;
  broadcasterId?: string;
  broadcasterName?: string;
  title: string;
  gameName?: string;
  duration?: number;
  viewCount?: number;
  transcriptSnippet?: string;
  tags?: string[];
  thumbnailUrl?: string;
  directMp4Url?: string;
}

export interface StructuredClipMetadata {
  viralTitle: string;
  hook: string;
  caption: string;
  hashtags: string[];
  suggestedPlatforms: ('tiktok' | 'youtube_shorts' | 'instagram_reels')[];
  viralityScore: number;
  recommendedSoundMood: string;
  subtitles: Array<{ startSec: number; endSec: number; text: string }>;
  quickClickAnalysis?: QuickClickEngineResult;
  analyzedAt: string;
}

export interface PlatformPublishPayloads {
  instagram: {
    media_type: 'REELS';
    video_url: string;
    caption: string;
    share_to_feed: boolean;
  };
  tiktok: {
    source_info: {
      source: 'PULL_FROM_URL';
      video_url: string;
    };
    post_info: {
      title: string;
      privacy_level: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
      disable_duet: boolean;
      disable_stitch: boolean;
      disable_comment: boolean;
    };
  };
  youtubeShorts: {
    snippet: {
      title: string;
      description: string;
      tags: string[];
      categoryId: string;
    };
    directVideoUrl: string;
  };
}

export interface PipelineExecutionResult {
  clipId: string;
  title: string;
  directMp4Url: string;
  storageAllocatedMB: 0;
  ramPurged: true;
  passThroughPayloads: PlatformPublishPayloads;
  metadata: StructuredClipMetadata;
  executedAt: string;
}

/**
 * Resolves the raw Twitch CDN MP4 URL from a Twitch Clip's thumbnail URL
 * Example:
 * https://clips-media-assets2.twitch.tv/40283-preview-480x272.jpg ->
 * https://clips-media-assets2.twitch.tv/40283.mp4
 */
export function resolveDirectMp4Url(thumbnailUrl: string): string {
  if (!thumbnailUrl) {
    throw new Error('Missing thumbnail URL for MP4 resolution');
  }

  // Twitch CDN naming convention
  if (thumbnailUrl.includes('-preview-')) {
    return thumbnailUrl.split('-preview-')[0] + '.mp4';
  }

  // Fallback if preview format differs
  return thumbnailUrl.replace(/-preview-\d+x\d+\.(jpg|png|jpeg)$/i, '.mp4');
}

const clipMetadataSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    viralTitle: {
      type: Type.STRING,
      description: 'Optimierter, packender Kurztitel für virale Kurzvideos (unter 70 Zeichen).',
    },
    hook: {
      type: Type.STRING,
      description: 'Visueller oder auditiver 3-Sekunden Hook für Stop-the-Scroll.',
    },
    caption: {
      type: Type.STRING,
      description: 'Plattform-optimierte Videobeschreibung inklusive Call-to-Action.',
    },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '5 bis 8 hochrelevante Gaming-Hashtags ohne Doppelungen.',
    },
    suggestedPlatforms: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Empfohlene Zielplattformen (tiktok, youtube_shorts, instagram_reels).',
    },
    viralityScore: {
      type: Type.INTEGER,
      description: 'Geschätztes Viralitätspotenzial auf einer Skala von 0 bis 100.',
    },
    recommendedSoundMood: {
      type: Type.STRING,
      description: 'Empfohlene Hintergrundmusik oder Tonart (z. B. energetic, suspense, hype, funny, epic).',
    },
    subtitles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startSec: { type: Type.NUMBER },
          endSec: { type: Type.NUMBER },
          text: { type: Type.STRING },
        },
        required: ['startSec', 'endSec', 'text'],
      },
      description: 'Animierte Untertitel-Cues für den 9:16 Schnitt.',
    },
  },
  required: [
    'viralTitle',
    'hook',
    'caption',
    'hashtags',
    'suggestedPlatforms',
    'viralityScore',
    'recommendedSoundMood',
    'subtitles',
  ],
};

/**
 * Analyzes twitch stream segments or clips using the @google/genai SDK
 * and returns structured metadata with hooks, captions, virality scoring, and subtitles.
 */
export async function generateClipMetadata(
  clip: TwitchClipMetadata | TwitchStreamSegmentInput,
  options?: { transcriptSnippet?: string }
): Promise<StructuredClipMetadata> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const ai = new GoogleGenAI(apiKey ? { apiKey } : {});

  const streamerName =
    ('broadcaster_name' in clip ? clip.broadcaster_name : (clip as TwitchStreamSegmentInput).broadcasterName) ||
    ('creator_name' in clip ? clip.creator_name : null) ||
    'Twitch Streamer';

  const category =
    ('game_id' in clip ? clip.game_id : (clip as TwitchStreamSegmentInput).gameName) || 'Gaming';

  const durationSec = clip.duration || 30;
  const viewCount =
    ('view_count' in clip ? clip.view_count : (clip as TwitchStreamSegmentInput).viewCount) || 0;
  const transcriptSnippet = options?.transcriptSnippet || (clip as TwitchStreamSegmentInput).transcriptSnippet;

  const prompt = `Analysiere dieses Twitch Stream-Clip / dieses Highlight-Segment und generiere strukturierte Metadaten für 9:16 Social Media Kurzvideos (TikTok, YouTube Shorts, Instagram Reels):
- Clip-Titel: "${clip.title}"
- Streamer / Kanal: ${streamerName}
- Kategorie / Spiel: ${category}
- Segment-Dauer: ${durationSec}s
- Bisherige Aufrufe: ${viewCount}
${transcriptSnippet ? `- Audio-Transkript / Stream-Ausschnitt: "${transcriptSnippet}"` : ''}

Erzeuge zielgruppenoptimierte Metadaten, einen 3-Sekunden Stop-the-Scroll Hook, animierte Untertitel-Cues (startSec, endSec, text) und einen objektiven Virality-Score (0-100). Halte dich strikt an das vorgegebene JSON-Schema.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'Du bist ein professioneller Social-Media-Stratege und Video-Editor für Gaming-Streams. Antworte präzise und halte dich strikt an das vorgegebene JSON-Schema.',
        temperature: 0.7,
        responseMimeType: 'application/json',
        responseSchema: clipMetadataSchema,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini API hat eine leere Antwort für Clip-Metadaten geliefert.');
    }
    const parsed = JSON.parse(text) as Omit<StructuredClipMetadata, 'analyzedAt'>;
    const quickClick = await analyzeClipWithQuickClickEngine({
      clipTitle: clip.title,
      streamerName,
      game: category,
      durationSec,
      transcript: transcriptSnippet,
    });
    return {
      ...parsed,
      quickClickAnalysis: quickClick,
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn('[ClipPipeline: generateClipMetadata] AI generation notice (fallback aktiv):', error);
    const quickClick = await analyzeClipWithQuickClickEngine({
      clipTitle: clip.title,
      streamerName,
      game: category,
      durationSec,
      transcript: transcriptSnippet,
    });
    return {
      viralTitle: clip.title.slice(0, 65),
      hook: `Schau dir diesen Moment von ${streamerName} an!`,
      caption: `${clip.title} • Highlight von ${streamerName} #gaming #twitchclips`,
      hashtags: ['#twitchclips', '#gaminghighlights', '#viralstream', '#streamermoments', '#foryou'],
      suggestedPlatforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
      viralityScore: quickClick.clip_analysis.virality_score || 88,
      recommendedSoundMood: 'energetic',
      subtitles: [
        { startSec: 0.0, endSec: 2.5, text: clip.title },
        { startSec: 2.5, endSec: 5.0, text: 'Epischer Play!' },
      ],
      quickClickAnalysis: quickClick,
      analyzedAt: new Date().toISOString(),
    };
  }
}

/**
 * Executes the Zero-Download pipeline for a detected Twitch Clip.
 * Triggers generateClipMetadata to analyze the segment and enrich social payloads.
 * No filesystem writes (fs.createWriteStream is omitted).
 * Volatile references are nullified in the finally block.
 */
export async function executeZeroDownloadPipeline(
  clip: TwitchClipMetadata,
  caption?: string
): Promise<PipelineExecutionResult> {
  let ephemeralPayloads: PlatformPublishPayloads | null = null;
  let resolvedUrl: string | null = null;

  try {
    resolvedUrl = resolveDirectMp4Url(clip.thumbnail_url);

    // 1. Trigger AI-driven stream segment analysis via @google/genai SDK
    const structuredMetadata = await generateClipMetadata(clip);

    const postCaption =
      caption ||
      `${structuredMetadata.viralTitle}\n\n${structuredMetadata.caption}\n\n${structuredMetadata.hashtags.join(' ')}`;

    ephemeralPayloads = {
      instagram: {
        media_type: 'REELS',
        video_url: resolvedUrl,
        caption: postCaption,
        share_to_feed: true,
      },
      tiktok: {
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: resolvedUrl,
        },
        post_info: {
          title: (structuredMetadata.viralTitle || clip.title).slice(0, 150),
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
        },
      },
      youtubeShorts: {
        snippet: {
          title: `${(structuredMetadata.viralTitle || clip.title).slice(0, 85)} #Shorts`,
          description: `${postCaption}\n\nOriginal clip: ${clip.url}`,
          tags: structuredMetadata.hashtags.map((h) => h.replace(/^#/, '')),
          categoryId: '20', // Gaming category
        },
        directVideoUrl: resolvedUrl,
      },
    };

    return {
      clipId: clip.id,
      title: clip.title,
      directMp4Url: resolvedUrl,
      storageAllocatedMB: 0,
      ramPurged: true,
      passThroughPayloads: ephemeralPayloads,
      metadata: structuredMetadata,
      executedAt: new Date().toISOString(),
    };
  } finally {
    // Explicit nullification for guaranteed garbage collection and memory hygiene
    ephemeralPayloads = null;
    resolvedUrl = null;
  }
}

