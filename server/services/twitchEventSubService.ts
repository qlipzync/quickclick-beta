/**
 * Twitch Helix & EventSub Management Service
 * 
 * Capabilities:
 * - Obtains Twitch App Access Tokens via Client Credentials Flow
 * - Automatically registers EventSub Webhook Subscriptions (stream.online, stream.offline, channel.subscribe, channel.clip.created)
 * - Fetches real-time channel statistics from Twitch Helix API:
 *   * /users (User profile, profile image, description)
 *   * /channels (Broadcaster details, current game, title)
 *   * /streams (Live status, viewer count, start time)
 *   * /subscriptions (Subscriber counts with authorized user token)
 */

import { getValidToken } from './accountIntegrations.js';

let appAccessTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Gets a valid Twitch App Access Token using client_credentials grant.
 */
export async function getTwitchAppAccessToken(): Promise<string> {
  const now = Date.now();
  if (appAccessTokenCache && appAccessTokenCache.expiresAt > now + 60000) {
    return appAccessTokenCache.token;
  }

  const clientId = process.env.TWITCH_CLIENT_ID || 'afht5r000ofphuq2uh4aljljp0nivv';
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientSecret) {
    console.warn('[Twitch Helix] TWITCH_CLIENT_SECRET nicht konfiguriert.');
    return '';
  }

  try {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    const data = await res.json();
    if (res.ok && data.access_token) {
      appAccessTokenCache = {
        token: data.access_token,
        expiresAt: now + (data.expires_in || 3600) * 1000,
      };
      return data.access_token;
    } else {
      console.error('[Twitch App Token Error]', data);
      return '';
    }
  } catch (err) {
    console.error('[Twitch App Token Exception]', err);
    return '';
  }
}

export interface RegisterEventSubResult {
  success: boolean;
  subscriptionId?: string;
  type?: string;
  status?: string;
  error?: string;
}

/**
 * Registriert eine EventSub-Subscription bei Twitch.
 */
export async function registerTwitchEventSub(
  broadcasterUserId: string,
  subscriptionType = 'channel.clip.created',
  callbackUrl?: string
): Promise<RegisterEventSubResult> {
  const clientId = process.env.TWITCH_CLIENT_ID || 'afht5r000ofphuq2uh4aljljp0nivv';
  const webhookSecret = process.env.TWITCH_WEBHOOK_SECRET || 'quickclick_eventsub_secret_2026';
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const targetCallback = callbackUrl || `${appBaseUrl}/api/webhooks/twitch`;

  const appToken = await getTwitchAppAccessToken();
  if (!appToken) {
    return {
      success: false,
      error: 'Twitch App Access Token konnte nicht generiert werden (TWITCH_CLIENT_SECRET prüfen).',
    };
  }

  try {
    const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        'Client-Id': clientId,
        Authorization: `Bearer ${appToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: subscriptionType,
        version: '1',
        condition: {
          broadcaster_user_id: broadcasterUserId,
        },
        transport: {
          method: 'webhook',
          callback: targetCallback,
          secret: webhookSecret,
        },
      }),
    });

    const data = await res.json();
    if (res.ok && data.data && data.data.length > 0) {
      const sub = data.data[0];
      console.log(`📡 [Twitch EventSub] Subscription erfolgreich registriert: Type=${sub.type}, Status=${sub.status}`);
      return {
        success: true,
        subscriptionId: sub.id,
        type: sub.type,
        status: sub.status,
      };
    } else {
      return {
        success: false,
        error: data.message || `EventSub Registrierung fehlgeschlagen (HTTP ${res.status})`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}

export interface LiveChannelDetails {
  channelName: string;
  broadcasterId: string;
  displayName: string;
  profileImageUrl: string;
  isLive: boolean;
  viewerCount: number;
  title: string;
  gameName: string;
  startedAt?: string;
  subscriberCount: number;
  totalViews?: number;
}

/**
 * Ruft echte Kanal- und Live-Daten aus der Twitch Helix API ab.
 */
export async function fetchTwitchChannelLiveDetails(
  channelOrUserId: string,
  authUserId?: string
): Promise<LiveChannelDetails> {
  const clean = channelOrUserId.toLowerCase().replace(/^@/, '').trim();
  const clientId = process.env.TWITCH_CLIENT_ID || 'afht5r000ofphuq2uh4aljljp0nivv';

  let token = '';
  if (authUserId) {
    const userTokenResult = await getValidToken(authUserId, 'twitch');
    if (userTokenResult.valid && userTokenResult.accessToken) {
      token = userTokenResult.accessToken;
    }
  }

  if (!token) {
    token = await getTwitchAppAccessToken();
  }

  const defaultDetails: LiveChannelDetails = {
    channelName: clean,
    broadcasterId: '',
    displayName: clean,
    profileImageUrl: '',
    isLive: false,
    viewerCount: 0,
    title: '',
    gameName: '',
    subscriberCount: 0,
  };

  if (!token) {
    return defaultDetails;
  }

  try {
    // 1. Fetch User Profile
    const isId = /^\d+$/.test(clean);
    const userQuery = isId ? `id=${clean}` : `login=${encodeURIComponent(clean)}`;
    const userRes = await fetch(`https://api.twitch.tv/helix/users?${userQuery}`, {
      headers: {
        'Client-Id': clientId,
        Authorization: `Bearer ${token}`,
      },
    });

    if (userRes.ok) {
      const userData = await userRes.json();
      if (userData.data && userData.data.length > 0) {
        const u = userData.data[0];
        defaultDetails.broadcasterId = u.id;
        defaultDetails.displayName = u.display_name;
        defaultDetails.channelName = u.login;
        defaultDetails.profileImageUrl = u.profile_image_url || defaultDetails.profileImageUrl;
        defaultDetails.totalViews = u.view_count;

        // 2. Fetch Live Stream Info
        const streamRes = await fetch(`https://api.twitch.tv/helix/streams?user_id=${u.id}`, {
          headers: {
            'Client-Id': clientId,
            Authorization: `Bearer ${token}`,
          },
        });

        if (streamRes.ok) {
          const streamData = await streamRes.json();
          if (streamData.data && streamData.data.length > 0) {
            const s = streamData.data[0];
            defaultDetails.isLive = true;
            defaultDetails.viewerCount = s.viewer_count || 1;
            defaultDetails.title = s.title || defaultDetails.title;
            defaultDetails.gameName = s.game_name || defaultDetails.gameName;
            defaultDetails.startedAt = s.started_at;
          }
        }

        // 3. Fetch Broadcaster Channel details
        const chanRes = await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${u.id}`, {
          headers: {
            'Client-Id': clientId,
            Authorization: `Bearer ${token}`,
          },
        });

        if (chanRes.ok) {
          const chanData = await chanRes.json();
          if (chanData.data && chanData.data.length > 0) {
            const c = chanData.data[0];
            if (!defaultDetails.isLive) {
              defaultDetails.title = c.title || defaultDetails.title;
              defaultDetails.gameName = c.game_name || defaultDetails.gameName;
            }
          }
        }
      }
    }

    return defaultDetails;
  } catch (err) {
    console.error('[Twitch Helix Details Error]', err);
    return defaultDetails;
  }
}
