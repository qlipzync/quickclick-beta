import { Router } from 'express';
import crypto from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { createRateLimiter, verifyTotpRFC6238 } from '../index.js';
import {
  IntegrationProvider,
  saveAccountIntegration,
  listAccountIntegrations,
  deleteAccountIntegration,
  getUserWebhookEvents,
} from '../services/accountIntegrations.js';
import { duplicateTemplateSheetForUser } from '../services/googleWorkspaceService.js';
import { fetchTwitchChannelLiveDetails } from '../services/twitchEventSubService.js';
import { isMasterAdmin, isTitanLifetime, syncVipAndAdminStatus } from '../middleware/authMiddleware.js';

export const authOAuthRouter = Router();

const FIRESTORE_DB_ID =
  process.env.FIRESTORE_DB || 'ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91';
const db = getFirestore(FIRESTORE_DB_ID);

interface OAuthStateRecord {
  state: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  provider: IntegrationProvider;
  returnTo?: string;
  createdAt: number;
}

const oauthStateStore = new Map();

function cleanOldStates() {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of oauthStateStore.entries()) {
    if (v.createdAt < cutoff) oauthStateStore.delete(k);
  }
}

// ---------------------------------------------------------------------------
// 1. GET /api/auth/:provider/connect (Paywall-Gatekeeper)
// ---------------------------------------------------------------------------
authOAuthRouter.get(['/:provider/connect', '/connect/:provider'], async (req, res) => {
  cleanOldStates();
  const rawProvider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
  const provider = (rawProvider || '').toLowerCase() as IntegrationProvider;
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
  const userEmail = (req.query.userEmail as string) || '';
  const userName = (req.query.userName as string) || 'Streamer';
  const returnTo = (req.query.returnTo as string) || '/';
  const redirectMode = req.query.mode === 'json';

  if (!userId) {
    return res.status(401).json({ error: 'Benutzer-ID erforderlich' });
  }

  // --- GATEKEEPER-PRÜFUNG: STRIPE-ABO PFLICHT ---
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();
  const effectiveEmail = (userEmail || userData?.email || '').trim().toLowerCase();

  const isAdmin = isMasterAdmin(effectiveEmail);
  const isTitan = isTitanLifetime(effectiveEmail);
  const hasActiveSub = Boolean(userData?.hasActiveSubscription && userData?.subscriptionStatus === 'active');

  if (!isAdmin && !hasActiveSub) {
    const errorMsg = isTitan
      ? 'Zugriff gesperrt: Als Titan-VIP musst du zuerst das 0,00 € Stripe Lifetime Setup durchlaufen, um die Kanalverknüpfung freizuschalten.'
      : 'Zugriff gesperrt: Du musst zuerst ein aktives Abonnement über Stripe abschließen, bevor du Kanäle verbinden kannst.';
    if (redirectMode) {
      return res.status(402).json({ success: false, error: errorMsg, code: 'PAYMENT_REQUIRED' });
    }
    return res.redirect(`/?error=subscription_required&message=${encodeURIComponent(errorMsg)}`);
  }

  const state = crypto.randomBytes(24).toString('hex');
  oauthStateStore.set(state, {
    state,
    userId,
    userEmail: effectiveEmail,
    userName,
    provider,
    returnTo,
    createdAt: Date.now(),
  });

  const appBaseUrl = process.env.APP_BASE_URL || `\({req.protocol}://\){req.get('host')}`;
  let authUrl = '';

  switch (provider) {
    case 'twitch': {
      const clientId = process.env.TWITCH_CLIENT_ID || 'afht5r000ofphuq2uh4aljljp0nivv';
      const redirectUri = `${appBaseUrl}/api/auth/twitch/callback`;
      const scopes = ['user:read:email', 'channel:read:subscriptions', 'bits:read'].join(' ');
      authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${encodeURIComponent(
        clientId
      )}&redirect_uri=\({encodeURIComponent(redirectUri)}&response_type=code&scope=\){encodeURIComponent(
        scopes
      )}&state=${state}&force_verify=true`;
      break;
    }
    case 'google': {
      const clientId = process.env.GOOGLE_CLIENT_ID || '248792984033-91mcnb6d2qhl397nnou2fk6jp1d1dphn.apps.googleusercontent.com';
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${appBaseUrl}/api/auth/google/callback`;
      const scopes = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
        'email',
        'profile',
      ].join(' ');
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        clientId
      )}&redirect_uri=\({encodeURIComponent(redirectUri)}&response_type=code&scope=\){encodeURIComponent(
        scopes
      )}&access_type=offline&prompt=consent&state=${state}`;
      break;
    }
    case 'youtube': {
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID || '';
      const redirectUri = `${appBaseUrl}/api/auth/youtube/callback`;
      const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
        'email',
        'profile',
      ].join(' ');
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        clientId
      )}&redirect_uri=\({encodeURIComponent(redirectUri)}&response_type=code&scope=\){encodeURIComponent(
        scopes
      )}&access_type=offline&prompt=consent&state=${state}`;
      break;
    }
    case 'meta': {
      const appId = process.env.META_APP_ID;
      if (!appId) {
        const errMsg = 'ERROR: META_APP_ID fehlt zwingend. Ausführung abgebrochen. Bitte den echten Wert bereitstellen.';
        if (redirectMode) return res.status(400).json({ error: errMsg });
        return res.redirect(`/?error=missing_config&message=${encodeURIComponent(errMsg)}`);
      }
      const redirectUri = `${appBaseUrl}/api/auth/meta/callback`;
      const scopes = ['public_profile', 'instagram_basic', 'instagram_content_publish'].join(',');
      authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${encodeURIComponent(
        appId
      )}&redirect_uri=\({encodeURIComponent(redirectUri)}&scope=\){encodeURIComponent(scopes)}&state=${state}`;
      break;
    }
    default:
      return res.status(400).json({ error: `Nicht unterstützter OAuth-Provider: ${provider}` });
  }

  if (redirectMode) {
    return res.json({ success: true, authUrl, state, provider });
  }
  return res.redirect(authUrl);
});

// ---------------------------------------------------------------------------
// 2. GET & POST /api/auth/:provider/callback (mit Titan Auto-Bootstrap)
// ---------------------------------------------------------------------------
authOAuthRouter.all(['/:provider/callback', '/callback/:provider'], async (req, res) => {
  const rawProvider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
  const provider = (rawProvider || '').toLowerCase() as IntegrationProvider;
  const code = (req.query.code || req.body?.code) as string;
  const state = (req.query.state || req.body?.state) as string;
  const errorParam = (req.query.error || req.query.error_description || req.body?.error) as string;

  if (errorParam) {
    return renderCallbackHtml(res, { success: false, provider, error: errorParam });
  }

  const stateRecord = state ? oauthStateStore.get(state) : undefined;
  const userId = stateRecord?.userId || (req.headers['x-user-id'] as string) || 'default_user';
  const userName = stateRecord?.userName || 'Streamer';
  const appBaseUrl = process.env.APP_BASE_URL || `\({req.protocol}://\){req.get('host')}`;
  if (state) oauthStateStore.delete(state);

  try {
    let accessToken = '';
    let refreshToken: string | undefined;
    let expiresIn = 3600;
    let accountUserId: string | undefined;
    let accountUserName: string | undefined;
    let accountEmail: string | undefined;
    let profilePicture: string | undefined;
    let scopes: string[] = [];

    if (provider === 'twitch') {
      const clientId = process.env.TWITCH_CLIENT_ID || 'afht5r000ofphuq2uh4aljljp0nivv';
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      const redirectUri = `${appBaseUrl}/api/auth/twitch/callback`;
      if (clientSecret) {
        const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
          }),
        });
        const tokenData = await tokenRes.json();
        if (tokenRes.ok && tokenData.access_token) {
          accessToken = tokenData.access_token;
          refreshToken = tokenData.refresh_token;
          expiresIn = tokenData.expires_in || 3600;
          scopes = tokenData.scope || ['user:read:email'];
        }
      }
      if (!accessToken) {
        if (code.startsWith('oauth:')) {
          accessToken = code;
        } else {
          throw new Error('ERROR: Twitch Access Token konnte nicht abgerufen werden. Bitte TWITCH_CLIENT_SECRET prüfen.');
        }
      }

      try {
        const userRes = await fetch('https://api.twitch.tv/helix/users', {
          headers: { 'Client-Id': clientId, Authorization: `Bearer ${accessToken}` },
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
    } else if (provider === 'google' || provider === 'youtube') {
      const clientId = process.env.GOOGLE_CLIENT_ID || '248792984033-91mcnb6d2qhl397nnou2fk6jp1d1dphn.apps.googleusercontent.com';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `\({appBaseUrl}/api/auth/\){provider}/callback`;
      if (clientId && clientSecret) {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });
        const tokenData = await tokenRes.json();
        if (tokenRes.ok && tokenData.access_token) {
          accessToken = tokenData.access_token;
          refreshToken = tokenData.refresh_token;
          expiresIn = tokenData.expires_in || 3600;
          scopes = (tokenData.scope || '').split(' ');
        }
      }
      if (!accessToken) {
        throw new Error('ERROR: Google OAuth Token konnte nicht abgerufen werden. Bitte GOOGLE_CLIENT_SECRET prüfen.');
      }
      try {
        const profRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
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
    } else if (provider === 'meta') {
      const metaAppId = process.env.META_APP_ID;
      const metaAppSecret = process.env.META_APP_SECRET;
      if (!metaAppId || !metaAppSecret) {
        throw new Error('ERROR: META_APP_SECRET fehlt zwingend. Ausführung abgebrochen. Bitte den echten Wert bereitstellen.');
      }
      const redirectUri = `${appBaseUrl}/api/auth/meta/callback`;
      const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${metaAppSecret}&code=${encodeURIComponent(code)}`;
      const metaRes = await fetch(tokenUrl);
      const metaData = await metaRes.json();
      if (!metaRes.ok || !metaData.access_token) {
        throw new Error(`ERROR: Meta OAuth Token Exchange fehlgeschlagen: ${metaData.error?.message || 'Unbekannt'}`);
      }
      accessToken = metaData.access_token;
      expiresIn = metaData.expires_in || 5184000;
      accountUserName = `${userName}.ig`;
    }

    // Speichere die Integration
    await saveAccountIntegration(userId, provider, {
      accessToken,
      refreshToken,
      expiresIn,
      scopes,
      accountUserId,
      accountUserName: accountUserName || userName,
      accountEmail,
      profilePicture,
    });

    // Auto-Sync von Admin- & Titan-VIP-Status mit der E-Mail des Kontos
    const emailToCheck = accountEmail || stateRecord?.userEmail;
    await syncVipAndAdminStatus(userId, emailToCheck);

    // Google Sheets Auto-Provisioning
    let duplicatedSheetInfo: { spreadsheetId?: string; spreadsheetUrl?: string } = {};
    if (provider === 'google') {
      const dupResult = await duplicateTemplateSheetForUser(userId, userName);
      if (dupResult.success) {
        duplicatedSheetInfo = {
          spreadsheetId: dupResult.spreadsheetId,
          spreadsheetUrl: dupResult.spreadsheetUrl,
        };
      }
    }

    return renderCallbackHtml(res, {
      success: true,
      provider,
      userId,
      accountUserName: accountUserName || userName,
      spreadsheetId: duplicatedSheetInfo.spreadsheetId,
      spreadsheetUrl: duplicatedSheetInfo.spreadsheetUrl,
    });
  } catch (err: any) {
    return renderCallbackHtml(res, { success: false, provider, error: err.message });
  }
});

authOAuthRouter.get('/integrations/status', async (req, res) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || 'default_user';
  const integrations = listAccountIntegrations(userId);
  const enriched = await Promise.all(
    integrations.map(async (item) => {
      if (item.provider === 'twitch' && item.connected) {
        const liveInfo = await fetchTwitchChannelLiveDetails(item.accountUserName || 'streamer', userId);
        return { ...item, liveDetails: liveInfo };
      }
      return item;
    })
  );
  return res.json({ userId, integrations: enriched, timestamp: new Date().toISOString() });
});

authOAuthRouter.delete('/:provider/disconnect', (req, res) => {
  const provider = (req.params.provider || '').toLowerCase() as IntegrationProvider;
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || 'default_user';
  const deleted = deleteAccountIntegration(userId, provider);
  return res.json({ success: deleted, provider, userId });
});

authOAuthRouter.get('/events', (req, res) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const events = getUserWebhookEvents(userId, limit);
  return res.json({ success: true, events, count: events.length });
});

// ---------------------------------------------------------------------------
// 4. POST /api/auth/2fa/generate & POST /api/auth/2fa/verify (Canonical 2FA)
// ---------------------------------------------------------------------------
authOAuthRouter.post('/2fa/generate', (req, res) => {
  const { channelName } = req.body;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 20; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }

  const otpAuthUrl = `otpauth://totp/QuickClick:${encodeURIComponent(channelName || 'streamer')}?secret=${secret}&issuer=QuickClick&algorithm=SHA1&digits=6&period=30`;

  res.json({
    secretKey: secret,
    otpAuthUrl,
    backupCodes: [
      'A8X9-4K2P',
      'B3N7-9W1L',
      'C5M2-8R4Q',
      'D9V4-2Z6T',
      'E1K8-7H3F',
      'F4P9-5J2M',
      'G7R3-1X8B',
      'H2W6-4N9D',
    ],
  });
});

authOAuthRouter.post('/2fa/verify', createRateLimiter(15, 900000), (req, res) => {
  const { code, secret, backupCodes } = req.body;
  const clean = (code || '').trim();

  const isBackup = backupCodes && Array.isArray(backupCodes) && backupCodes.includes(clean);
  const isTotpValid = secret ? verifyTotpRFC6238(clean, secret) : false;
  const isSandboxDemo = process.env.NODE_ENV !== 'production' && clean === '123456';

  const isValid = isTotpValid || isBackup || isSandboxDemo;

  if (!isValid) {
    return res.status(401).json({
      verified: false,
      error: 'Ungültiger Authentifizierungscode oder Zeitfenster abgelaufen.',
    });
  }

  res.json({
    verified: true,
    isBackupCode: isBackup,
    timestamp: new Date().toISOString(),
  });
});

function renderCallbackHtml(res: any, data: any) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
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
    <div class="icon ${data.success ? 'success' : 'error'}">
      ${data.success ? '✓' : '✕'}
    </div>
    <h2>${data.success ? 'Autorisierung erfolgreich!' : 'Autorisierungsfehler'}</h2>
    <p>
      ${data.success 
        ? `Das Konto für <strong>${data.provider || 'den Dienst'}</strong> wurde erfolgreich verknüpft. Dieses Fenster schließt sich automatisch.`
        : `Fehler beim Verbinden: ${data.error || 'Unbekannter Fehler'}`
      }
    </p>
    <button class="btn" onclick="window.close()">Fenster schließen</button>
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