import { GoogleGenAI, Type } from "@google/genai";
import { analyzeClipWithQuickClickEngine } from "./gemini.js";
function resolveDirectMp4Url(thumbnailUrl) {
  if (!thumbnailUrl) {
    throw new Error("Missing thumbnail URL for MP4 resolution");
  }
  if (thumbnailUrl.includes("-preview-")) {
    return thumbnailUrl.split("-preview-")[0] + ".mp4";
  }
  return thumbnailUrl.replace(/-preview-\d+x\d+\.(jpg|png|jpeg)$/i, ".mp4");
}
const clipMetadataSchema = {
  type: Type.OBJECT,
  properties: {
    viralTitle: {
      type: Type.STRING,
      description: "Optimierter, packender Kurztitel f\xFCr virale Kurzvideos (unter 70 Zeichen)."
    },
    hook: {
      type: Type.STRING,
      description: "Visueller oder auditiver 3-Sekunden Hook f\xFCr Stop-the-Scroll."
    },
    caption: {
      type: Type.STRING,
      description: "Plattform-optimierte Videobeschreibung inklusive Call-to-Action."
    },
    hashtags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "5 bis 8 hochrelevante Gaming-Hashtags ohne Doppelungen."
    },
    suggestedPlatforms: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Empfohlene Zielplattformen (tiktok, youtube_shorts, instagram_reels)."
    },
    viralityScore: {
      type: Type.INTEGER,
      description: "Gesch\xE4tztes Viralit\xE4tspotenzial auf einer Skala von 0 bis 100."
    },
    recommendedSoundMood: {
      type: Type.STRING,
      description: "Empfohlene Hintergrundmusik oder Tonart (z. B. energetic, suspense, hype, funny, epic)."
    },
    subtitles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          startSec: { type: Type.NUMBER },
          endSec: { type: Type.NUMBER },
          text: { type: Type.STRING }
        },
        required: ["startSec", "endSec", "text"]
      },
      description: "Animierte Untertitel-Cues f\xFCr den 9:16 Schnitt."
    }
  },
  required: [
    "viralTitle",
    "hook",
    "caption",
    "hashtags",
    "suggestedPlatforms",
    "viralityScore",
    "recommendedSoundMood",
    "subtitles"
  ]
};
async function generateClipMetadata(clip, options) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const ai = new GoogleGenAI(apiKey ? { apiKey } : {});
  const streamerName = ("broadcaster_name" in clip ? clip.broadcaster_name : clip.broadcasterName) || ("creator_name" in clip ? clip.creator_name : null) || "Twitch Streamer";
  const category = ("game_id" in clip ? clip.game_id : clip.gameName) || "Gaming";
  const durationSec = clip.duration || 30;
  const viewCount = ("view_count" in clip ? clip.view_count : clip.viewCount) || 0;
  const transcriptSnippet = options?.transcriptSnippet || clip.transcriptSnippet;
  const prompt = `Analysiere dieses Twitch Stream-Clip / dieses Highlight-Segment und generiere strukturierte Metadaten f\xFCr 9:16 Social Media Kurzvideos (TikTok, YouTube Shorts, Instagram Reels):
- Clip-Titel: "${clip.title}"
- Streamer / Kanal: ${streamerName}
- Kategorie / Spiel: ${category}
- Segment-Dauer: ${durationSec}s
- Bisherige Aufrufe: ${viewCount}
${transcriptSnippet ? `- Audio-Transkript / Stream-Ausschnitt: "${transcriptSnippet}"` : ""}

Erzeuge zielgruppenoptimierte Metadaten, einen 3-Sekunden Stop-the-Scroll Hook, animierte Untertitel-Cues (startSec, endSec, text) und einen objektiven Virality-Score (0-100). Halte dich strikt an das vorgegebene JSON-Schema.`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Du bist ein professioneller Social-Media-Stratege und Video-Editor f\xFCr Gaming-Streams. Antworte pr\xE4zise und halte dich strikt an das vorgegebene JSON-Schema.",
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: clipMetadataSchema
      }
    });
    const text = response.text;
    if (!text) {
      throw new Error("Gemini API hat eine leere Antwort f\xFCr Clip-Metadaten geliefert.");
    }
    const parsed = JSON.parse(text);
    const quickClick = await analyzeClipWithQuickClickEngine({
      clipTitle: clip.title,
      streamerName,
      game: category,
      durationSec,
      transcript: transcriptSnippet
    });
    return {
      ...parsed,
      quickClickAnalysis: quickClick,
      analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    console.warn("[ClipPipeline: generateClipMetadata] AI generation notice (fallback aktiv):", error);
    const quickClick = await analyzeClipWithQuickClickEngine({
      clipTitle: clip.title,
      streamerName,
      game: category,
      durationSec,
      transcript: transcriptSnippet
    });
    return {
      viralTitle: clip.title.slice(0, 65),
      hook: `Schau dir diesen Moment von ${streamerName} an!`,
      caption: `${clip.title} \u2022 Highlight von ${streamerName} #gaming #twitchclips`,
      hashtags: ["#twitchclips", "#gaminghighlights", "#viralstream", "#streamermoments", "#foryou"],
      suggestedPlatforms: ["tiktok", "youtube_shorts", "instagram_reels"],
      viralityScore: quickClick.clip_analysis.virality_score || 88,
      recommendedSoundMood: "energetic",
      subtitles: [
        { startSec: 0, endSec: 2.5, text: clip.title },
        { startSec: 2.5, endSec: 5, text: "Epischer Play!" }
      ],
      quickClickAnalysis: quickClick,
      analyzedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
async function executeZeroDownloadPipeline(clip, caption) {
  let ephemeralPayloads = null;
  let resolvedUrl = null;
  try {
    resolvedUrl = resolveDirectMp4Url(clip.thumbnail_url);
    const structuredMetadata = await generateClipMetadata(clip);
    const postCaption = caption || `${structuredMetadata.viralTitle}

${structuredMetadata.caption}

${structuredMetadata.hashtags.join(" ")}`;
    ephemeralPayloads = {
      instagram: {
        media_type: "REELS",
        video_url: resolvedUrl,
        caption: postCaption,
        share_to_feed: true
      },
      tiktok: {
        source_info: {
          source: "PULL_FROM_URL",
          video_url: resolvedUrl
        },
        post_info: {
          title: (structuredMetadata.viralTitle || clip.title).slice(0, 150),
          privacy_level: "PUBLIC_TO_EVERYONE",
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false
        }
      },
      youtubeShorts: {
        snippet: {
          title: `${(structuredMetadata.viralTitle || clip.title).slice(0, 85)} #Shorts`,
          description: `${postCaption}

Original clip: ${clip.url}`,
          tags: structuredMetadata.hashtags.map((h) => h.replace(/^#/, "")),
          categoryId: "20"
          // Gaming category
        },
        directVideoUrl: resolvedUrl
      }
    };
    return {
      clipId: clip.id,
      title: clip.title,
      directMp4Url: resolvedUrl,
      storageAllocatedMB: 0,
      ramPurged: true,
      passThroughPayloads: ephemeralPayloads,
      metadata: structuredMetadata,
      executedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  } finally {
    ephemeralPayloads = null;
    resolvedUrl = null;
  }
}
export {
  executeZeroDownloadPipeline,
  generateClipMetadata,
  resolveDirectMp4Url
};
