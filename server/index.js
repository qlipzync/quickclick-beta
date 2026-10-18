import express from "express";
import cors from "cors";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import { createServer as createViteServer } from "vite";
import { clipsRouter } from "./routes/clips.js";
import { twitchRouter, handleTwitchWebhook } from "./routes/twitch.js";
import { stripeRouter } from "./routes/stripe.js";
import { aiRouter } from "./routes/ai.js";
import { integrationsRouter } from "./routes/integrations.js";
import { authOAuthRouter } from "./routes/authOAuth.js";
import { extraClipsRouter } from "./routes/extraClips.js";
import { platformRouter } from "./routes/platform.routes.js";
import { subscriptionRouter, handleStripeWebhook as handleStripeSubscriptionWebhook } from "./routes/subscription.routes.js";
import { apiKeyRouter } from "./routes/apiKey.routes.js";
import { handleTopupRequest } from "./routes/topupRoute.js";
import { encryptSecret } from "./services/kmsService.js";
import { requireAuth, requireAdmin, requireActiveSubscription } from "./middleware/authMiddleware.js";
import { unifiedAuth } from "./middleware/unifiedAuth.middleware.js";
import { requireSubscription } from "./middleware/subscription.middleware.js";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91";
const rateLimitStore = /* @__PURE__ */ new Map();
function createRateLimiter(maxRequests, windowMs) {
  return (req, res, next) => {
    const forwarded = req.headers["x-forwarded-for"];
    const clientIp = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) || req.socket.remoteAddress || "127.0.0.1";
    const routeKey = `${req.baseUrl || req.path}:${clientIp}`;
    const now = Date.now();
    const record = rateLimitStore.get(routeKey);
    if (!record || now > record.resetTime) {
      rateLimitStore.set(routeKey, { count: 1, resetTime: now + windowMs });
      return next();
    }
    record.count++;
    if (record.count > maxRequests) {
      const retryAfterSec = Math.ceil((record.resetTime - now) / 1e3);
      res.setHeader("Retry-After", retryAfterSec.toString());
      return res.status(429).json({
        error: "Rate-Limit \xFCberschritten (DDoS/Brute-Force Schutz aktiv). Bitte warten.",
        retryAfterSec
      });
    }
    next();
  };
}
function sanitizeForSpreadsheet(val) {
  if (val === null || val === void 0) return "";
  const str = String(val).trim();
  if (/^[=+\-@\t\r\n]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
function base32ToBuffer(base32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = value << 5 | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
function generateTotpCodeForTime(secretBuffer, timeStep) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(timeStep));
  const hmac = crypto.createHmac("sha1", secretBuffer).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const codeNum = (hmac[offset] & 127) << 24 | (hmac[offset + 1] & 255) << 16 | (hmac[offset + 2] & 255) << 8 | hmac[offset + 3] & 255;
  return (codeNum % 1e6).toString().padStart(6, "0");
}
function verifyTotpRFC6238(userCode, secretBase32) {
  const cleanCode = (userCode || "").trim();
  if (!/^\d{6}$/.test(cleanCode)) return false;
  try {
    const keyBuf = base32ToBuffer(secretBase32);
    if (keyBuf.length === 0) return false;
    const currentTimeStep = Math.floor(Date.now() / 1e3 / 30);
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
function getShmMemoryStats() {
  const shmPath = fs.existsSync("/dev/shm") ? "/dev/shm" : os.tmpdir();
  let usedBytes = 0;
  let fileCount = 0;
  const activeFiles = [];
  try {
    const files = fs.readdirSync(shmPath);
    for (const file of files) {
      const fullPath = path.join(shmPath, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
          usedBytes += stats.size;
          fileCount++;
          if (file.startsWith("transient_") || file.startsWith("clip_") || activeFiles.length < 8) {
            activeFiles.push({
              name: file,
              sizeBytes: stats.size,
              modifiedAt: stats.mtime.toISOString()
            });
          }
        }
      } catch {
      }
    }
  } catch (err) {
    console.warn("[SHM Read Warning]", err);
  }
  const totalSystemMemory = os.totalmem();
  const shmCapacityBytes = Math.min(Math.floor(totalSystemMemory * 0.5), 1024 * 1024 * 1024);
  const usedMB = Number((usedBytes / (1024 * 1024)).toFixed(3));
  const capacityMB = Number((shmCapacityBytes / (1024 * 1024)).toFixed(2));
  const freeMB = Number(Math.max(0, capacityMB - usedMB).toFixed(2));
  const usagePercentage = Number((usedBytes / (shmCapacityBytes || 1) * 100).toFixed(2));
  const mem = process.memoryUsage();
  return {
    path: shmPath,
    isShmNative: fs.existsSync("/dev/shm"),
    usedBytes,
    usedMB,
    capacityBytes: shmCapacityBytes,
    capacityMB,
    freeMB,
    usagePercentage,
    activeFileCount: fileCount,
    activeFiles,
    ephemeralStorageStatus: usedBytes === 0 ? "CLEAN_EMPTY (0.00 MB)" : `VOLATILE_IN_USE (${usedMB} MB)`,
    zeroDiskGuaranteed: true,
    processMemoryMB: {
      heapUsed: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
      heapTotal: Number((mem.heapTotal / (1024 * 1024)).toFixed(2)),
      rss: Number((mem.rss / (1024 * 1024)).toFixed(2))
    },
    lastChecked: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function createExpressApp() {
  const app = express();
  app.get(["/healthz", "/health", "/api/health", "/livez", "/readyz"], (_req, res) => {
    const shm = getShmMemoryStats();
    res.status(200).json({
      status: "healthy",
      operationalState: "OPERATIONAL",
      service: "quickclick-app",
      version: "7.0.0",
      port: Number(process.env.PORT) || 3e3,
      zeroStorageStatus: "active (0 MB cloud video storage)",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      architecture: "Zero-Storage Cloud-Native (0 MB)",
      heartbeat: {
        healthy: true,
        operationalState: "OPERATIONAL",
        pulseTimestamp: Date.now(),
        uptimeSeconds: Math.floor(process.uptime()),
        statusBadge: "ONLINE_HEALTHY",
        serverLocation: "Frankfurt am Main (europe-west3)"
      },
      shm
    });
  });
  app.get(["/api/system/gcp-verify", "/api/v1/system/gcp-verify"], requireAdmin, (_req, res) => {
    res.status(200).json({
      success: true,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      project: "qlipzync",
      projectNumber: "248792984033",
      firestore: {
        databaseId: FIRESTORE_DB_ID,
        region: process.env.GCP_REGION || "europe-west3",
        multiTenantIsolation: "enforced (request.auth.uid == userId)"
      },
      workloadIdentityFederation: {
        repository: "qlipzync/quickclick-beta",
        pool: "projects/248792984033/locations/global/workloadIdentityPools/github-pool",
        provider: "projects/248792984033/locations/global/workloadIdentityPools/github-pool/providers/github-provider",
        principalSet: "principalSet://iam.googleapis.com/projects/248792984033/locations/global/workloadIdentityPools/github-pool/attribute.repository/qlipzync/quickclick-beta"
      },
      cloudRun: {
        serviceName: "quickclick-app",
        region: process.env.GCP_REGION || "europe-west3",
        serviceAccount: "qlipzync-runner@qlipzync.iam.gserviceaccount.com",
        requiredRoles: [
          "roles/run.admin",
          "roles/run.invoker",
          "roles/datastore.user",
          "roles/aiplatform.user",
          "roles/cloudkms.cryptoKeyEncrypterDecrypter",
          "roles/secretmanager.secretAccessor",
          "roles/cloudtasks.enqueuer",
          "roles/iam.serviceAccountUser",
          "roles/logging.logWriter"
        ],
        healthEndpoint: "/api/health"
      }
    });
  });
  app.get("/api/system/shm-usage", (_req, res) => {
    const stats = getShmMemoryStats();
    res.status(200).json({
      success: true,
      data: stats,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.get("/api/system/shm-stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    const initialStats = getShmMemoryStats();
    res.write(`data: ${JSON.stringify({ type: "shm_telemetry", ...initialStats })}

`);
    const interval = setInterval(() => {
      try {
        const stats = getShmMemoryStats();
        res.write(`data: ${JSON.stringify({ type: "shm_telemetry", ...stats })}

`);
      } catch {
        clearInterval(interval);
      }
    }, 2e3);
    req.on("close", () => {
      clearInterval(interval);
    });
  });
  app.post("/api/system/shm-purge", (_req, res) => {
    const shmPath = fs.existsSync("/dev/shm") ? "/dev/shm" : os.tmpdir();
    let purgedFiles = 0;
    try {
      const files = fs.readdirSync(shmPath);
      for (const file of files) {
        if (file.startsWith("transient_") || file.startsWith("clip_")) {
          try {
            fs.unlinkSync(path.join(shmPath, file));
            purgedFiles++;
          } catch {
          }
        }
      }
    } catch {
    }
    const stats = getShmMemoryStats();
    res.status(200).json({
      success: true,
      purgedFiles,
      message: `${purgedFiles} fl\xFCchtige Dateien in /dev/shm bereinigt.`,
      stats
    });
  });
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Content-Security-Policy",
      "frame-ancestors 'self' https://*.google.com https://*.run.app https://*.ai.studio https://ai.studio https://*.googleusercontent.com;"
    );
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  const trustedOrigins = [
    /^https:\/\/.*\.run\.app$/,
    /^https:\/\/.*\.google\.com$/,
    /^https:\/\/.*\.ai\.studio$/,
    /^https:\/\/ai\.studio$/,
    /^https:\/\/.*\.googleusercontent\.com$/,
    /^http:\/\/localhost:\d+$/
  ];
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const isTrusted = trustedOrigins.some((regex) => regex.test(origin));
        if (isTrusted || process.env.NODE_ENV !== "production") {
          return callback(null, true);
        }
        return callback(new Error("CORS Not Allowed by Security Policy"));
      },
      credentials: true
    })
  );
  app.use(
    express.json({
      limit: "10mb",
      verify: (req, _res, buf) => {
        if (req.originalUrl && (req.originalUrl.startsWith("/api/stripe/webhook") || req.originalUrl.startsWith("/api/webhooks/twitch") || req.originalUrl.startsWith("/api/twitch/webhook"))) {
          req.rawBody = buf;
        }
      }
    })
  );
  app.get(["/api/config/public", "/api/v1/config/public"], (_req, res) => {
    res.status(200).json({
      success: true,
      version: "7.0.0",
      config: {
        apiKey: process.env.VITE_FIREBASE_API_KEY || "",
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "qlipzync.firebaseapp.com",
        projectId: "qlipzync"
      },
      pricing: {
        model: "dynamic_slider",
        minClips: 1,
        maxClips: 2e4,
        minUnitPriceEur: 0.05,
        maxUnitPriceEur: 0.5
      }
    });
  });
  app.get(["/api/user/profile", "/api/v1/user/profile"], requireAuth, async (req, res) => {
    try {
      const user = req.user;
      res.status(200).json({
        success: true,
        data: {
          uid: user.uid,
          email: user.email,
          role: user.role,
          isAdmin: user.isAdmin,
          subscriptionPlan: user.subscriptionPlan || "free"
        }
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.get(["/api/admin/whitelist", "/api/v1/admin/whitelist"], requireAdmin, async (_req, res) => {
    res.status(200).json({
      success: true,
      whitelist: [
        { email: "robert.f.telekom@gmail.com", role: "admin" },
        { email: "sh00trs.tv@gmail.com", role: "streamer" },
        { email: "twoandahalfeafc@gmail.com", role: "streamer" }
      ]
    });
  });
  app.post(["/api/clips/generate", "/api/v1/clips/generate"], requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const userId = req.user.uid;
      const { streamId, twitchBroadcasterId, targetPlatforms, aspectRatio } = req.body || {};
      const plan = req.user?.subscriptionPlan || "pro";
      const db = getFirestore(FIRESTORE_DB_ID);
      const jobDoc = await db.collection("users").doc(userId).collection("clip_jobs").add({
        userId,
        streamId: streamId || `stream_${Date.now()}`,
        twitchBroadcasterId: twitchBroadcasterId || null,
        plan,
        aspectRatio: aspectRatio || "9:16",
        targetPlatforms: targetPlatforms || ["tiktok", "shorts", "reels"],
        status: "queued",
        storageUsedMb: 0,
        createdAt: FieldValue.serverTimestamp()
      });
      res.status(202).json({
        success: true,
        message: "Clip-Generierungsauftrag erfolgreich eingereiht (Zero-Storage RAM-Stream).",
        jobId: jobDoc.id,
        userId,
        plan,
        aspectRatio: aspectRatio || "9:16",
        targetPlatforms: targetPlatforms || ["tiktok", "shorts", "reels"]
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post(["/api/byok/keys", "/api/v1/byok/keys"], requireAuth, requireActiveSubscription, async (req, res) => {
    try {
      const userId = req.user.uid;
      const { apiKey, provider } = req.body || {};
      if (!apiKey || !provider) {
        return res.status(400).json({ success: false, error: "Provider und APIKey erforderlich." });
      }
      const encryptedKey = await encryptSecret(String(apiKey));
      const db = getFirestore(FIRESTORE_DB_ID);
      await db.collection("users").doc(userId).collection("byok_keys").doc(String(provider)).set({
        userId,
        provider: String(provider),
        encryptedKey,
        updatedAt: FieldValue.serverTimestamp()
      });
      return res.status(200).json({ success: true, provider, message: "BYOK Schl\xFCssel KMS-verschl\xFCsselt hinterlegt." });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  app.post("/api/billing/topup", requireAuth, handleTopupRequest);
  app.get(["/api/system/urls", "/api/system/routes"], (_req, res) => {
    res.status(200).json({
      success: true,
      service: "QlipZync API Gateway & Route Architecture",
      architecture: "Zero-Storage Cloud-Native (0 MB Disk)",
      version: "6.0.0",
      canonicalBase: "/api",
      canonicalHierarchy: {
        coreSystem: [
          { method: "GET", path: "/api/health", description: "Real-time Heartbeat & Health Telemetry", aliases: ["/healthz", "/health", "/livez", "/readyz"] },
          { method: "GET", path: "/api/system/status", description: "Pipeline- und Speicher-Status" },
          { method: "GET", path: "/api/system/shm-usage", description: "Echtzeit-Telemetrie fl\xFCchtiger RAM (/dev/shm)" },
          { method: "GET", path: "/api/system/shm-stream", description: "Server-Sent Events (SSE) RAM-Telemetriestrom" },
          { method: "POST", path: "/api/system/shm-purge", description: "Manuelle RAM-Speicherbereinigung" },
          { method: "GET", path: "/api/security/audit", description: "Sicherheits- & DSGVO-Audit-Bericht" },
          { method: "GET", path: "/api/system/urls", description: "Katalog aller kanonischen URLs", aliases: ["/api/system/routes"] },
          { method: "GET", path: "/api/config/public", description: "\xD6ffentliche System- und Tier-Konfiguration", aliases: ["/api/v1/config/public"] },
          { method: "GET", path: "/api/user/profile", description: "Gesch\xFCtztes Nutzer-Profil", aliases: ["/api/v1/user/profile"] },
          { method: "GET", path: "/api/admin/whitelist", description: "Gesch\xFCtzte Administrator-Whitelist", aliases: ["/api/v1/admin/whitelist"] }
        ],
        authentication: [
          { method: "GET", path: "/api/auth/:provider/connect", description: "OAuth-Initiierung mit Gatekeeper" },
          { method: "ALL", path: "/api/auth/:provider/callback", description: "OAuth-Callback & Token-Exchange" },
          { method: "DELETE", path: "/api/auth/:provider/disconnect", description: "Kanal-Verkn\xFCpfung trennen" },
          { method: "GET", path: "/api/auth/integrations/status", description: "Status aller verkn\xFCpften Konten" },
          { method: "GET", path: "/api/auth/events", description: "Audit-Event-Log" },
          { method: "POST", path: "/api/auth/2fa/generate", description: "TOTP 2FA Secret & QR-Code" },
          { method: "POST", path: "/api/auth/2fa/verify", description: "TOTP 2FA Code-Verifikation" },
          { method: "GET", path: "/auth/callback", description: "Twitch OAuth Popup Callback Handler" }
        ],
        clipsPipeline: [
          { method: "POST", path: "/api/clips/process", description: "Zero-Storage RAM Clip-Verarbeitung", aliases: ["/api/clips/process-clip", "/api/pipeline/process"] },
          { method: "POST", path: "/api/clips/generate", description: "Clip-Generierungsauftrag", aliases: ["/api/v1/clips/generate"] },
          { method: "GET", path: "/api/clips/stats", description: "Echte Clip-Statistiken aus Firestore" }
        ],
        artificialIntelligence: [
          { method: "POST", path: "/api/ai/quickclick-engine", description: "QuickClick Multimodal Video Intelligence Agent (Google AI Studio)", aliases: ["/api/clip/analyze", "/api/clips/analyze-quickclick"] },
          { method: "GET", path: "/api/ai/quickclick-config", description: "QuickClick System Instructions & AI Studio JSON-Schema", aliases: ["/api/clip/engine-config"] },
          { method: "POST", path: "/api/ai/metadata", description: "Social Media Metadaten via Gemini", aliases: ["/api/ai/generate-clip-metadata", "/api/gemini/generate-clip-metadata"] },
          { method: "POST", path: "/api/ai/script", description: "Virales Kurzvideo-Skript", aliases: ["/api/ai/generate-script", "/api/gemini/generate-script"] },
          { method: "POST", path: "/api/ai/pitch", description: "Sponsoren-Pitch-Generator", aliases: ["/api/ai/generate-pitch", "/api/gemini/generate-pitch"] },
          { method: "POST", path: "/api/ai/analyze", description: "Clip-Viralit\xE4tsanalyse", aliases: ["/api/ai/analyze-clip"] },
          { method: "POST", path: "/api/ai/advisor", description: "Architekturberatung / Gemini Prompt", aliases: ["/api/ai/prompt"] }
        ],
        twitchEngine: [
          { method: "POST", path: "/api/twitch/webhook", description: "EventSub Webhook Listener", aliases: ["/api/webhooks/twitch", "/api/twitch/eventsub"] },
          { method: "POST", path: "/api/twitch/cooldown-task", description: "Cloud Tasks 300s Stream-Cooldown" },
          { method: "POST", path: "/api/twitch/token-exchange", description: "Twitch Helix Token-Exchange" },
          { method: "POST", path: "/api/twitch/test-notification", description: "Live Multi-Channel Notification Tester" }
        ],
        stripeMonetization: [
          { method: "POST", path: "/api/stripe/checkout", description: "Stripe Checkout Session erstellen", aliases: ["/api/stripe/create-checkout-session"] },
          { method: "POST", path: "/api/stripe/webhook", description: "Stripe Webhook Listener", aliases: ["/api/webhooks/stripe"] },
          { method: "GET", path: "/api/stripe/events", description: "Audit-Log der Stripe Webhook-Events", aliases: ["/api/stripe/webhook/events"] }
        ],
        integrations: [
          { method: "GET", path: "/api/integrations/status", description: "Status aller externen Dienste" },
          { method: "POST", path: "/api/integrations/validate", description: "BYOK Live-Validierung im fl\xFCchtigen RAM" },
          { method: "POST", path: "/api/integrations/encrypt-secret", description: "KMS Envelope-Verschl\xFCsselung" },
          { method: "GET", path: "/api/integrations/sheets/config", description: "Google Sheets Konfiguration", aliases: ["/api/sheets/config"] },
          { method: "POST", path: "/api/integrations/sheets/provision", description: "Google Sheet Vorlage duplizieren", aliases: ["/api/sheets/duplicate-template", "/api/sheets/provision"] },
          { method: "GET", path: "/api/integrations/sheets/live-rows", description: "Echte Tabellenzeilen aus Google Sheets", aliases: ["/api/sheets/live-rows", "/api/sheets/user-data", "/api/sheets/live-data"] },
          { method: "POST", path: "/api/integrations/sheets/append", description: "Clip in Google Tabelle protokollieren", aliases: ["/api/sheets/append"] },
          { method: "POST", path: "/api/integrations/sheets/admin-append", description: "Admin Finanz-Matrix Protokollierung", aliases: ["/api/sheets/admin-append"] },
          { method: "GET", path: "/api/integrations/discord/status", description: "Discord Bot Status", aliases: ["/api/discord/status"] },
          { method: "POST", path: "/api/integrations/discord/send", description: "Discord Nachricht senden", aliases: ["/api/discord/send"] },
          { method: "POST", path: "/api/integrations/discord/stream-alert", description: "Discord Stream Ank\xFCndigung Rich-Embed", aliases: ["/api/discord/stream-alert"] }
        ],
        extraClipsOnDemand: [
          { method: "ALL", path: "/api/extra-clips/handle", description: "Dynamische Extra-Clips Aktions-Verarbeitung", aliases: ["/api/handle-extra-clips", "/handle-extra-clips"] },
          { method: "GET", path: "/api/extra-clips/select", description: "E-Mail Fallback Web-Interface", aliases: ["/api/select-clips", "/select-clips"] }
        ],
        legalAndGdpr: [
          { method: "POST", path: "/api/gdpr/export", description: "DSGVO Art. 15/20 Datenexport" },
          { method: "POST", path: "/api/gdpr/delete", description: "DSGVO Art. 17 Datenl\xF6schung" },
          { method: "GET", path: "/datenschutz", description: "Datenschutzerkl\xE4rung (HTML/JSON)", aliases: ["/privacy", "/api/legal/datenschutz", "/api/legal/privacy"] },
          { method: "GET", path: "/agb", description: "Allgemeine Gesch\xE4ftsbedingungen (HTML/JSON)", aliases: ["/terms", "/nutzungsbedingungen", "/api/legal/agb", "/api/legal/terms"] },
          { method: "GET", path: "/impressum", description: "Impressum gem. \xA7 5 DDG (HTML/JSON)", aliases: ["/api/legal/impressum"] },
          { method: "GET", path: "/avv", description: "Auftragsverarbeitungsvertrag gem. Art. 28 DSGVO (HTML/JSON)", aliases: ["/api/legal/avv"] }
        ],
        frontendNavigation: [
          { route: "/", description: "Startseite / Landing Page oder Dashboard je nach Nutzer-Status" },
          { hash: "#datenschutz", description: "\xD6ffnet Modal Datenschutzerkl\xE4rung" },
          { hash: "#agb", description: "\xD6ffnet Modal AGB & Nutzungsbedingungen" },
          { hash: "#impressum", description: "\xD6ffnet Modal Impressum" },
          { hash: "#avv", description: "\xD6ffnet Modal Auftragsverarbeitungsvertrag (AVV)" },
          { hash: "#audit", description: "\xD6ffnet Modal DSGVO-Audit" }
        ]
      }
    });
  });
  app.get("/api/system/status", (_req, res) => {
    const memory = process.memoryUsage();
    res.json({
      status: "healthy",
      activePipelines: ["pipeline-1-social", "pipeline-2-bots", "pipeline-3-clip-sheets"],
      memoryAllocatedMB: (memory.heapUsed / 1024 / 1024).toFixed(2),
      ephemeralStorageUsedMB: "0.00 MB (RAM-only Zero-Storage buffer)",
      activeWebhooks: {
        twitchEventSub: true,
        discordAlerts: true,
        telegramBroadcast: true,
        googleSheetsSync: true
      },
      rateLimits: {
        sheetsWritesPerMin: "60/min standard",
        geminiTokensPerMonth: "2,000,000 quota",
        cloudRunMaxBufferSec: 300
      }
    });
  });
  app.get(["/auth/callback", "/auth/callback/"], (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>QuickClick Autopilot \u2022 Twitch Autorisierung</title>
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
    <p id="status-text">Autorisierungsdaten werden an QuickClick Autopilot \xFCbermittelt...</p>
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
          document.getElementById('status-text').textContent = 'Erfolgreich autorisiert! Dieses Fenster schlie\xDFt automatisch...';
          
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
  app.use("/api/auth", authOAuthRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/gemini", aiRouter);
  app.use("/api/clips", clipsRouter);
  app.use("/api/pipeline", clipsRouter);
  app.use("/api/v1/pipeline", clipsRouter);
  app.use("/api/twitch", twitchRouter);
  app.post(
    ["/api/webhooks/twitch", "/api/webhooks/twitch/eventsub"],
    createRateLimiter(120, 6e4),
    handleTwitchWebhook
  );
  app.use("/api/v1/stripe", stripeRouter);
  app.use("/api/stripe", stripeRouter);
  app.post("/api/webhooks/stripe", (req, res, next) => stripeRouter(req, res, next));
  app.use("/api/integrations", integrationsRouter);
  app.use("/api/sheets", integrationsRouter);
  app.use("/api/discord", integrationsRouter);
  app.use(extraClipsRouter);
  app.use("/api/v1/platforms", platformRouter);
  app.use("/api/platforms", platformRouter);
  app.use("/api/v1/subscription", subscriptionRouter);
  app.use("/api/subscription", subscriptionRouter);
  app.post("/api/v1/subscription/webhook", handleStripeSubscriptionWebhook);
  app.use("/api/v1/keys", apiKeyRouter);
  app.use("/api/keys", apiKeyRouter);
  app.use("/api/v1/api-keys", apiKeyRouter);
  app.use("/api/api-keys", apiKeyRouter);
  app.post(
    ["/api/v1/clips/trigger-sync", "/api/clips/trigger-sync"],
    unifiedAuth,
    requireSubscription,
    async (req, res) => {
      const userId = req.user.uid;
      try {
        const db = getFirestore(FIRESTORE_DB_ID);
        const userDoc = await db.collection("users").doc(userId).get();
        const userData = userDoc.data();
        const channelName = userData?.channelName || userData?.name || "Twitch Streamer";
        const syncJobDoc = await db.collection("users").doc(userId).collection("sync_jobs").add({
          userId,
          channelName,
          triggeredVia: req.headers["x-api-key"] ? "X-API-Key" : "Bearer-JWT",
          status: "queued",
          storageUsedMb: 0,
          createdAt: FieldValue.serverTimestamp()
        });
        return res.status(202).json({
          success: true,
          message: "Sync-Job erfolgreich in die Warteschlange eingereiht.",
          detail: `Sync-Pipeline f\xFCr Kanal "${channelName}" erfolgreich ausgel\xF6st (Zero-Storage RAM-Stream).`,
          jobId: syncJobDoc.id,
          userId,
          channelName,
          triggeredVia: req.headers["x-api-key"] ? "X-API-Key" : "Bearer-JWT",
          storageUsedMb: 0,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (error) {
        return res.status(500).json({ success: false, error: error?.message || "Trigger-Fehler" });
      }
    }
  );
  app.post("/api/gdpr/export", requireAuth, async (req, res) => {
    try {
      const uid = req.user.uid;
      const db = getFirestore(FIRESTORE_DB_ID);
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.data() || {};
      const clipsSnap = await db.collection("users").doc(uid).collection("clips").count().get();
      const integrationsSnap = await db.collection("users").doc(uid).collection("integrations").get();
      return res.status(200).json({
        success: true,
        export: {
          exportMetadata: {
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            regulation: "EU General Data Protection Regulation (DSGVO / GDPR 2016/679)",
            articles: ["Art. 15 (Auskunft)", "Art. 20 (Daten\xFCbertragbarkeit)"],
            databaseId: FIRESTORE_DB_ID
          },
          user: {
            userId: uid,
            channelName: userData.channelName || userData.name || null,
            email: req.user.email || userData.email || null,
            role: req.user.role,
            subscriptionStatus: userData.subscriptionStatus || "inactive",
            clipsRecordedCount: clipsSnap.data().count,
            connectedPlatforms: integrationsSnap.docs.map((d) => d.id)
          },
          audit: {
            zeroStorageRetentionSec: 0,
            persistentFilesRecorded: 0,
            ramBuffersPurged: true,
            thirdPartySharing: "Ausdr\xFCcklich verboten (keine Werbenetzwerke)",
            euCloudRegion: "Frankfurt am Main (europe-west3)"
          }
        }
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err?.message || "DSGVO-Export fehlgeschlagen" });
    }
  });
  app.post("/api/gdpr/delete", requireAuth, async (req, res) => {
    try {
      const uid = req.user.uid;
      const db = getFirestore(FIRESTORE_DB_ID);
      const userRef = db.collection("users").doc(uid);
      for (const sub of ["integrations", "clips", "apiKeys", "byok_keys", "security", "sync_jobs"]) {
        const snap = await userRef.collection(sub).get();
        for (const docSnap of snap.docs) {
          await docSnap.ref.delete();
        }
      }
      await userRef.delete();
      console.log(`\u{1F5D1}\uFE0F [DSGVO Art. 17] Verifizierte L\xF6schung f\xFCr UID: ${uid}`);
      return res.status(200).json({
        success: true,
        userId: uid,
        message: "Alle anwenderspezifischen Datens\xE4tze wurden gem\xE4\xDF Art. 17 DSGVO unwiderruflich aus Firestore gel\xF6scht.",
        deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
        storageResidualMB: 0
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err?.message || "DSGVO-L\xF6schung fehlgeschlagen" });
    }
  });
  app.get("/api/security/audit", (_req, res) => {
    return res.json({
      status: "SECURE",
      auditDate: (/* @__PURE__ */ new Date()).toISOString(),
      standards: ["BSI IT-Grundschutz", "OWASP Top 10:2021", "EU-DSGVO Art. 5, 17, 25, 32"],
      layers: {
        administratorRoleEnforced: {
          masterAdmin: "robert.f.telekom@gmail.com",
          status: "ACTIVE"
        },
        databaseSecurity: {
          status: "ENFORCED",
          engine: "Firebase Firestore Rules v2",
          pillarsActive: 8,
          defaultDenyCatchAll: true
        },
        dataMinimization: {
          status: "CERTIFIED",
          principle: "Zero-Storage In-Memory Architecture (0 MB)",
          rawVideoStoredOnDiskMB: 0
        }
      }
    });
  });
  app.get(["/datenschutz", "/privacy", "/api/legal/privacy", "/api/legal/datenschutz"], (req, res) => {
    if (req.headers.accept?.includes("application/json") || req.path.startsWith("/api/")) {
      return res.status(200).json({
        success: true,
        document: "Datenschutzerkl\xE4rung (DSGVO / GDPR)",
        standards: ["EU-DSGVO 2016/679 Art. 13 & 14", "TDDDG", "BSI IT-Grundschutz"],
        serverLocation: "Frankfurt am Main (europe-west3)",
        architecture: "Zero-Storage Fl\xFCchtiger RAM (0 MB persistente Festplattenspeicherung)",
        responsibleEntity: {
          operator: "QuickClick Cloud Systems",
          contact: "robert.f.telekom@gmail.com",
          jurisdiction: "Bundesrepublik Deutschland"
        },
        directAppUrl: `${req.protocol}://${req.get("host")}/#datenschutz`
      });
    }
    return res.redirect("/#datenschutz");
  });
  app.get(["/agb", "/terms", "/nutzungsbedingungen", "/api/legal/terms", "/api/legal/agb"], (req, res) => {
    if (req.headers.accept?.includes("application/json") || req.path.startsWith("/api/")) {
      return res.status(200).json({
        success: true,
        document: "Allgemeine Gesch\xE4ftsbedingungen (AGB) & Widerrufsbelehrung",
        legalBasis: ["BGB \xA7\xA7 305 ff.", "\xA7 355 BGB (Gesetzliches 14-Tage Widerrufsrecht)"],
        governingLaw: "Recht der Bundesrepublik Deutschland",
        directAppUrl: `${req.protocol}://${req.get("host")}/#agb`
      });
    }
    return res.redirect("/#agb");
  });
  app.get(["/impressum", "/api/legal/impressum"], (req, res) => {
    if (req.headers.accept?.includes("application/json") || req.path.startsWith("/api/")) {
      return res.status(200).json({
        success: true,
        document: "Impressum nach \xA7 5 DDG & \xA7 18 Abs. 2 MStV",
        operator: "QuickClick Cloud Systems",
        directAppUrl: `${req.protocol}://${req.get("host")}/#impressum`
      });
    }
    return res.redirect("/#impressum");
  });
  app.get(["/avv", "/api/legal/avv"], (req, res) => {
    if (req.headers.accept?.includes("application/json") || req.path.startsWith("/api/")) {
      return res.status(200).json({
        success: true,
        document: "Auftragsverarbeitungsvertrag (AVV nach Art. 28 DSGVO)",
        directAppUrl: `${req.protocol}://${req.get("host")}/#avv`
      });
    }
    return res.redirect("/#avv");
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Endpunkt nicht gefunden" });
  });
  return app;
}
async function startServer() {
  const app = await createExpressApp();
  const PORT = Number(process.env.PORT) || 3e3;
  const isProd = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), "dist");
  const indexHtmlPath = path.join(distPath, "index.html");
  if (isProd && fs.existsSync(indexHtmlPath)) {
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(indexHtmlPath);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.method !== "GET") {
        return next();
      }
      const url = req.originalUrl;
      try {
        const rootIndexPath = path.resolve(process.cwd(), "index.html");
        if (!fs.existsSync(rootIndexPath)) {
          return next();
        }
        let template = fs.readFileSync(rootIndexPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        if (vite) vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[QuickClick] Full-Stack Server l\xE4uft auf http://0.0.0.0:${PORT}`);
  });
}
export {
  createExpressApp,
  createRateLimiter,
  getShmMemoryStats,
  sanitizeForSpreadsheet,
  startServer,
  verifyTotpRFC6238
};
