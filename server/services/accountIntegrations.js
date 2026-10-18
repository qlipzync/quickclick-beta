import { encryptSecret, decryptSecret } from "./kmsService.js";
const integrationDatabase = /* @__PURE__ */ new Map();
const userEventsDatabase = [];
function makeKey(userId, provider) {
  return `${userId}:${provider}`;
}
async function saveAccountIntegration(userId, provider, data) {
  if (!userId || !provider || !data.accessToken) {
    throw new Error("Ung\xFCltige Integrationsdaten: userId, provider und accessToken erforderlich.");
  }
  const existing = integrationDatabase.get(makeKey(userId, provider));
  const encryptedAccessToken = await encryptSecret(data.accessToken);
  const encryptedRefreshToken = data.refreshToken ? await encryptSecret(data.refreshToken) : existing?.encryptedRefreshToken;
  const now = Date.now();
  const tokenExpiresAt = data.expiresIn ? now + data.expiresIn * 1e3 : now + 3600 * 1e3;
  const record = {
    userId,
    provider,
    encryptedAccessToken,
    encryptedRefreshToken,
    tokenExpiresAt,
    scopes: data.scopes || existing?.scopes || [],
    accountUserId: data.accountUserId || existing?.accountUserId,
    accountUserName: data.accountUserName || existing?.accountUserName,
    accountEmail: data.accountEmail || existing?.accountEmail,
    profilePicture: data.profilePicture || existing?.profilePicture,
    spreadsheetId: data.spreadsheetId || existing?.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl || existing?.spreadsheetUrl,
    connectedAt: existing?.connectedAt || (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    metadata: { ...existing?.metadata, ...data.metadata }
  };
  integrationDatabase.set(makeKey(userId, provider), record);
  console.log(`\u{1F512} [Integrations] Verschl\xFCsselte Anmeldedaten f\xFCr ${provider} (User: ${userId}) gespeichert.`);
  return record;
}
function getAccountIntegration(userId, provider) {
  return integrationDatabase.get(makeKey(userId, provider));
}
function listAccountIntegrations(userId) {
  const providers = ["twitch", "google", "youtube", "meta", "discord"];
  return providers.map((p) => {
    const item = integrationDatabase.get(makeKey(userId, p));
    if (!item) {
      return {
        provider: p,
        connected: false
      };
    }
    return {
      provider: p,
      connected: true,
      accountUserId: item.accountUserId,
      accountUserName: item.accountUserName,
      accountEmail: item.accountEmail,
      profilePicture: item.profilePicture,
      spreadsheetId: item.spreadsheetId,
      spreadsheetUrl: item.spreadsheetUrl,
      scopes: item.scopes,
      connectedAt: item.connectedAt,
      updatedAt: item.updatedAt,
      expiresAt: new Date(item.tokenExpiresAt).toISOString()
    };
  });
}
function deleteAccountIntegration(userId, provider) {
  return integrationDatabase.delete(makeKey(userId, provider));
}
async function refreshTwitchToken(refreshToken, userId) {
  const clientId = process.env.TWITCH_CLIENT_ID || "afht5r000ofphuq2uh4aljljp0nivv";
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientSecret) {
    console.warn("[Twitch Refresh] TWITCH_CLIENT_SECRET fehlt. Verwende existierendes Token.");
    return { accessToken: refreshToken, expiresIn: 3600 };
  }
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.message || `Twitch Token-Refresh fehlgeschlagen (HTTP ${res.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600
  };
}
async function refreshGoogleToken(refreshToken, userId) {
  const clientId = process.env.GOOGLE_CLIENT_ID || "248792984033-91mcnb6d2qhl397nnou2fk6jp1d1dphn.apps.googleusercontent.com";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("[Google Refresh] GOOGLE_CLIENT_ID oder GOOGLE_CLIENT_SECRET fehlt.");
    return { accessToken: refreshToken, expiresIn: 3600 };
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Google Token-Refresh fehlgeschlagen (HTTP ${res.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || 3600
  };
}
async function getValidToken(userId, provider) {
  const record = integrationDatabase.get(makeKey(userId, provider));
  if (!record) {
    return { accessToken: "", valid: false, error: `Keine Verbindung f\xFCr Provider '${provider}' gefunden.` };
  }
  try {
    const now = Date.now();
    const isExpiringSoon = record.tokenExpiresAt - now < 60 * 1e3;
    if (!isExpiringSoon) {
      const decrypted = await decryptSecret(record.encryptedAccessToken);
      return { accessToken: decrypted, valid: true };
    }
    console.log(`\u{1F504} [Auth] Token f\xFCr '${provider}' (User: ${userId}) ist abgelaufen. Starte automatischen Refresh...`);
    if (!record.encryptedRefreshToken) {
      const fallbackToken = await decryptSecret(record.encryptedAccessToken);
      return {
        accessToken: fallbackToken,
        valid: true,
        error: "Kein Refresh-Token vorhanden; versuche bestehendes Token weiterzuverwenden."
      };
    }
    const decryptedRefreshToken = await decryptSecret(record.encryptedRefreshToken);
    let refreshResult;
    if (provider === "twitch") {
      refreshResult = await refreshTwitchToken(decryptedRefreshToken, userId);
    } else if (provider === "google" || provider === "youtube") {
      refreshResult = await refreshGoogleToken(decryptedRefreshToken, userId);
    } else {
      refreshResult = { accessToken: decryptedRefreshToken, expiresIn: 3600 };
    }
    await saveAccountIntegration(userId, provider, {
      accessToken: refreshResult.accessToken,
      refreshToken: refreshResult.refreshToken || decryptedRefreshToken,
      expiresIn: refreshResult.expiresIn,
      scopes: record.scopes,
      accountUserId: record.accountUserId,
      accountUserName: record.accountUserName,
      accountEmail: record.accountEmail,
      profilePicture: record.profilePicture,
      spreadsheetId: record.spreadsheetId,
      spreadsheetUrl: record.spreadsheetUrl
    });
    console.log(`\u2705 [Auth] Token f\xFCr '${provider}' (User: ${userId}) erfolgreich automatisch erneuert.`);
    return { accessToken: refreshResult.accessToken, valid: true };
  } catch (err) {
    console.error(`\u274C [Auth] Fehler beim Abrufen/Erneuern des Tokens f\xFCr '${provider}':`, err);
    return { accessToken: "", valid: false, error: err.message || "Token ung\xFCltig" };
  }
}
function recordUserWebhookEvent(userId, provider, eventType, eventData) {
  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    provider,
    eventType,
    eventData,
    receivedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  userEventsDatabase.unshift(event);
  if (userEventsDatabase.length > 500) {
    userEventsDatabase.pop();
  }
  return event;
}
function getUserWebhookEvents(userId, limit = 50) {
  if (!userId) return userEventsDatabase.slice(0, limit);
  return userEventsDatabase.filter((e) => e.userId === userId || e.userId === "global").slice(0, limit);
}
export {
  deleteAccountIntegration,
  getAccountIntegration,
  getUserWebhookEvents,
  getValidToken,
  listAccountIntegrations,
  recordUserWebhookEvent,
  saveAccountIntegration
};
