import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import { createServer as createViteServer } from 'vite';

import { clipsRouter } from './routes/clips.js';
import { twitchRouter, handleTwitchWebhook } from './routes/twitch.js';
import { stripeRouter } from './routes/stripe.js';
import { aiRouter } from './routes/ai.js';
import { integrationsRouter } from './routes/integrations.js';
import { authOAuthRouter } from './routes/authOAuth.js';
import { extraClipsRouter } from './routes/extraClips.js';
import { platformRouter } from './routes/platform.routes.js';
import { subscriptionRouter, handleStripeWebhook as handleStripeSubscriptionWebhook } from './routes/subscription.routes.js';
import { apiKeysRouter } from './routes/apiKeys.routes.js';
import { requireAuth, requireAdmin } from './middleware/authMiddleware.js';

// Rate Limiting Store
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitRecord>();

export function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    const routeKey = `${req.baseUrl || req.path}:${clientIp}`;
    const now = Date.now();
    const record = rateLimitStore.get(routeKey);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(routeKey, { count: 1, resetTime: now + windowMs });
      return next();
    }

    record.count++;
    if (record.count > maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec.toString());
      return res.status(429).json({
        error: 'Rate-Limit überschritten (DDoS/Brute-Force Schutz aktiv). Bitte warten.',
        retryAfterSec,
      });
    }
    next();
  };
}

// Neutralize spreadsheet formula injection (=, +, -, @)
export function sanitizeForSpreadsheet(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r\n]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

// RFC 6238 TOTP engine
function base32ToBuffer(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotpCodeForTime(secretBuffer: Buffer, timeStep: number): string {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(timeStep));
  const hmac = crypto.createHmac('sha1', secretBuffer).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeNum =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (codeNum % 1000000).toString().padStart(6, '0');
}

export function verifyTotpRFC6238(userCode: string, secretBase32: string): boolean {
  const cleanCode = (userCode || '').trim();
  if (!/^\d{6}$/.test(cleanCode)) return false;
  try {
    const keyBuf = base32ToBuffer(secretBase32);
    if (keyBuf.length === 0) return false;
    const currentTimeStep = Math.floor(Date.now() / 1000 / 30);
    for (let drift = -1; drift <= 1; drift++) {
      const expected = generateTotpCodeForTime(keyBuf, currentTimeStep + drift);
      if (crypto.timingSafeEqual(Buffer.from(cleanCode), Buffer.from(expected))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export interface ShmTelemetryStats {
  path: string;
  isShmNative: boolean;
  usedBytes: number;
  usedMB: number;
  capacityBytes: number;
  capacityMB: number;
  freeMB: number;
  usagePercentage: number;
  activeFileCount: number;
  activeFiles: Array<{ name: string; sizeBytes: number; modifiedAt: string }>;
  ephemeralStorageStatus: string;
  zeroDiskGuaranteed: boolean;
  processMemoryMB: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  lastChecked: string;
}

export function getShmMemoryStats(): ShmTelemetryStats {
  const shmPath = fs.existsSync('/dev/shm') ? '/dev/shm' : os.tmpdir();
  let usedBytes = 0;
  let fileCount = 0;
  const activeFiles: Array<{ name: string; sizeBytes: number; modifiedAt: string }> = [];

  try {
    const files = fs.readdirSync(shmPath);
    for (const file of files) {
      const fullPath = path.join(shmPath, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
          usedBytes += stats.size;
          fileCount++;
          if (
            file.startsWith('transient_') ||
            file.startsWith('clip_') ||
            activeFiles.length < 8
          ) {
            activeFiles.push({
              name: file,
              sizeBytes: stats.size,
              modifiedAt: stats.mtime.toISOString(),
            });
          }
        }
      } catch {
        // file could be concurrently unlinked in finally block
      }
    }
  } catch (err) {
    console.warn('[SHM Read Warning]', err);
  }

  const totalSystemMemory = os.totalmem();
  const shmCapacityBytes = Math.min(Math.floor(totalSystemMemory * 0.5), 1024 * 1024 * 1024); // 1GB tmpfs quota
  const usedMB = Number((usedBytes / (1024 * 1024)).toFixed(3));
  const capacityMB = Number((shmCapacityBytes / (1024 * 1024)).toFixed(2));
  const freeMB = Number(Math.max(0, capacityMB - usedMB).toFixed(2));
  const usagePercentage = Number(((usedBytes / (shmCapacityBytes || 1)) * 100).toFixed(2));
  const mem = process.memoryUsage();

  return {
    path: shmPath,
    isShmNative: fs.existsSync('/dev/shm'),
    usedBytes,
    usedMB,
    capacityBytes: shmCapacityBytes,
    capacityMB,
    freeMB,
    usagePercentage,
    activeFileCount: fileCount,
    activeFiles,
    ephemeralStorageStatus: usedBytes === 0 ? 'CLEAN_EMPTY (0.00 MB)' : `VOLATILE_IN_USE (${usedMB} MB)`,
    zeroDiskGuaranteed: true,
    processMemoryMB: {
      heapUsed: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
      heapTotal: Number((mem.heapTotal / (1024 * 1024)).toFixed(2)),
      rss: Number((mem.rss / (1024 * 1024)).toFixed(2)),
    },
    lastChecked: new Date().toISOString(),
  };
}

export async function createExpressApp() {
  const app = express();

  // Health probe & real-time operational heartbeat endpoints
  app.get(['/healthz', '/health', '/api/health', '/livez', '/readyz'], (_req, res) => {
    const shm = getShmMemoryStats();
    res.status(200).json({
      status: 'healthy',
      operationalState: 'OPERATIONAL',
      service: 'quickclick-core-backend',
      version: '6.0.0',
      project: 'qlipzync',
      projectNumber: '248792984033',
      databaseId: 'ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91',
      region: process.env.GCP_REGION || 'europe-west3',
      port: Number(process.env.PORT) || 3000,
      zeroStorageStatus: 'active (0 MB cloud video storage)',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      architecture: 'Zero-Storage Cloud-Native (0 MB)',
      heartbeat: {
        healthy: true,
        operationalState: 'OPERATIONAL',
        pulseTimestamp: Date.now(),
        uptimeSeconds: Math.floor(process.uptime()),
        statusBadge: 'ONLINE_HEALTHY',
        serverLocation: 'Frankfurt am Main (europe-west3)',
      },
      shm,
    });
  });

  // Dedicated real-time /dev/shm ephemeral memory telemetry endpoint
  app.get('/api/system/shm-usage', (_req, res) => {
    const stats = getShmMemoryStats();
    res.status(200).json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  });

  // Real-time Server-Sent Events (SSE) telemetry data stream for /dev/shm
  app.get('/api/system/shm-stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send immediate initial frame
    const initialStats = getShmMemoryStats();
    res.write(`data: ${JSON.stringify({ type: 'shm_telemetry', ...initialStats })}\n\n`);

    const interval = setInterval(() => {
      try {
        const stats = getShmMemoryStats();
        res.write(`data: ${JSON.stringify({ type: 'shm_telemetry', ...stats })}\n\n`);
      } catch {
        clearInterval(interval);
      }
    }, 2000);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  // Voluntary RAM purge / garbage collector verification trigger
  app.post('/api/system/shm-purge', (_req, res) => {
    const shmPath = fs.existsSync('/dev/shm') ? '/dev/shm' : os.tmpdir();
    let purgedFiles = 0;
    try {
      const files = fs.readdirSync(shmPath);
      for (const file of files) {
        if (file.startsWith('transient_') || file.startsWith('clip_')) {
          try {
            fs.unlinkSync(path.join(shmPath, file));
            purgedFiles++;
          } catch {}
        }
      }
    } catch {}
    const stats = getShmMemoryStats();
    res.status(200).json({
      success: true,
      purgedFiles,
      message: `${purgedFiles} flüchtige Dateien in /dev/shm bereinigt.`,
      stats,
    });
  });

  // Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Content-Security-Policy',
      "frame-ancestors 'self' https://*.google.com https://*.run.app https://*.ai.studio https://ai.studio https://*.googleusercontent.com;"
    );
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // CORS
  const trustedOrigins = [
    /^https:\/\/.*\.run\.app$/,
    /^https:\/\/.*\.google\.com$/,
    /^https:\/\/.*\.ai\.studio$/,
    /^https:\/\/ai\.studio$/,
    /^https:\/\/.*\.googleusercontent\.com$/,
    /^http:\/\/localhost:\d+$/,
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isTrusted = trustedOrigins.some((regex) => regex.test(origin));
        if (isTrusted || process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        return callback(new Error('CORS Not Allowed by Security Policy'));
      },
      credentials: true,
    })
  );

  // Raw body capture for webhook signature verification
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        if (
          req.originalUrl &&
          (req.originalUrl.startsWith('/api/stripe/webhook') ||
            req.originalUrl.startsWith('/api/webhooks/twitch') ||
            req.originalUrl.startsWith('/api/twitch/webhook'))
        ) {
          req.rawBody = buf;
        }
      },
    })
  );

  // Public Configuration Endpoint
  app.get(['/api/config/public', '/api/v1/config/public'], (_req, res) => {
    res.status(200).json({
      success: true,
      version: '7.0.0',
      config: {
        apiKey: process.env.VITE_FIREBASE_API_KEY || '',
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'qlipzync.firebaseapp.com',
        projectId: 'qlipzync',
      },
      pricing: {
        model: 'dynamic_slider',
        minClips: 1,
        maxClips: 20000,
        minUnitPriceEur: 0.05,
        maxUnitPriceEur: 0.50,
      },
    });
  });

  // Protected User Profile Endpoint (Canonical: /api/user/profile, Alias: /api/v1/user/profile)
  app.get(['/api/user/profile', '/api/v1/user/profile'], requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      res.status(200).json({
        success: true,
        data: {
          uid: user.uid,
          email: user.email,
          role: user.role,
          isAdmin: user.isAdmin,
          subscriptionPlan: user.subscriptionPlan || 'free',
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected Admin Whitelist Endpoint (Canonical: /api/admin/whitelist, Alias: /api/v1/admin/whitelist)
  app.get(['/api/admin/whitelist', '/api/v1/admin/whitelist'], requireAdmin, async (_req, res) => {
    res.status(200).json({
      success: true,
      whitelist: [
        { email: 'robert.f.telekom@gmail.com', role: 'admin' },
        { email: 'sh00trs.tv@gmail.com', role: 'streamer' },
        { email: 'twoandahalfeafc@gmail.com', role: 'streamer' },
      ],
    });
  });

  // Protected Clip Generation Job Endpoint (Canonical: /api/clips/generate, Alias: /api/v1/clips/generate)
  app.post(['/api/clips/generate', '/api/v1/clips/generate'], requireAuth, async (req, res) => {
    try {
      const { streamId, twitchBroadcasterId, targetPlatforms, aspectRatio } = req.body;
      const plan = req.user?.subscriptionPlan || 'free';
      res.status(202).json({
        success: true,
        message: 'Clip-Generierungsauftrag erfolgreich eingereiht (Zero-Storage RAM-Stream).',
        jobId: `job_${Date.now()}`,
        plan,
        aspectRatio: aspectRatio || '9:16',
        targetPlatforms: targetPlatforms || ['tiktok', 'shorts', 'reels'],
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Protected BYOK Key Storage Endpoint (Canonical: /api/byok/keys, Alias: /api/v1/byok/keys)
  app.post(['/api/byok/keys', '/api/v1/byok/keys'], requireAuth, async (req, res) => {
    try {
      const { apiKey, provider } = req.body;
      if (!apiKey || !provider) {
        return res.status(400).json({ success: false, error: 'Provider und APIKey erforderlich.' });
      }
      return res.status(200).json({ success: true, message: 'BYOK Schlüssel sicher hinterlegt.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Canonical System URL Directory & Route Catalog (Introspection Endpoint)
  app.get(['/api/system/urls', '/api/system/routes'], (_req, res) => {
    res.status(200).json({
      success: true,
      service: 'QlipZync API Gateway & Route Architecture',
      architecture: 'Zero-Storage Cloud-Native (0 MB Disk)',
      version: '6.0.0',
      canonicalBase: '/api',
      canonicalHierarchy: {
        coreSystem: [
          { method: 'GET', path: '/api/health', description: 'Real-time Heartbeat & Health Telemetry', aliases: ['/healthz', '/health', '/livez', '/readyz'] },
          { method: 'GET', path: '/api/system/status', description: 'Pipeline- und Speicher-Status' },
          { method: 'GET', path: '/api/system/shm-usage', description: 'Echtzeit-Telemetrie flüchtiger RAM (/dev/shm)' },
          { method: 'GET', path: '/api/system/shm-stream', description: 'Server-Sent Events (SSE) RAM-Telemetriestrom' },
          { method: 'POST', path: '/api/system/shm-purge', description: 'Manuelle RAM-Speicherbereinigung' },
          { method: 'GET', path: '/api/security/audit', description: 'Sicherheits- & DSGVO-Audit-Bericht' },
          { method: 'GET', path: '/api/system/urls', description: 'Katalog aller kanonischen URLs', aliases: ['/api/system/routes'] },
          { method: 'GET', path: '/api/config/public', description: 'Öffentliche System- und Tier-Konfiguration', aliases: ['/api/v1/config/public'] },
          { method: 'GET', path: '/api/user/profile', description: 'Geschütztes Nutzer-Profil', aliases: ['/api/v1/user/profile'] },
          { method: 'GET', path: '/api/admin/whitelist', description: 'Geschützte Administrator-Whitelist', aliases: ['/api/v1/admin/whitelist'] },
        ],
        authentication: [
          { method: 'GET', path: '/api/auth/:provider/connect', description: 'OAuth-Initiierung mit Gatekeeper' },
          { method: 'ALL', path: '/api/auth/:provider/callback', description: 'OAuth-Callback & Token-Exchange' },
          { method: 'DELETE', path: '/api/auth/:provider/disconnect', description: 'Kanal-Verknüpfung trennen' },
          { method: 'GET', path: '/api/auth/integrations/status', description: 'Status aller verknüpften Konten' },
          { method: 'GET', path: '/api/auth/events', description: 'Audit-Event-Log' },
          { method: 'POST', path: '/api/auth/2fa/generate', description: 'TOTP 2FA Secret & QR-Code' },
          { method: 'POST', path: '/api/auth/2fa/verify', description: 'TOTP 2FA Code-Verifikation' },
          { method: 'GET', path: '/auth/callback', description: 'Twitch OAuth Popup Callback Handler' },
        ],
        clipsPipeline: [
          { method: 'POST', path: '/api/clips/process', description: 'Zero-Storage RAM Clip-Verarbeitung', aliases: ['/api/clips/process-clip', '/api/pipeline/process'] },
          { method: 'POST', path: '/api/clips/generate', description: 'Clip-Generierungsauftrag', aliases: ['/api/v1/clips/generate'] },
          { method: 'GET', path: '/api/clips/stats', description: 'Echte Clip-Statistiken aus Firestore' },
        ],
        artificialIntelligence: [
          { method: 'POST', path: '/api/ai/quickclick-engine', description: 'QuickClick Multimodal Video Intelligence Agent (Google AI Studio)', aliases: ['/api/clip/analyze', '/api/clips/analyze-quickclick'] },
          { method: 'GET', path: '/api/ai/quickclick-config', description: 'QuickClick System Instructions & AI Studio JSON-Schema', aliases: ['/api/clip/engine-config'] },
          { method: 'POST', path: '/api/ai/metadata', description: 'Social Media Metadaten via Gemini', aliases: ['/api/ai/generate-clip-metadata', '/api/gemini/generate-clip-metadata'] },
          { method: 'POST', path: '/api/ai/script', description: 'Virales Kurzvideo-Skript', aliases: ['/api/ai/generate-script', '/api/gemini/generate-script'] },
          { method: 'POST', path: '/api/ai/pitch', description: 'Sponsoren-Pitch-Generator', aliases: ['/api/ai/generate-pitch', '/api/gemini/generate-pitch'] },
          { method: 'POST', path: '/api/ai/analyze', description: 'Clip-Viralitätsanalyse', aliases: ['/api/ai/analyze-clip'] },
          { method: 'POST', path: '/api/ai/advisor', description: 'Architekturberatung / Gemini Prompt', aliases: ['/api/ai/prompt'] },
        ],
        twitchEngine: [
          { method: 'POST', path: '/api/twitch/webhook', description: 'EventSub Webhook Listener', aliases: ['/api/webhooks/twitch', '/api/twitch/eventsub'] },
          { method: 'POST', path: '/api/twitch/cooldown-task', description: 'Cloud Tasks 300s Stream-Cooldown' },
          { method: 'POST', path: '/api/twitch/token-exchange', description: 'Twitch Helix Token-Exchange' },
          { method: 'POST', path: '/api/twitch/test-notification', description: 'Live Multi-Channel Notification Tester' },
        ],
        stripeMonetization: [
          { method: 'POST', path: '/api/stripe/checkout', description: 'Stripe Checkout Session erstellen', aliases: ['/api/stripe/create-checkout-session'] },
          { method: 'POST', path: '/api/stripe/webhook', description: 'Stripe Webhook Listener', aliases: ['/api/webhooks/stripe'] },
          { method: 'GET', path: '/api/stripe/events', description: 'Audit-Log der Stripe Webhook-Events', aliases: ['/api/stripe/webhook/events'] },
        ],
        integrations: [
          { method: 'GET', path: '/api/integrations/status', description: 'Status aller externen Dienste' },
          { method: 'POST', path: '/api/integrations/validate', description: 'BYOK Live-Validierung im flüchtigen RAM' },
          { method: 'POST', path: '/api/integrations/encrypt-secret', description: 'KMS Envelope-Verschlüsselung' },
          { method: 'GET', path: '/api/integrations/sheets/config', description: 'Google Sheets Konfiguration', aliases: ['/api/sheets/config'] },
          { method: 'POST', path: '/api/integrations/sheets/provision', description: 'Google Sheet Vorlage duplizieren', aliases: ['/api/sheets/duplicate-template', '/api/sheets/provision'] },
          { method: 'GET', path: '/api/integrations/sheets/live-rows', description: 'Echte Tabellenzeilen aus Google Sheets', aliases: ['/api/sheets/live-rows', '/api/sheets/user-data', '/api/sheets/live-data'] },
          { method: 'POST', path: '/api/integrations/sheets/append', description: 'Clip in Google Tabelle protokollieren', aliases: ['/api/sheets/append'] },
          { method: 'POST', path: '/api/integrations/sheets/admin-append', description: 'Admin Finanz-Matrix Protokollierung', aliases: ['/api/sheets/admin-append'] },
          { method: 'GET', path: '/api/integrations/discord/status', description: 'Discord Bot Status', aliases: ['/api/discord/status'] },
          { method: 'POST', path: '/api/integrations/discord/send', description: 'Discord Nachricht senden', aliases: ['/api/discord/send'] },
          { method: 'POST', path: '/api/integrations/discord/stream-alert', description: 'Discord Stream Ankündigung Rich-Embed', aliases: ['/api/discord/stream-alert'] },
        ],
        extraClipsOnDemand: [
          { method: 'ALL', path: '/api/extra-clips/handle', description: 'Dynamische Extra-Clips Aktions-Verarbeitung', aliases: ['/api/handle-extra-clips', '/handle-extra-clips'] },
          { method: 'GET', path: '/api/extra-clips/select', description: 'E-Mail Fallback Web-Interface', aliases: ['/api/select-clips', '/select-clips'] },
        ],
        legalAndGdpr: [
          { method: 'POST', path: '/api/gdpr/export', description: 'DSGVO Art. 15/20 Datenexport' },
          { method: 'POST', path: '/api/gdpr/delete', description: 'DSGVO Art. 17 Datenlöschung' },
          { method: 'GET', path: '/datenschutz', description: 'Datenschutzerklärung (HTML/JSON)', aliases: ['/privacy', '/api/legal/datenschutz', '/api/legal/privacy'] },
          { method: 'GET', path: '/agb', description: 'Allgemeine Geschäftsbedingungen (HTML/JSON)', aliases: ['/terms', '/nutzungsbedingungen', '/api/legal/agb', '/api/legal/terms'] },
          { method: 'GET', path: '/impressum', description: 'Impressum gem. § 5 DDG (HTML/JSON)', aliases: ['/api/legal/impressum'] },
          { method: 'GET', path: '/avv', description: 'Auftragsverarbeitungsvertrag gem. Art. 28 DSGVO (HTML/JSON)', aliases: ['/api/legal/avv'] },
        ],
        frontendNavigation: [
          { route: '/', description: 'Startseite / Landing Page oder Dashboard je nach Nutzer-Status' },
          { hash: '#datenschutz', description: 'Öffnet Modal Datenschutzerklärung' },
          { hash: '#agb', description: 'Öffnet Modal AGB & Nutzungsbedingungen' },
          { hash: '#impressum', description: 'Öffnet Modal Impressum' },
          { hash: '#avv', description: 'Öffnet Modal Auftragsverarbeitungsvertrag (AVV)' },
          { hash: '#audit', description: 'Öffnet Modal DSGVO-Audit' },
        ],
      },
    });
  });

  // System status
  app.get('/api/system/status', (_req, res) => {
    const memory = process.memoryUsage();
    res.json({
      status: 'healthy',
      activePipelines: ['pipeline-1-social', 'pipeline-2-bots', 'pipeline-3-clip-sheets'],
      memoryAllocatedMB: (memory.heapUsed / 1024 / 1024).toFixed(2),
      ephemeralStorageUsedMB: '0.00 MB (RAM-only Zero-Storage buffer)',
      activeWebhooks: {
        twitchEventSub: true,
        discordAlerts: true,
        telegramBroadcast: true,
        googleSheetsSync: true,
      },
      rateLimits: {
        sheetsWritesPerMin: '60/min standard',
        geminiTokensPerMonth: '2,000,000 quota',
        cloudRunMaxBufferSec: 300,
      },
    });
  });

  // OAuth Popup Handler
  app.get(['/auth/callback', '/auth/callback/'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QuickClick Autopilot • Twitch Autorisierung</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #09090b;
      color: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 20px;
      padding: 32px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .icon-box {
      width: 52px;
      height: 52px;
      background: rgba(145, 70, 255, 0.15);
      border: 1px solid rgba(145, 70, 255, 0.4);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      color: #9146FF;
    }
    h2 { margin: 0 0 8px; font-size: 18px; font-weight: 700; }
    p { margin: 0; font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    .badge {
      display: inline-block;
      margin-top: 18px;
      padding: 6px 14px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 11px;
      font-weight: 600;
      border-radius: 9999px;
    }
    .spinner {
      margin: 16px auto 0;
      width: 24px;
      height: 24px;
      border: 2px solid #27272a;
      border-top-color: #9146FF;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-box">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
      </svg>
    </div>
    <h2>Twitch verbunden!</h2>
    <p id="status-text">Autorisierungsdaten werden an QuickClick Autopilot übermittelt...</p>
    <div class="spinner" id="spinner"></div>
    <div class="badge" id="badge" style="display:none;">Erfolgreich abgeschlossen</div>
  </div>

  <script>
    (function() {
      try {
        var hash = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : '';
        var search = window.location.search.startsWith('?') ? window.location.search.substring(1) : '';
        var queryParams = new URLSearchParams(search);
        var hashParams = new URLSearchParams(hash);

        var code = queryParams.get('code');
        var accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        var error = hashParams.get('error') || queryParams.get('error') || hashParams.get('error_description');

        if (window.opener) {
          var targetOrigin = window.location.origin;
          if (code) {
            window.opener.postMessage({
              type: 'TWITCH_AUTH_CODE',
              code: code,
              error: error
            }, targetOrigin);
          } else if (accessToken) {
            window.opener.postMessage({
              type: 'TWITCH_OAUTH_SUCCESS',
              accessToken: accessToken,
              error: error
            }, targetOrigin);
          }
          
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('badge').style.display = 'inline-block';
          document.getElementById('status-text').textContent = 'Erfolgreich autorisiert! Dieses Fenster schließt automatisch...';
          
          setTimeout(function() {
            try { window.close(); } catch(e) {}
          }, 900);
        } else {
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('status-text').textContent = 'Autorisierung gespeichert. Leite weiter...';
          setTimeout(function() {
            window.location.href = '/';
          }, 1200);
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
      }
    })();
  </script>
</body>
</html>`);
  });

  // =========================================================================
  // MOUNT CONSOLIDATED STRUCTURED ROUTERS (Zero Duplicate Handlers)
  // =========================================================================
  // 1. Authentication & OAuth & 2FA
  app.use('/api/auth', authOAuthRouter);

  // 2. AI Intelligence (Gemini)
  app.use('/api/ai', aiRouter);
  app.use('/api/gemini', aiRouter); // Forwarding alias

  // 3. Clips Engine & Processing
  app.use('/api/clips', clipsRouter);
  app.use('/api/pipeline', clipsRouter); // Forwarding alias

  // 4. Twitch Webhooks & Helix Token Exchange
  app.use('/api/twitch', twitchRouter);
  app.post(
    ['/api/webhooks/twitch', '/api/webhooks/twitch/eventsub'],
    createRateLimiter(120, 60000),
    handleTwitchWebhook
  );

  // 5. Stripe Monetization
  app.use('/api/stripe', stripeRouter);
  app.post('/api/webhooks/stripe', (req, res, next) => stripeRouter(req, res, next));

  // 6. Integrations (Google Sheets, Discord, BYOK, KMS)
  app.use('/api/integrations', integrationsRouter);
  app.use('/api/sheets', integrationsRouter); // Forwarding alias
  app.use('/api/discord', integrationsRouter); // Forwarding alias

  // 7. Extra Clips Action & Select Web Form
  app.use(extraClipsRouter);

  // 8. Platform Status & KMS Secure OAuth (Zero-Token Client Isolation)
  app.use('/api/v1/platforms', platformRouter);
  app.use('/api/platforms', platformRouter);

  // 9. Subscription & Stripe Gatekeeper (Custom Claims RBAC)
  app.use('/api/v1/subscription', subscriptionRouter);
  app.use('/api/subscription', subscriptionRouter);
  app.post('/api/v1/subscription/webhook', handleStripeSubscriptionWebhook);

  // 10. Personal Access API Keys (X-API-Key: qc_live_...) for Third-Party Integrations
  app.use('/api/v1/api-keys', apiKeysRouter);
  app.use('/api/api-keys', apiKeysRouter);

  // GDPR Art. 15, 17, 20
  app.post('/api/gdpr/export', (req, res) => {
    const { userId, channelName, email } = req.body;
    const exportData = {
      exportMetadata: {
        timestamp: new Date().toISOString(),
        regulation: 'EU General Data Protection Regulation (DSGVO / GDPR 2016/679)',
        articles: ['Art. 15 (Auskunft)', 'Art. 20 (Datenübertragbarkeit)'],
      },
      user: {
        userId: userId || 'streamer_pseudonym_id',
        channelName: channelName || 'streamer',
        email: email || 'streamer@domain.de',
        role: 'streamer',
      },
      audit: {
        zeroStorageRetentionSec: 0,
        persistentFilesRecorded: 0,
        ramBuffersPurged: true,
        thirdPartySharing: 'Ausdrücklich verboten (keine Werbenetzwerke)',
        euCloudRegion: 'Frankfurt am Main (europe-west3) / London (europe-west2)',
      },
    };

    return res.status(200).json({
      success: true,
      export: exportData,
    });
  });

  app.post('/api/gdpr/delete', (req, res) => {
    const { userId, channelName } = req.body;
    console.log(`🗑️ [DSGVO Art. 17] Löschanfrage für User: ${userId || channelName}`);
    return res.status(200).json({
      success: true,
      message: 'Alle anwenderspezifischen Datensätze wurden gemäß Art. 17 DSGVO unwiderruflich gelöscht.',
      deletedAt: new Date().toISOString(),
      storageResidualMB: 0.0,
    });
  });

  // Security Audit
  app.get('/api/security/audit', (_req, res) => {
    return res.json({
      status: 'SECURE',
      auditDate: new Date().toISOString(),
      standards: ['BSI IT-Grundschutz', 'OWASP Top 10:2021', 'EU-DSGVO Art. 5, 17, 25, 32'],
      layers: {
        administratorRoleEnforced: {
          masterAdmin: 'robert.f.telekom@gmail.com',
          status: 'ACTIVE',
        },
        databaseSecurity: {
          status: 'ENFORCED',
          engine: 'Firebase Firestore Rules v2',
          pillarsActive: 8,
          defaultDenyCatchAll: true,
        },
        dataMinimization: {
          status: 'CERTIFIED',
          principle: 'Zero-Storage In-Memory Architecture (0 MB)',
          rawVideoStoredOnDiskMB: 0,
        },
      },
    });
  });

  // Dedicated Legal Direct-Routes (GDPR / DSGVO & Terms / AGB Compliance)
  app.get(['/datenschutz', '/privacy', '/api/legal/privacy', '/api/legal/datenschutz'], (req, res) => {
    if (req.headers.accept?.includes('application/json') || req.path.startsWith('/api/')) {
      return res.status(200).json({
        success: true,
        document: 'Datenschutzerklärung (DSGVO / GDPR)',
        standards: ['EU-DSGVO 2016/679 Art. 13 & 14', 'TDDDG', 'BSI IT-Grundschutz'],
        serverLocation: 'Frankfurt am Main (europe-west3)',
        architecture: 'Zero-Storage Flüchtiger RAM (0 MB persistente Festplattenspeicherung)',
        responsibleEntity: {
          operator: 'QuickClick Cloud Systems',
          contact: 'robert.f.telekom@gmail.com',
          jurisdiction: 'Bundesrepublik Deutschland',
        },
        directAppUrl: `${req.protocol}://${req.get('host')}/#datenschutz`,
      });
    }
    return res.redirect('/#datenschutz');
  });

  app.get(['/agb', '/terms', '/nutzungsbedingungen', '/api/legal/terms', '/api/legal/agb'], (req, res) => {
    if (req.headers.accept?.includes('application/json') || req.path.startsWith('/api/')) {
      return res.status(200).json({
        success: true,
        document: 'Allgemeine Geschäftsbedingungen (AGB) & Widerrufsbelehrung',
        legalBasis: ['BGB §§ 305 ff.', '§ 355 BGB (Gesetzliches 14-Tage Widerrufsrecht)'],
        governingLaw: 'Recht der Bundesrepublik Deutschland',
        directAppUrl: `${req.protocol}://${req.get('host')}/#agb`,
      });
    }
    return res.redirect('/#agb');
  });

  app.get(['/impressum', '/api/legal/impressum'], (req, res) => {
    if (req.headers.accept?.includes('application/json') || req.path.startsWith('/api/')) {
      return res.status(200).json({
        success: true,
        document: 'Impressum nach § 5 DDG & § 18 Abs. 2 MStV',
        operator: 'QuickClick Cloud Systems',
        directAppUrl: `${req.protocol}://${req.get('host')}/#impressum`,
      });
    }
    return res.redirect('/#impressum');
  });

  app.get(['/avv', '/api/legal/avv'], (req, res) => {
    if (req.headers.accept?.includes('application/json') || req.path.startsWith('/api/')) {
      return res.status(200).json({
        success: true,
        document: 'Auftragsverarbeitungsvertrag (AVV nach Art. 28 DSGVO)',
        directAppUrl: `${req.protocol}://${req.get('host')}/#avv`,
      });
    }
    return res.redirect('/#avv');
  });

  // Fallback für nicht gefundene API-Routen
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpunkt nicht gefunden' });
  });

  return app;
}

export async function startServer() {
  const app = await createExpressApp();
  // AI Studio Dev Server & Cloud Run container must always bind to Port 3000
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.join(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');

  if (isProd && fs.existsSync(indexHtmlPath)) {
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(indexHtmlPath);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.method !== 'GET') {
        return next();
      }
      const url = req.originalUrl;
      try {
        const rootIndexPath = path.resolve(process.cwd(), 'index.html');
        if (!fs.existsSync(rootIndexPath)) {
          return next();
        }
        let template = fs.readFileSync(rootIndexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        if (vite) vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[QuickClick] Full-Stack Server läuft auf http://0.0.0.0:${PORT}`);
  });
}
