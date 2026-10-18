import { Router } from "express";
import crypto from "crypto";
import { getFirestore } from "firebase-admin/firestore";
import { createRateLimiter, verifyTotpRFC6238 } from "../index.js";
import {
  saveAccountIntegration,
  listAccountIntegrations,
  deleteAccountIntegration,
  getUserWebhookEvents
} from "../services/accountIntegrations.js";
import { duplicateTemplateSheetForUser } from "../services/googleWorkspaceService.js";
import { fetchTwitchChannelLiveDetails } from "../services/twitchEventSubService.js";
import {
  verifyAuth,
  requireActiveSubscription,
  isMasterAdmin,
  isTitanLifetime,
  syncVipAndAdminStatus
} from "../middleware/authMiddleware.js";
const authOAuthRouter = Router();
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91";
const db = getFirestore(FIRESTORE_DB_ID);
const oauthStateStore = /* @__PURE__ */ new Map();
function cleanOldStates() {
  const cutoff = Date.now() - 15 * 60 * 1e3;
  for (const [k, v] of oauthStateStore.entries()) {
    if (v.createdAt < cutoff) oauthStateStore.delete(k);
  }
}
authOAuthRouter.get(["/:provider/connect", "/connect/:provider"], async (req, res) => {
  cleanOldStates();
  const rawProvider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
  const provider = (rawProvider || "").toLowerCase();
  const userId = req.query.userId || req.headers["x-user-id"];
  const userEmail = req.query.userEmail || "";
  const userName = req.query.userName || "Streamer";
  const returnTo = req.query.returnTo || "/";
  const redirectMode = req.query.mode === "json";
  if (!userId) {
    return res.status(401).json({ error: "Benutzer-ID erforderlich" });
  }
  const userDoc = await db.collection("users").doc(userId).get();
  const userData = userDoc.data();
  const effectiveEmail = (userEmail || userData?.email || "").trim().toLowerCase();
  const isAdmin = isMasterAdmin(effectiveEmail);
  const isTitan = isTitanLifetime(effectiveEmail);
  const hasActiveSub = Boolean(userData?.hasActiveSubscription && userData?.subscriptionStatus === "active");
  if (!isAdmin && !hasActiveSub) {
    const errorMsg = isTitan ? "Zugriff gesperrt: Als Titan-VIP musst du zuerst das 0,00 \u20AC Stripe Lifetime Setup durchlaufen, um die Kanalverkn\xFCpfung freizuschalten." : "Zugriff gesperrt: Du musst zuerst ein aktives Abonnement \xFCber Stripe abschlie\xDFen, bevor du Kan\xE4le verbinden kannst.";
    if (redirectMode) {
      return res.status(402).json({ success: false, error: errorMsg, code: "PAYMENT_REQUIRED" });
    }
    return res.redirect(`/?error=subscription_required&message=${encodeURIComponent(errorMsg)}`);
  }
  const state = crypto.randomBytes(24).toString("hex");
  oauthStateStore.set(state, {
    state,
    userId,
    userEmail: effectiveEmail,
    userName,
    provider,
    returnTo,
    createdAt: Date.now()
  });
  const appBaseUrl = process.env.APP_BASE_URL || `({req.protocol}://){req.get('host')}`;
  let authUrl = "";
  switch (provider) {
    case "twitch": {
      const clientId = process.env.TWITCH_CLIENT_ID || "afht5r000ofphuq2uh4aljljp0nivv";
      const redirectUri = `${appBaseUrl}/api/auth/twitch/callback`;
      const scopes = ["user:read:email", "channel:read:subscriptions", "bits:read"].join(" ");
      authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${encodeURIComponent(
        clientId
      )}&redirect_uri=({encodeURIComponent(redirectUri)}&response_type=code&scope=){encodeURIComponent(
        scopes
      )}&state=${state}&force_verify=true`;
      break;
    }
    case "google": {
      const clientId = process.env.GOOGLE_CLIENT_ID || "248792984033-91mcnb6d2qhl397nnou2fk6jp1d1dphn.apps.googleusercontent.com";
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${appBaseUrl}/api/auth/google/callback`;
      const scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.file",
        "email",
        "profile"
      ].join(" ");
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        clientId
      )}&redirect_uri=({encodeURIComponent(redirectUri)}&response_type=code&scope=){encodeURIComponent(
        scopes
      )}&access_type=offline&prompt=consent&state=${state}`;
      break;
    }
    case "youtube": {
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || "";
      const redirectUri = `${appBaseUrl}/api/auth/youtube/callback`;
      const scopes = [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
        "email",
        "profile"
      ].join(" ");
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        clientId
      )}&redirect_uri=({encodeURIComponent(redirectUri)}&response_type=code&scope=){encodeURIComponent(
        scopes
      )}&access_type=offline&prompt=consent&state=${state}`;
      break;
    }
    case "meta": {
      const appId = process.env.META_APP_ID;
      if (!appId) {
        const errMsg = "ERROR: META_APP_ID fehlt zwingend. Ausf\xFChrung abgebrochen. Bitte den echten Wert bereitstellen.";
        if (redirectMode) return res.status(400).json({ error: errMsg });
        return res.redirect(`/?error=missing_config&message=${encodeURIComponent(errMsg)}`);
      }
      const redirectUri = `${appBaseUrl}/api/auth/meta/callback`;
      const scopes = ["public_profile", "instagram_basic", "instagram_content_publish"].join(",");
      authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${encodeURIComponent(
        appId
      )}&redirect_uri=({encodeURIComponent(redirectUri)}&scope=){encodeURIComponent(scopes)}&state=${state}`;
      break;
    }
    default:
      return res.status(400).json({ error: `Nicht unterst\xFCtzter OAuth-Provider: ${provider}` });
  }
  if (redirectMode) {
    return res.json({ success: true, authUrl, state, provider });
  }
  return res.redirect(authUrl);
});
authOAuthRouter.all(["/:provider/callback", "/callback/:provider"], async (req, res) => {
  const rawProvider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
  const provider = (rawProvider || "").toLowerCase();
  const code = req.query.code || req.body?.code;
  const state = req.query.state || req.body?.state;
  const errorParam = req.query.error || req.query.error_description || req.body?.error;
  if (errorParam) {
    return renderCallbackHtml(res, { success: false, provider, error: errorParam });
  }
  const stateRecord = state ? oauthStateStore.get(state) : void 0;
  if (!state || !stateRecord || !stateRecord.userId) {
    return renderCallbackHtml(res, {
      success: false,
      provider,
      error: "Ung\xFCltiger oder abgelaufener OAuth-State-Parameter (CSRF-Schutz aktiv). Bitte erneut \xFCber das Dashboard verbinden."
    });
  }
  const userId = stateRecord.userId;
  const userName = stateRecord.userName || "Streamer";
  const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
  oauthStateStore.delete(state);
  try {
    let accessToken = "";
    let refreshToken;
    let expiresIn = 3600;
    let accountUserId;
    let accountUserName;
    let accountEmail;
    let profilePicture;
    let scopes = [];
    if (provider === "twitch") {
      const clientId = process.env.TWITCH_CLIENT_ID || "afht5r000ofphuq2uh4aljljp0nivv";
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      const redirectUri = `${appBaseUrl}/api/auth/twitch/callback`;
      if (clientSecret) {
        const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri
          })
        });
        const tokenData = await tokenRes.json();
        if (tokenRes.ok && tokenData.access_token) {
          accessToken = tokenData.access_token;
          refreshToken = tokenData.refresh_token;
          expiresIn = tokenData.expires_in || 3600;
          scopes = tokenData.scope || ["user:read:email"];
        }
      }
      if (!accessToken) {
        if (code.startsWith("oauth:")) {
          accessToken = code;
        } else {
          throw new Error("ERROR: Twitch Access Token konnte nicht abgerufen werden. Bitte TWITCH_CLIENT_SECRET pr\xFCfen.");
        }
      }
      try {
        const userRes = await fetch("https://api.twitch.tv/helix/users", {
          headers: { "Client-Id": clientId, Authorization: `Bearer ${accessToken}` }
        });
        if (userRes.ok) {
          const uData = await userRes.json();
          if (uData.data?.length > 0) {
            accountUserId = uData.data[0].id;
            accountUserName = uData.data[0].login;
            accountEmail = uData.data[0].email;
            profilePicture = uData.data[0].profile_image_url;
          }
        }
      } catch {
        accountUserName = userName;
      }
    } else if (provider === "google" || provider === "youtube") {
      const clientId = process.env.GOOGLE_CLIENT_ID || "248792984033-91mcnb6d2qhl397nnou2fk6jp1d1dphn.apps.googleusercontent.com";
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `({appBaseUrl}/api/auth/){provider}/callback`;
      if (clientId && clientSecret) {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code"
          })
        });
        const tokenData = await tokenRes.json();
        if (tokenRes.ok && tokenData.access_token) {
          accessToken = tokenData.access_token;
          refreshToken = tokenData.refresh_token;
          expiresIn = tokenData.expires_in || 3600;
          scopes = (tokenData.scope || "").split(" ");
        }
      }
      if (!accessToken) {
        throw new Error("ERROR: Google OAuth Token konnte nicht abgerufen werden. Bitte GOOGLE_CLIENT_SECRET pr\xFCfen.");
      }
      try {
        const profRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (profRes.ok) {
          const profData = await profRes.json();
          accountUserId = profData.sub;
          accountEmail = profData.email;
          accountUserName = profData.name || profData.given_name;
          profilePicture = profData.picture;
        }
      } catch {
        accountUserName = userName;
      }
    } else if (provider === "meta") {
      const metaAppId = process.env.META_APP_ID;
      const metaAppSecret = process.env.META_APP_SECRET;
      if (!metaAppId || !metaAppSecret) {
        throw new Error("ERROR: META_APP_SECRET fehlt zwingend. Ausf\xFChrung abgebrochen. Bitte den echten Wert bereitstellen.");
      }
      const redirectUri = `${appBaseUrl}/api/auth/meta/callback`;
      const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${metaAppSecret}&code=${encodeURIComponent(code)}`;
      const metaRes = await fetch(tokenUrl);
      const metaData = await metaRes.json();
      if (!metaRes.ok || !metaData.access_token) {
        throw new Error(`ERROR: Meta OAuth Token Exchange fehlgeschlagen: ${metaData.error?.message || "Unbekannt"}`);
      }
      accessToken = metaData.access_token;
      expiresIn = metaData.expires_in || 5184e3;
      accountUserName = `${userName}.ig`;
    }
    await saveAccountIntegration(userId, provider, {
      accessToken,
      refreshToken,
      expiresIn,
      scopes,
      accountUserId,
      accountUserName: accountUserName || userName,
      accountEmail,
      profilePicture
    });
    const emailToCheck = accountEmail || stateRecord?.userEmail;
    await syncVipAndAdminStatus(userId, emailToCheck);
    let duplicatedSheetInfo = {};
    if (provider === "google") {
      const dupResult = await duplicateTemplateSheetForUser(userId, userName);
      if (dupResult.success) {
        duplicatedSheetInfo = {
          spreadsheetId: dupResult.spreadsheetId,
          spreadsheetUrl: dupResult.spreadsheetUrl
        };
      }
    }
    return renderCallbackHtml(res, {
      success: true,
      provider,
      userId,
      accountUserName: accountUserName || userName,
      spreadsheetId: duplicatedSheetInfo.spreadsheetId,
      spreadsheetUrl: duplicatedSheetInfo.spreadsheetUrl
    });
  } catch (err) {
    return renderCallbackHtml(res, { success: false, provider, error: err.message });
  }
});
authOAuthRouter.get("/integrations/status", verifyAuth, async (req, res) => {
  const userId = req.user.uid;
  const integrations = listAccountIntegrations(userId);
  const enriched = await Promise.all(
    integrations.map(async (item) => {
      if (item.provider === "twitch" && item.connected) {
        const liveInfo = await fetchTwitchChannelLiveDetails(item.accountUserName || "streamer", userId);
        return { ...item, liveDetails: liveInfo };
      }
      return item;
    })
  );
  return res.json({ userId, integrations: enriched, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
authOAuthRouter.delete("/:provider/disconnect", verifyAuth, requireActiveSubscription, (req, res) => {
  const rawProvider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
  const provider = (rawProvider || "").toLowerCase();
  const userId = req.user.uid;
  const deleted = deleteAccountIntegration(userId, provider);
  return res.json({ success: deleted, provider, userId });
});
authOAuthRouter.get("/events", verifyAuth, (req, res) => {
  const userId = req.user.uid;
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const events = getUserWebhookEvents(userId, limit);
  return res.json({ success: true, events, count: events.length });
});
authOAuthRouter.post("/2fa/generate", verifyAuth, async (req, res) => {
  const userId = req.user.uid;
  const { channelName } = req.body || {};
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  for (let i = 0; i < 20; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  const backupCodes = Array.from(
    { length: 8 },
    () => `${crypto.randomBytes(2).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`
  );
  await db.collection("users").doc(userId).collection("security").doc("totp_2fa").set(
    {
      userId,
      secretKey: secret,
      backupCodes,
      verified: false,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    },
    { merge: true }
  );
  const label = channelName || req.user.email || userId;
  const otpAuthUrl = `otpauth://totp/QuickClick:${encodeURIComponent(label)}?secret=${secret}&issuer=QuickClick&algorithm=SHA1&digits=6&period=30`;
  res.json({
    secretKey: secret,
    otpAuthUrl,
    backupCodes
  });
});
authOAuthRouter.post("/2fa/verify", verifyAuth, createRateLimiter(15, 9e5), async (req, res) => {
  const userId = req.user.uid;
  const { code, secret: bodySecret, backupCodes: bodyBackupCodes } = req.body || {};
  const clean = String(code || "").trim();
  const secDoc = await db.collection("users").doc(userId).collection("security").doc("totp_2fa").get();
  const storedData = secDoc.data();
  const effectiveSecret = storedData?.secretKey || bodySecret;
  const effectiveBackupCodes = Array.isArray(storedData?.backupCodes) ? storedData.backupCodes : Array.isArray(bodyBackupCodes) ? bodyBackupCodes : [];
  const isBackup = effectiveBackupCodes.includes(clean);
  const isTotpValid = effectiveSecret ? verifyTotpRFC6238(clean, effectiveSecret) : false;
  if (!isTotpValid && !isBackup) {
    return res.status(401).json({
      verified: false,
      error: "Ung\xFCltiger Authentifizierungscode oder Zeitfenster abgelaufen."
    });
  }
  await db.collection("users").doc(userId).collection("security").doc("totp_2fa").set(
    {
      verified: true,
      verifiedAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...isBackup ? { backupCodes: effectiveBackupCodes.filter((c) => c !== clean) } : {}
    },
    { merge: true }
  );
  res.json({
    verified: true,
    isBackupCode: isBackup,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
function renderCallbackHtml(res, data) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const payloadJson = JSON.stringify(data);
  return res.send(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth Autorisierung - QuickClick</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #09090b;
      color: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 16px;
      padding: 32px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin-bottom: 20px;
    }
    .icon.success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #10b981;
    }
    .icon.error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #ef4444;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 20px;
      font-weight: 700;
    }
    p {
      color: #a1a1aa;
      font-size: 14px;
      line-height: 1.5;
      margin: 0 0 20px;
    }
    .btn {
      background: #6366f1;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
    }
    .btn:hover {
      background: #4f46e5;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${data.success ? "success" : "error"}">
      ${data.success ? "\u2713" : "\u2715"}
    </div>
    <h2>${data.success ? "Autorisierung erfolgreich!" : "Autorisierungsfehler"}</h2>
    <p>
      ${data.success ? `Das Konto f\xFCr <strong>${data.provider || "den Dienst"}</strong> wurde erfolgreich verkn\xFCpft. Dieses Fenster schlie\xDFt sich automatisch.` : `Fehler beim Verbinden: ${data.error || "Unbekannter Fehler"}`}
    </p>
    <button class="btn" onclick="window.close()">Fenster schlie\xDFen</button>
  </div>

  <script>
    const payload = ${payloadJson};
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'oauth_callback', ...payload }, '*');
        window.opener.postMessage({ type: 'TWITCH_OAUTH_SUCCESS', ...payload }, '*');
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'oauth_callback', ...payload }, '*');
      }
      localStorage.setItem('quickclick_oauth_event', JSON.stringify({ ...payload, timestamp: Date.now() }));
    } catch (e) {
      console.error('Failed to dispatch OAuth postMessage:', e);
    }
    setTimeout(() => {
      try { window.close(); } catch (e) {}
    }, 2000);
  </script>
</body>
</html>`);
}
export {
  authOAuthRouter
};
