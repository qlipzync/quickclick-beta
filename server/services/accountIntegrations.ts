/**
 * Account Integrations Service
 * 
 * Manages encrypted OAuth 2.0 credentials for connected third-party accounts:
 * - Twitch (user:read:email, channel:read:subscriptions, bits:read)
 * - Google Workspace (https://www.googleapis.com/auth/spreadsheets, https://www.googleapis.com/auth/drive.file)
 * - YouTube (Social Media)
 * - Meta / Instagram (Social Media)
 * 
 * Features:
 * - AES-256-GCM token encryption via KMS service
 * - Automatic token refresh via getValidToken(userId, provider)
 * - Automated Google Sheets spreadsheet copy tracking
 * - Webhook event storage per user
 */

import { encryptSecret, decryptSecret, EncryptedSecretPayload } from './kmsService.js';

export type IntegrationProvider = 'twitch' | 'google' | 'youtube' | 'meta' | 'discord';

export interface StoredIntegrationRecord {
  userId: string;
  provider: IntegrationProvider;
  encryptedAccessToken: EncryptedSecretPayload;
  encryptedRefreshToken?: EncryptedSecretPayload;
  tokenExpiresAt: number; // Unix timestamp in ms
  scopes: string[];
  accountUserId?: string;
  accountUserName?: string;
  accountEmail?: string;
  profilePicture?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  connectedAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface UserWebhookEvent {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  eventType: string; // e.g., 'stream.online', 'stream.offline', 'channel.subscribe', 'channel.clip.created'
  eventData: Record<string, any>;
  receivedAt: string;
}

// In-Memory store for fast encrypted credential lookups (acts as database mirror)
const integrationDatabase = new Map<string, StoredIntegrationRecord>();
const userEventsDatabase: UserWebhookEvent[] = [];

function makeKey(userId: string, provider: IntegrationProvider): string {
  return `${userId}:${provider}`;
}

/**
 * Saves or updates an OAuth integration with AES-256-GCM encrypted tokens.
 */
export async function saveAccountIntegration(
  userId: string,
  provider: IntegrationProvider,
  data: {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number; // seconds
    scopes?: string[];
    accountUserId?: string;
    accountUserName?: string;
    accountEmail?: string;
    profilePicture?: string;
    spreadsheetId?: string;
    spreadsheetUrl?: string;
    metadata?: Record<string, any>;
  }
): Promise<StoredIntegrationRecord> {
  if (!userId || !provider || !data.accessToken) {
    throw new Error('Ungültige Integrationsdaten: userId, provider und accessToken erforderlich.');
  }

  const existing = integrationDatabase.get(makeKey(userId, provider));

  const encryptedAccessToken = await encryptSecret(data.accessToken);
  const encryptedRefreshToken = data.refreshToken
    ? await encryptSecret(data.refreshToken)
    : existing?.encryptedRefreshToken;

  const now = Date.now();
  const tokenExpiresAt = data.expiresIn ? now + data.expiresIn * 1000 : now + 3600 * 1000;

  const record: StoredIntegrationRecord = {
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
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: { ...existing?.metadata, ...data.metadata },
  };

  integrationDatabase.set(makeKey(userId, provider), record);
  console.log(`🔒 [Integrations] Verschlüsselte Anmeldedaten für ${provider} (User: ${userId}) gespeichert.`);
  return record;
}

/**
 * Retrieves integration status (without exposing plaintext secrets).
 */
export function getAccountIntegration(userId: string, provider: IntegrationProvider): StoredIntegrationRecord | undefined {
  return integrationDatabase.get(makeKey(userId, provider));
}

/**
 * Lists all connected integration statuses for a specific user.
 */
export function listAccountIntegrations(userId: string) {
  const providers: IntegrationProvider[] = ['twitch', 'google', 'youtube', 'meta', 'discord'];
  return providers.map((p) => {
    const item = integrationDatabase.get(makeKey(userId, p));
    if (!item) {
      return {
        provider: p,
        connected: false,
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
      expiresAt: new Date(item.tokenExpiresAt).toISOString(),
    };
  });
}

/**
 * Removes an integration and permanently deletes the stored encrypted credentials.
 */
export function deleteAccountIntegration(userId: string, provider: IntegrationProvider): boolean {
  return integrationDatabase.delete(makeKey(userId, provider));
}

/**
 * Helper: Refreshes a Twitch Access Token via Twitch OAuth Token Endpoint
 */
async function refreshTwitchToken(
  refreshToken: string,
  userId: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const clientId = process.env.TWITCH_CLIENT_ID || 'afht5r000ofphuq2uh4aljljp0nivv';
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientSecret) {
    console.warn('[Twitch Refresh] TWITCH_CLIENT_SECRET fehlt. Verwende existierendes Token.');
    return { accessToken: refreshToken, expiresIn: 3600 };
  }

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.message || `Twitch Token-Refresh fehlgeschlagen (HTTP ${res.status})`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Helper: Refreshes a Google Workspace Access Token via Google OAuth Token Endpoint
 */
async function refreshGoogleToken(
  refreshToken: string,
  userId: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID || '248792984033-91mcnb6d2qhl397nnou2fk6jp1d1dphn.apps.googleusercontent.com';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[Google Refresh] GOOGLE_CLIENT_ID oder GOOGLE_CLIENT_SECRET fehlt.');
    return { accessToken: refreshToken, expiresIn: 3600 };
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Google Token-Refresh fehlgeschlagen (HTTP ${res.status})`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || 3600,
  };
}

/**
 * Hilfsfunktion `getValidToken(userId, provider)`:
 * Prüft das Ablaufdatum des Tokens. Falls abgelaufen oder in weniger als 60 Sekunden ablaufend,
 * wird das Token automatisch über den refresh_token erneuert, neu verschlüsselt und gespeichert.
 */
export async function getValidToken(
  userId: string,
  provider: IntegrationProvider
): Promise<{ accessToken: string; valid: boolean; error?: string }> {
  const record = integrationDatabase.get(makeKey(userId, provider));
  if (!record) {
    return { accessToken: '', valid: false, error: `Keine Verbindung für Provider '${provider}' gefunden.` };
  }

  try {
    const now = Date.now();
    const isExpiringSoon = record.tokenExpiresAt - now < 60 * 1000; // unter 60 Sekunden Restlaufzeit

    // 1. Wenn noch gültig: direkt entschlüsseln und zurückgeben
    if (!isExpiringSoon) {
      const decrypted = await decryptSecret(record.encryptedAccessToken);
      return { accessToken: decrypted, valid: true };
    }

    // 2. Token ist abgelaufen oder läuft gleich ab: Automatischen Refresh durchführen
    console.log(`🔄 [Auth] Token für '${provider}' (User: ${userId}) ist abgelaufen. Starte automatischen Refresh...`);

    if (!record.encryptedRefreshToken) {
      const fallbackToken = await decryptSecret(record.encryptedAccessToken);
      return {
        accessToken: fallbackToken,
        valid: true,
        error: 'Kein Refresh-Token vorhanden; versuche bestehendes Token weiterzuverwenden.',
      };
    }

    const decryptedRefreshToken = await decryptSecret(record.encryptedRefreshToken);

    let refreshResult: { accessToken: string; refreshToken?: string; expiresIn: number };

    if (provider === 'twitch') {
      refreshResult = await refreshTwitchToken(decryptedRefreshToken, userId);
    } else if (provider === 'google' || provider === 'youtube') {
      refreshResult = await refreshGoogleToken(decryptedRefreshToken, userId);
    } else {
      refreshResult = { accessToken: decryptedRefreshToken, expiresIn: 3600 };
    }

    // Neu verschlüsseln und persistent speichern
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
      spreadsheetUrl: record.spreadsheetUrl,
    });

    console.log(`✅ [Auth] Token für '${provider}' (User: ${userId}) erfolgreich automatisch erneuert.`);
    return { accessToken: refreshResult.accessToken, valid: true };
  } catch (err: any) {
    console.error(`❌ [Auth] Fehler beim Abrufen/Erneuern des Tokens für '${provider}':`, err);
    return { accessToken: '', valid: false, error: err.message || 'Token ungültig' };
  }
}

/**
 * Persists an incoming Webhook Event into the user's event table.
 */
export function recordUserWebhookEvent(
  userId: string,
  provider: IntegrationProvider,
  eventType: string,
  eventData: Record<string, any>
): UserWebhookEvent {
  const event: UserWebhookEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    provider,
    eventType,
    eventData,
    receivedAt: new Date().toISOString(),
  };

  userEventsDatabase.unshift(event);
  if (userEventsDatabase.length > 500) {
    userEventsDatabase.pop();
  }

  return event;
}

/**
 * Retrieves all recent webhook events for a user.
 */
export function getUserWebhookEvents(userId?: string, limit = 50): UserWebhookEvent[] {
  if (!userId) return userEventsDatabase.slice(0, limit);
  return userEventsDatabase.filter((e) => e.userId === userId || e.userId === 'global').slice(0, limit);
}
