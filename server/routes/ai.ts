import { Router, Request, Response } from 'express';
import {
  generateSocialMetadata,
  generateViralClipScript,
  generateSponsorPitch,
  analyzeClipVirality,
  generateArchitectureAdvice,
  analyzeClipWithQuickClickEngine,
  QUICKCLICK_ENGINE_SYSTEM_INSTRUCTION,
  quickClickEngineSchema,
  ClipMetadataInput,
} from '../services/gemini.js';
import { requireAuth, requireActiveSubscription } from '../middleware/authMiddleware.js';

export const aiRouter = Router();

// POST /api/ai/metadata (Canonical) & /api/ai/generate-clip-metadata (Alias)
// Gesichert via RBAC & Subscription Gate (HTTP 403 Forbidden ohne aktives Abo)
aiRouter.post(['/metadata', '/generate-metadata', '/generate-clip-metadata'], requireAuth, requireActiveSubscription, async (req: Request, res: Response): Promise<void> => {
  const { streamer, game, clipTitle, transcriptSnippet } = req.body as Partial<ClipMetadataInput>;
  if (!streamer || !clipTitle) {
    res.status(400).json({
      error: 'Fehlende Pflichtfelder: "streamer" und "clipTitle" werden zwingend benötigt.',
    });
    return;
  }

  try {
    const metadata = await generateSocialMetadata({
      streamer: String(streamer).trim(),
      game: game ? String(game).trim() : undefined,
      clipTitle: String(clipTitle).trim(),
      transcriptSnippet: transcriptSnippet ? String(transcriptSnippet).trim() : undefined,
    });
    res.status(200).json({ success: true, data: metadata });
  } catch (error: any) {
    res.status(error?.status === 429 ? 429 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Interner Verarbeitungsfehler',
    });
  }
});

// POST /api/ai/script (Canonical) & /api/ai/generate-script (Alias)
aiRouter.post(['/script', '/generate-script'], requireAuth, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const script = await generateViralClipScript(req.body);
    res.status(200).json({ success: true, script, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Fehler bei der Skript-Generierung' });
  }
});

// POST /api/ai/pitch (Canonical) & /api/ai/generate-pitch (Alias)
aiRouter.post(['/pitch', '/generate-pitch'], requireAuth, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const pitch = await generateSponsorPitch(req.body);
    res.status(200).json({ success: true, pitch, generatedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Fehler beim Sponsoren-Pitch' });
  }
});

// POST /api/ai/analyze (Canonical) & /api/ai/analyze-clip (Alias)
aiRouter.post(['/analyze', '/analyze-clip'], requireAuth, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const { title, gameName } = req.body;
    const analysis = await analyzeClipVirality(title || 'Top Clip', gameName);
    res.status(200).json({ success: true, ...analysis, analyzedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Fehler bei der Clip-Analyse' });
  }
});

// POST /api/ai/advisor (Architekturberatung - erfordert Authentifizierung)
aiRouter.post(['/advisor', '/prompt'], requireAuth, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Kein Prompt übergeben.' });
      return;
    }
    const reply = await generateArchitectureAdvice(prompt);
    res.status(200).json({ text: reply, reply });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Fehler bei der Architekturberatung' });
  }
});

// POST /api/ai/quickclick-engine (Canonical QuickClick Multimodal Video Intelligence)
aiRouter.post(['/quickclick-engine', '/clip-intelligence', '/analyze-quickclick'], requireAuth, requireActiveSubscription, async (req: Request, res: Response) => {
  try {
    const { clipTitle, streamerName, game, durationSec, transcript, videoUrl, videoInlineData } = req.body;
    const result = await analyzeClipWithQuickClickEngine({
      clipTitle: clipTitle || 'Insane 1v4 Final Ring Clutch! 🔥',
      streamerName,
      game,
      durationSec: durationSec ? Number(durationSec) : 30,
      transcript,
      videoUrl,
      videoInlineData,
    });
    res.status(200).json({ success: true, ...result, analyzedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Fehler bei der QuickClick Multimodal Inferenz' });
  }
});

// GET /api/ai/quickclick-config
aiRouter.get(['/quickclick-config', '/engine-config'], (_req: Request, res: Response) => {
  res.status(200).json({
    systemInstruction: QUICKCLICK_ENGINE_SYSTEM_INSTRUCTION,
    recommendedSettings: {
      model: 'models/gemini-flash-latest',
      temperature: 0.5,
      topP: 0.9,
      responseMimeType: 'application/json',
    },
    schema: quickClickEngineSchema,
  });
});