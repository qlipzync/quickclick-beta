import { Router } from "express";
import {
  generateSocialMetadata,
  generateViralClipScript,
  generateSponsorPitch,
  analyzeClipVirality,
  generateArchitectureAdvice,
  analyzeClipWithQuickClickEngine,
  QUICKCLICK_ENGINE_SYSTEM_INSTRUCTION,
  quickClickEngineSchema
} from "../services/gemini.js";
import { requireAuth, requireActiveSubscription } from "../middleware/authMiddleware.js";
const aiRouter = Router();
aiRouter.post(["/metadata", "/generate-metadata", "/generate-clip-metadata"], requireAuth, requireActiveSubscription, async (req, res) => {
  const { streamer, game, clipTitle, transcriptSnippet } = req.body;
  if (!streamer || !clipTitle) {
    res.status(400).json({
      error: 'Fehlende Pflichtfelder: "streamer" und "clipTitle" werden zwingend ben\xF6tigt.'
    });
    return;
  }
  try {
    const metadata = await generateSocialMetadata({
      streamer: String(streamer).trim(),
      game: game ? String(game).trim() : void 0,
      clipTitle: String(clipTitle).trim(),
      transcriptSnippet: transcriptSnippet ? String(transcriptSnippet).trim() : void 0
    });
    res.status(200).json({ success: true, data: metadata });
  } catch (error) {
    res.status(error?.status === 429 ? 429 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : "Interner Verarbeitungsfehler"
    });
  }
});
aiRouter.post(["/script", "/generate-script"], requireAuth, requireActiveSubscription, async (req, res) => {
  try {
    const script = await generateViralClipScript(req.body);
    res.status(200).json({ success: true, script, generatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Fehler bei der Skript-Generierung" });
  }
});
aiRouter.post(["/pitch", "/generate-pitch"], requireAuth, requireActiveSubscription, async (req, res) => {
  try {
    const pitch = await generateSponsorPitch(req.body);
    res.status(200).json({ success: true, pitch, generatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Fehler beim Sponsoren-Pitch" });
  }
});
aiRouter.post(["/analyze", "/analyze-clip"], requireAuth, requireActiveSubscription, async (req, res) => {
  try {
    const { title, gameName } = req.body;
    const analysis = await analyzeClipVirality(title || "Top Clip", gameName);
    res.status(200).json({ success: true, ...analysis, analyzedAt: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Fehler bei der Clip-Analyse" });
  }
});
aiRouter.post(["/advisor", "/prompt"], requireAuth, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: "Kein Prompt \xFCbergeben." });
      return;
    }
    const reply = await generateArchitectureAdvice(prompt);
    res.status(200).json({ text: reply, reply });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Fehler bei der Architekturberatung" });
  }
});
aiRouter.post(["/quickclick-engine", "/clip-intelligence", "/analyze-quickclick"], requireAuth, requireActiveSubscription, async (req, res) => {
  try {
    const { clipTitle, streamerName, game, durationSec, transcript, videoUrl, videoInlineData } = req.body;
    const result = await analyzeClipWithQuickClickEngine({
      clipTitle: clipTitle || "Insane 1v4 Final Ring Clutch! \u{1F525}",
      streamerName,
      game,
      durationSec: durationSec ? Number(durationSec) : 30,
      transcript,
      videoUrl,
      videoInlineData
    });
    res.status(200).json({ success: true, ...result, analyzedAt: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Fehler bei der QuickClick Multimodal Inferenz" });
  }
});
aiRouter.get(["/quickclick-config", "/engine-config"], (_req, res) => {
  res.status(200).json({
    systemInstruction: QUICKCLICK_ENGINE_SYSTEM_INSTRUCTION,
    recommendedSettings: {
      model: "models/gemini-flash-latest",
      temperature: 0.5,
      topP: 0.9,
      responseMimeType: "application/json"
    },
    schema: quickClickEngineSchema
  });
});
export {
  aiRouter
};
