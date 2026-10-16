import { Router } from 'express';
import type { Request, Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth, requireActiveSubscription as requireSubscription } from '../middleware/authMiddleware.js';
import { encryptToken } from '../services/kmsService.js';

export const platformRouter = Router();

const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || 'ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91';
const db = getFirestore(FIRESTORE_DB_ID);

// 1. Status aller verbundenen Plattformen abrufen (Abo zwingend erforderlich)
platformRouter.get(
  '/status',
  verifyAuth,
  requireSubscription,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const uid = req.user!.uid;
      const integrationsSnapshot = await db
        .collection('users')
        .doc(uid)
        .collection('integrations')
        .get();

      const platforms = {
        twitch: { connected: false, accountName: null as string | null, updatedAt: null as string | null },
        youtube: { connected: false, accountName: null as string | null, updatedAt: null as string | null },
        tiktok: { connected: false, accountName: null as string | null, updatedAt: null as string | null },
      };

      integrationsSnapshot.forEach((doc) => {
        const id = doc.id as keyof typeof platforms;
        const data = doc.data();

        if (platforms[id]) {
          platforms[id] = {
            connected: Boolean(data.connected),
            accountName: data.accountName || null,
            updatedAt: data.updatedAt && typeof data.updatedAt.toDate === 'function'
              ? data.updatedAt.toDate().toISOString()
              : (data.updatedAt ? new Date(data.updatedAt).toISOString() : null),
          };
        }
      });

      // Gibt ausschließlich sichere UI-Flags zurück - Niemals Tokens!
      res.status(200).json({ platforms });
    } catch (error: any) {
      console.error('[PlatformRoutes] Fehler beim Laden des Status:', error?.message);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Plattform-Status konnte nicht geladen werden.' });
    }
  }
);

// 2. OAuth-Callback für Twitch verarbeiten (Backend übernimmt Token-Austausch & KMS)
platformRouter.post(
  '/callback/twitch',
  verifyAuth,
  requireSubscription,
  async (req: Request, res: Response): Promise<void> => {
    const { code, redirectUri } = req.body || {};
    const uid = req.user!.uid;

    if (!code || !redirectUri) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Code und redirectUri erforderlich.' });
      return;
    }

    try {
      const clientId = process.env.TWITCH_CLIENT_ID || 'afht5r000ofphuq2uh4aljljp0nivv';
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;

      // Token-Austausch direkt im Backend
      const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      });

      const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error('[Twitch Token Exchange Error]', errText);
        res.status(400).json({ error: 'TOKEN_EXCHANGE_FAILED', message: 'Twitch Token-Austausch fehlgeschlagen.' });
        return;
      }

      const tokenData = await tokenResponse.json() as { access_token: string; refresh_token?: string };
      const { access_token, refresh_token } = tokenData;

      // Benutzerdaten von Twitch holen
      const userProfileResponse = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Client-ID': clientId,
          Authorization: `Bearer ${access_token}`,
        },
      });

      let accountName = 'Unbekannter Kanal';
      let twitchUserId = '';

      if (userProfileResponse.ok) {
        const profileData = await userProfileResponse.json() as { data: Array<{ id: string; display_name: string }> };
        const twitchUserData = profileData.data?.[0];
        accountName = twitchUserData?.display_name || accountName;
        twitchUserId = twitchUserData?.id || '';
      }

      // Tokens serverseitig via Cloud KMS verschlüsseln
      const encryptedAccessToken = await encryptToken(access_token);
      const encryptedRefreshToken = refresh_token ? await encryptToken(refresh_token) : null;

      // Nur verschlüsselte Payloads in Firestore speichern - Niemals Klartext!
      await db.collection('users').doc(uid).collection('integrations').doc('twitch').set({
        connected: true,
        accountName,
        twitchUserId,
        encryptedAccessToken,
        encryptedRefreshToken,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      // Auch im Haupt-User-Dokument Status-Flag spiegeln
      await db.collection('users').doc(uid).set({
        twitchConnected: true,
        channelName: accountName,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      res.status(200).json({
        success: true,
        platform: 'twitch',
        accountName,
      });
    } catch (error: any) {
      console.error('[PlatformRoutes] Twitch OAuth error:', error?.message);
      res.status(500).json({ error: 'OAUTH_FAILED', message: 'Twitch-Verknüpfung fehlgeschlagen.' });
    }
  }
);

// 3. Plattform trennen
platformRouter.post(
  '/disconnect/:platform',
  verifyAuth,
  requireSubscription,
  async (req: Request, res: Response): Promise<void> => {
    const rawPlatform = req.params.platform;
    const platform = Array.isArray(rawPlatform) ? rawPlatform[0] : rawPlatform;
    const uid = req.user!.uid;

    const allowedPlatforms = ['twitch', 'youtube', 'tiktok'];
    if (!platform || !allowedPlatforms.includes(platform)) {
      res.status(400).json({ error: 'INVALID_PLATFORM', message: 'Ungültige Plattform angegeben.' });
      return;
    }

    try {
      await db.collection('users').doc(uid).collection('integrations').doc(platform).delete();

      if (platform === 'twitch') {
        await db.collection('users').doc(uid).set({
          twitchConnected: false,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      res.status(200).json({ success: true, message: `${platform} erfolgreich getrennt.` });
    } catch (error: any) {
      console.error('[PlatformRoutes] Disconnect error:', error?.message);
      res.status(500).json({ error: 'DELETE_FAILED', message: 'Trennen der Plattform fehlgeschlagen.' });
    }
  }
);
