import { Router } from "express";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { encryptSecret } from "../services/kmsService.js";
import { createRateLimiter, sanitizeForSpreadsheet } from "../index.js";
import { verifyAuth, requireActiveSubscription, requireAdmin } from "../middleware/authMiddleware.js";
import { isMasterAdminEmail } from "../services/firebaseAdmin.js";
import {
  getAccountIntegration
} from "../services/accountIntegrations.js";
import {
  duplicateTemplateSheetForUser,
  fetchLiveSpreadsheetData
} from "../services/googleWorkspaceService.js";
import { fetchTwitchChannelLiveDetails } from "../services/twitchEventSubService.js";
const integrationsRouter = Router();
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91";
const db = getFirestore(FIRESTORE_DB_ID);
const DEFAULT_PUBLIC_SPREADSHEET_ID = "1KfQ1RQXoXFaRIDJ76eRy8rmeV_BLP5NkYkiVaOyzqcw";
const DEFAULT_ADMIN_SPREADSHEET_ID = "1C6poLpleH0m9WAhjUM9rNMxYzCuqs8rrv49sTiiZPAA";
const DEFAULT_DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "1508474040149610497";
const DEFAULT_DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const DEFAULT_DISCORD_BOT_ID = process.env.DISCORD_BOT_ID || "1534172980270203001";
const DEFAULT_DISCORD_INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${DEFAULT_DISCORD_BOT_ID}&permissions=274877908992&scope=bot`;
const validateLimiter = createRateLimiter(30, 6e4);
integrationsRouter.get("/status", verifyAuth, requireActiveSubscription, async (req, res) => {
  const uid = req.user.uid;
  try {
    const twitchInteg = getAccountIntegration(uid, "twitch");
    const twitchConnected = Boolean(twitchInteg && twitchInteg.encryptedAccessToken);
    let twitchData = {
      connected: twitchConnected,
      channelName: twitchInteg?.accountUserName || null,
      displayName: twitchInteg?.accountUserName || null,
      avatarUrl: twitchInteg?.profilePicture || null,
      isLive: false,
      viewerCount: 0,
      game: null,
      title: null
    };
    if (twitchConnected && twitchInteg?.accountUserName) {
      try {
        const liveDetails = await fetchTwitchChannelLiveDetails(twitchInteg.accountUserName, uid);
        twitchData = {
          connected: true,
          channelName: liveDetails.channelName || twitchInteg.accountUserName,
          displayName: liveDetails.displayName || twitchInteg.accountUserName,
          avatarUrl: liveDetails.profileImageUrl || twitchInteg.profilePicture || null,
          isLive: liveDetails.isLive,
          viewerCount: liveDetails.viewerCount || 0,
          game: liveDetails.gameName || null,
          title: liveDetails.title || null
        };
      } catch (err) {
        console.error("[Twitch Status Helix Error]", err);
      }
    }
    const googleInteg = getAccountIntegration(uid, "google");
    const googleConnected = Boolean(googleInteg && (googleInteg.encryptedAccessToken || googleInteg.spreadsheetId));
    const googleData = {
      connected: googleConnected,
      spreadsheetId: googleInteg?.spreadsheetId || null,
      spreadsheetUrl: googleInteg?.spreadsheetUrl || null
    };
    const discordInteg = getAccountIntegration(uid, "discord");
    const discordWebhookConfigured = Boolean(
      process.env.DISCORD_WEBHOOK_URL || process.env.DISCORD_BOT_TOKEN || discordInteg?.metadata?.webhookUrl
    );
    const discordData = {
      connected: Boolean(discordInteg || discordWebhookConfigured),
      webhookConfigured: discordWebhookConfigured
    };
    return res.status(200).json({
      twitch: twitchData,
      google: googleData,
      discord: discordData,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message || "Fehler beim Abrufen des Integrations-Status",
      twitch: { connected: false, channelName: null, avatarUrl: null, isLive: false, viewerCount: 0 },
      google: { connected: false, spreadsheetId: null, spreadsheetUrl: null },
      discord: { connected: false, webhookConfigured: false }
    });
  }
});
integrationsRouter.get(["/sheets/config", "/config/sheets"], (_req, res) => {
  const publicId = process.env.GOOGLE_SHEETS_PUBLIC_SPREADSHEET_ID || DEFAULT_PUBLIC_SPREADSHEET_ID;
  const adminId = process.env.GOOGLE_SHEETS_ADMIN_SPREADSHEET_ID || DEFAULT_ADMIN_SPREADSHEET_ID;
  return res.json({
    status: "ok",
    publicSheet: {
      id: publicId,
      url: `https://docs.google.com/spreadsheets/d/${publicId}/edit?gid=0#gid=0`,
      name: "QuickClick Master Clip Log (\xD6ffentlich)",
      defaultTab: "QuickClick_Clips_Master"
    },
    adminSheet: {
      id: adminId,
      url: `https://docs.google.com/spreadsheets/d/${adminId}/edit?gid=0#gid=0`,
      name: "QuickClick Admin Profit & Financial Matrix (Vertraulich)",
      defaultTab: "Admin_Finance_Audit"
    }
  });
});
integrationsRouter.post(
  ["/sheets/provision", "/google/provision", "/duplicate-template"],
  verifyAuth,
  requireActiveSubscription,
  async (req, res) => {
    const uid = req.user.uid;
    const { channelName, userName: bodyUserName } = req.body || {};
    const userName = channelName || bodyUserName || req.user?.email || uid;
    try {
      const result = await duplicateTemplateSheetForUser(uid, userName);
      if (!result.success && result.error) {
        return res.status(400).json(result);
      }
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message || "Automatisierte Google Sheets Bereitstellung fehlgeschlagen"
      });
    }
  }
);
integrationsRouter.get(
  ["/sheets/live-rows", "/live-rows", "/sheets/user-data", "/sheets/live-data"],
  verifyAuth,
  requireActiveSubscription,
  async (req, res) => {
    const uid = req.user.uid;
    const range = req.query.range || "QuickClick_Clips_Master!A2:J50";
    try {
      const result = await fetchLiveSpreadsheetData(uid, range);
      const rawValues = result.values || [];
      const rows = rawValues.map((row, idx) => ({
        id: `row-${idx + 1}`,
        timestamp: row[0] || (/* @__PURE__ */ new Date()).toISOString(),
        clipTitle: row[1] || "Clip",
        game: row[2] || "Gaming",
        durationSec: parseInt(row[3], 10) || 30,
        tiktokUrl: row[4] || "",
        xPostUrl: row[5] || "",
        shortsUrl: row[6] || "",
        tempStorageState: row[7] || "GEL\xD6SCHT (0 MB)",
        status: row[8] || "Erfolgreich"
      }));
      return res.status(200).json({
        success: true,
        spreadsheetId: result.spreadsheetId,
        range: result.range,
        rows,
        count: rows.length
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message || "Fehler beim Laden der Google Sheets Zeilen",
        rows: [],
        count: 0
      });
    }
  }
);
integrationsRouter.post(
  "/sheets/append",
  verifyAuth,
  requireActiveSubscription,
  createRateLimiter(60, 6e4),
  async (req, res) => {
    const uid = req.user.uid;
    const { spreadsheetId, sheetTabName, clipTitle, game, durationSec, urls } = req.body || {};
    if (!clipTitle || typeof clipTitle !== "string") {
      return res.status(400).json({
        success: false,
        error: 'Pflichtfeld "clipTitle" fehlt f\xFCr die Protokollierung.'
      });
    }
    const targetSpreadsheetId = spreadsheetId || process.env.GOOGLE_SHEETS_PUBLIC_SPREADSHEET_ID || DEFAULT_PUBLIC_SPREADSHEET_ID;
    const timestampIso = (/* @__PURE__ */ new Date()).toISOString();
    const rowData = [
      sanitizeForSpreadsheet((/* @__PURE__ */ new Date()).toLocaleString("de-DE")),
      sanitizeForSpreadsheet(clipTitle),
      sanitizeForSpreadsheet(game || "Live Stream"),
      sanitizeForSpreadsheet(`${Number(durationSec) || 30}s`),
      sanitizeForSpreadsheet(urls?.tiktok || ""),
      sanitizeForSpreadsheet(urls?.xTwitter || ""),
      sanitizeForSpreadsheet(urls?.shorts || ""),
      "GEL\xD6SCHT (0 MB)",
      "Erfolgreich"
    ];
    try {
      const logDoc = await db.collection("users").doc(uid).collection("sheet_logs").add({
        userId: uid,
        spreadsheetId: targetSpreadsheetId,
        tabName: sheetTabName || "QuickClick_Clips_Master",
        clipTitle: sanitizeForSpreadsheet(clipTitle),
        game: sanitizeForSpreadsheet(game || "Live Stream"),
        durationSec: Number(durationSec) || 30,
        urls: {
          tiktok: urls?.tiktok || "",
          xTwitter: urls?.xTwitter || "",
          shorts: urls?.shorts || ""
        },
        rowData,
        storageState: "0 MB (Direct In-Memory Write)",
        createdAt: FieldValue.serverTimestamp()
      });
      return res.status(200).json({
        success: true,
        logId: logDoc.id,
        userId: uid,
        spreadsheetId: targetSpreadsheetId,
        tabName: sheetTabName || "QuickClick_Clips_Master",
        appendedRow: rowData,
        storageState: "0 MB (Direct In-Memory Write)",
        timestamp: timestampIso
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message || "Protokollierung fehlgeschlagen."
      });
    }
  }
);
integrationsRouter.post(
  "/sheets/admin-append",
  verifyAuth,
  requireAdmin,
  createRateLimiter(20, 6e4),
  async (req, res) => {
    const verifiedAdminEmail = req.user?.email || "";
    if (!isMasterAdminEmail(verifiedAdminEmail)) {
      return res.status(403).json({
        error: "Zugriff verweigert: Diese Aktion erfordert verifizierte Administrator-Rechte (robert.f.telekom@gmail.com)."
      });
    }
    const { actionType, tierCode, amountEur, marginPercent, profitNetEur, details } = req.body || {};
    const targetSpreadsheetId = process.env.GOOGLE_SHEETS_ADMIN_SPREADSHEET_ID || DEFAULT_ADMIN_SPREADSHEET_ID;
    const adminRow = [
      sanitizeForSpreadsheet((/* @__PURE__ */ new Date()).toLocaleString("de-DE")),
      sanitizeForSpreadsheet(verifiedAdminEmail),
      sanitizeForSpreadsheet(actionType || "MARGIN_AUDIT"),
      sanitizeForSpreadsheet(tierCode || "Pro"),
      sanitizeForSpreadsheet(`${Number(amountEur || 0).toFixed(2)} \u20AC`),
      sanitizeForSpreadsheet(`${Number(marginPercent || 0)}%`),
      sanitizeForSpreadsheet(`${Number(profitNetEur || 0).toFixed(2)} \u20AC Netto`),
      sanitizeForSpreadsheet(details || "Verifizierte Admin-Transaktion")
    ];
    try {
      const auditDoc = await db.collection("admin_finance_audit").add({
        adminUid: req.user.uid,
        adminEmail: verifiedAdminEmail,
        actionType: actionType || "MARGIN_AUDIT",
        tierCode: tierCode || "Pro",
        amountEur: Number(amountEur || 0),
        marginPercent: Number(marginPercent || 0),
        profitNetEur: Number(profitNetEur || 0),
        details: details || "Verifizierte Admin-Transaktion",
        spreadsheetId: targetSpreadsheetId,
        createdAt: FieldValue.serverTimestamp()
      });
      return res.status(200).json({
        success: true,
        auditId: auditDoc.id,
        spreadsheetId: targetSpreadsheetId,
        tabName: "Admin_Finance_Audit",
        appendedRow: adminRow
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err.message || "Admin-Audit-Protokollierung fehlgeschlagen."
      });
    }
  }
);
integrationsRouter.get("/discord/status", async (req, res) => {
  const channelId = req.query.channelId || DEFAULT_DISCORD_CHANNEL_ID;
  const botToken = DEFAULT_DISCORD_BOT_TOKEN;
  if (!botToken) {
    return res.status(200).json({
      configured: false,
      botActive: false,
      error: "Discord Bot Token nicht konfiguriert (DISCORD_BOT_TOKEN in .env erforderlich)",
      channelId,
      inviteUrl: DEFAULT_DISCORD_INVITE_URL,
      secretConfigured: Boolean(process.env.DISCORD_CLIENT_SECRET)
    });
  }
  try {
    const botRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${botToken}` }
    });
    const botData = await botRes.json().catch(() => null);
    if (!botRes.ok) {
      return res.status(200).json({
        configured: true,
        botActive: false,
        error: botData?.message || "Ung\xFCltiges Discord Bot Token",
        channelId,
        inviteUrl: DEFAULT_DISCORD_INVITE_URL
      });
    }
    return res.status(200).json({
      configured: true,
      botActive: true,
      bot: {
        id: botData.id,
        username: botData.username
      },
      channelId,
      inviteUrl: DEFAULT_DISCORD_INVITE_URL
    });
  } catch (err) {
    return res.status(200).json({
      configured: true,
      botActive: false,
      error: err.message,
      channelId,
      inviteUrl: DEFAULT_DISCORD_INVITE_URL
    });
  }
});
integrationsRouter.post("/discord/send", verifyAuth, requireActiveSubscription, async (req, res) => {
  const { channelId, message } = req.body || {};
  const targetChannelId = channelId || DEFAULT_DISCORD_CHANNEL_ID;
  const botToken = DEFAULT_DISCORD_BOT_TOKEN;
  if (!botToken) {
    return res.status(503).json({
      success: false,
      error: "DISCORD_BOT_NOT_CONFIGURED",
      message: "Discord Bot Versand nicht m\xF6glich: DISCORD_BOT_TOKEN ist serverseitig nicht konfiguriert.",
      channelId: targetChannelId
    });
  }
  try {
    const discordRes = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content: message || "QuickClick Benachrichtigung" })
    });
    const data = await discordRes.json();
    if (!discordRes.ok) {
      return res.status(discordRes.status).json({ success: false, error: data?.message || "Discord API Fehler", data });
    }
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
integrationsRouter.post("/discord/stream-alert", verifyAuth, requireActiveSubscription, async (req, res) => {
  const { webhookUrl, channelName, streamTitle, gameName, scheduledTime, streamUrl } = req.body;
  const targetUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL;
  if (!targetUrl || !/^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks/i.test(targetUrl)) {
    return res.status(400).json({
      success: false,
      error: "Ung\xFCltige oder fehlende Discord Webhook URL."
    });
  }
  const twitchUrl = streamUrl || `https://twitch.tv/${channelName || "streamer"}`;
  try {
    const embed = {
      title: `\u{1F4C5} Stream-Ank\xFCndigung: ${streamTitle || "Twitch Live Stream"}`,
      url: twitchUrl,
      description: `**${channelName || "Streamer"}** hat einen neuen Stream geplant!`,
      color: 9520895,
      // Twitch Purple
      fields: [
        { name: "\u{1F3AE} Spiel / Kategorie", value: gameName || "Gaming", inline: true },
        { name: "\u23F0 Geplante Zeit", value: scheduledTime || "Demn\xE4chst", inline: true },
        { name: "\u26A1 Pipeline", value: "QlipZync Zero-Storage RAM", inline: true }
      ],
      footer: { text: "QuickClick Autopilot \u2022 Live Stream Calendar Sync" },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    const discordRes = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `\u{1F4E2} **Neue Stream-Session angek\xFCndigt!** Einschalten auf ${twitchUrl}`,
        embeds: [embed]
      })
    });
    if (!discordRes.ok) {
      const errText = await discordRes.text().catch(() => "Fehler");
      return res.status(discordRes.status).json({
        success: false,
        error: `Discord antwortete mit HTTP ${discordRes.status}: ${errText.slice(0, 150)}`
      });
    }
    return res.status(200).json({
      success: true,
      message: "Discord Stream-Ank\xFCndigung erfolgreich zugestellt.",
      deliveredAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Verbindung zu Discord Webhook fehlgeschlagen."
    });
  }
});
integrationsRouter.post("/validate", verifyAuth, requireActiveSubscription, validateLimiter, async (req, res) => {
  const { type, credentials } = req.body || {};
  const startTime = Date.now();
  if (!type || !credentials) {
    return res.status(400).json({
      valid: false,
      error: "Fehlender Integrationstyp oder Zugangsdaten."
    });
  }
  try {
    switch (type) {
      case "discord": {
        const { webhookUrl, botToken } = credentials;
        if (webhookUrl) {
          if (!/^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks\/\d+\/[\w-]+$/i.test(webhookUrl)) {
            return res.status(200).json({
              valid: false,
              service: "discord",
              error: "Ung\xFCltiges Discord-Webhook-URL-Format.",
              pingLatencyMs: Date.now() - startTime
            });
          }
          const pingRes = await fetch(webhookUrl, { method: "GET" });
          const latency = Date.now() - startTime;
          if (pingRes.ok || pingRes.status === 405) {
            return res.status(200).json({
              valid: true,
              service: "discord",
              pingLatencyMs: latency,
              details: "Discord Webhook erfolgreich verifiziert."
            });
          } else {
            return res.status(200).json({
              valid: false,
              service: "discord",
              error: `Discord Webhook antwortete mit HTTP ${pingRes.status}`,
              pingLatencyMs: latency
            });
          }
        }
        if (botToken) {
          const pingRes = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bot ${botToken}` }
          });
          const latency = Date.now() - startTime;
          const data = await pingRes.json().catch(() => null);
          if (pingRes.ok && data?.id) {
            return res.status(200).json({
              valid: true,
              service: "discord",
              botName: data.username,
              pingLatencyMs: latency,
              details: `Bot '${data.username}' erfolgreich via Discord API verifiziert.`
            });
          } else {
            return res.status(200).json({
              valid: false,
              service: "discord",
              error: data?.message || "Ung\xFCltiges Bot Token.",
              pingLatencyMs: latency
            });
          }
        }
        return res.status(200).json({
          valid: false,
          service: "discord",
          error: "Weder Webhook-URL noch Bot-Token angegeben."
        });
      }
      case "telegram": {
        const { botToken } = credentials;
        if (!botToken) {
          return res.status(200).json({
            valid: false,
            service: "telegram",
            error: "Telegram Bot Token fehlt."
          });
        }
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const latency = Date.now() - startTime;
        const data = await tgRes.json().catch(() => null);
        if (tgRes.ok && data?.ok) {
          return res.status(200).json({
            valid: true,
            service: "telegram",
            botName: data.result?.username,
            pingLatencyMs: latency,
            details: `Telegram Bot @${data.result?.username} aktiv & verifiziert.`
          });
        } else {
          return res.status(200).json({
            valid: false,
            service: "telegram",
            error: data?.description || "Ung\xFCltiges Telegram Bot Token.",
            pingLatencyMs: latency
          });
        }
      }
      case "twitch_helix": {
        const { clientId, clientSecret } = credentials;
        if (!clientId || !clientSecret) {
          return res.status(200).json({
            valid: false,
            service: "twitch_helix",
            error: "Twitch Client ID oder Client Secret fehlt."
          });
        }
        const helixRes = await fetch("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials"
          })
        });
        const latency = Date.now() - startTime;
        const data = await helixRes.json().catch(() => null);
        if (helixRes.ok && data?.access_token) {
          return res.status(200).json({
            valid: true,
            service: "twitch_helix",
            pingLatencyMs: latency,
            expiresInSec: data.expires_in,
            details: "Twitch Helix Client-Credentials erfolgreich autorisiert."
          });
        } else {
          return res.status(200).json({
            valid: false,
            service: "twitch_helix",
            error: data?.message || "Twitch Autorisierung fehlgeschlagen.",
            pingLatencyMs: latency
          });
        }
      }
      case "gemini": {
        const { apiKey } = credentials;
        if (!apiKey || typeof apiKey !== "string" || apiKey.length < 20) {
          return res.status(200).json({
            valid: false,
            service: "gemini",
            error: "Ung\xFCltiges Gemini API Key Format."
          });
        }
        const probeRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
        );
        const latency = Date.now() - startTime;
        if (probeRes.ok) {
          return res.status(200).json({
            valid: true,
            service: "gemini",
            pingLatencyMs: latency,
            details: "Google Gemini API Key erfolgreich verifiziert."
          });
        } else {
          const errData = await probeRes.json().catch(() => null);
          return res.status(200).json({
            valid: false,
            service: "gemini",
            error: errData?.error?.message || "Gemini API Key ung\xFCltig oder abgelaufen.",
            pingLatencyMs: latency
          });
        }
      }
      default:
        return res.status(400).json({
          valid: false,
          error: `Unbekannter Integrationstyp: ${type}`
        });
    }
  } catch (err) {
    return res.status(500).json({
      valid: false,
      error: `Validierungsfehler: ${err.message}`,
      pingLatencyMs: Date.now() - startTime
    });
  }
});
integrationsRouter.post("/encrypt-secret", verifyAuth, requireActiveSubscription, createRateLimiter(20, 6e4), async (req, res) => {
  try {
    const { plaintext } = req.body;
    if (!plaintext) {
      return res.status(400).json({ error: "Plaintext secret fehlt" });
    }
    const encrypted = await encryptSecret(plaintext);
    return res.json({
      success: true,
      encrypted
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Verschl\xFCsselung fehlgeschlagen" });
  }
});
export {
  integrationsRouter
};
