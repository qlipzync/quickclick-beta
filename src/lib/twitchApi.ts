export interface TwitchHelixUser {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: string;
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number;
  email?: string;
  created_at: string;
}

export interface TwitchHelixStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: 'live' | '';
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
}

const TWITCH_CLIENT_ID = '91mcnb6d2qhl397nnou2fk6jp1d1dphn'; // Standard or OAuth app client ID

export function parseTwitchHashParams(): { accessToken: string | null; state: string | null } {
  if (typeof window === 'undefined') return { accessToken: null, state: null };
  const hash = window.location.hash.substring(1);
  if (!hash) return { accessToken: null, state: null };

  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const state = params.get('state');

  return { accessToken, state };
}

export function parseTwitchAuthCode(): { code: string | null; state: string | null } {
  if (typeof window === 'undefined') return { code: null, state: null };
  const searchParams = new URLSearchParams(window.location.search);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  return { code, state };
}

export function cleanUrlHash(): void {
  if (typeof window === 'undefined') return;
  if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('code'))) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export async function fetchTwitchCurrentUser(token: string): Promise<TwitchHelixUser | null> {
  try {
    const res = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': TWITCH_CLIENT_ID,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        return data.data[0];
      }
    }
  } catch (err) {
    console.error('Direct Twitch Helix API fetch error:', err);
  }
  return null;
}

export async function fetchTwitchStreamLiveStatus(
  userId: string,
  token: string
): Promise<TwitchHelixStream | null> {
  try {
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': TWITCH_CLIENT_ID,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        return data.data[0];
      }
    }
  } catch (err) {
    console.warn('Twitch stream live check notice:', err);
  }
  return null;
}

export function getTwitchOAuthLoginUrl(stateParam?: string): string {
  const clientId = import.meta.env.VITE_TWITCH_CLIENT_ID || TWITCH_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/callback/twitch`;
  const scopes = ['clips:edit', 'user:read:email', 'channel:read:subscriptions'].join('+');

  return `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scopes}&state=${encodeURIComponent(stateParam || 'qlipzync_auth')}`;
}
