import { StreamerUser, SubscriptionPlan } from '../types/pipeline';
import { TwitchHelixUser, TwitchHelixStream, getTwitchOAuthLoginUrl } from './twitchApi';
import { PRESET_MODULAR_PLANS } from '../config/stripeUnifiedConfig';

export async function createRealStreamerUserFromTwitchHelix(
  helixUser: TwitchHelixUser,
  accessToken: string,
  plan: SubscriptionPlan = 'pro',
  initialChannel?: string,
  stream?: TwitchHelixStream | null
): Promise<StreamerUser> {
  const channelName = initialChannel || helixUser.login;
  const isPro = plan === 'pro' || plan === 'elite' || plan === 'titan';

  return {
    id: `twitch_${helixUser.id}`,
    email: helixUser.email || `${helixUser.login}@streamer.quickclick.com`,
    name: helixUser.display_name,
    displayName: helixUser.display_name,
    channelName,
    avatarUrl: helixUser.profile_image_url,
    isLive: Boolean(stream?.type === 'live'),
    game: stream?.game_name || 'Just Chatting',
    role: 'streamer',
    isAdmin: false,
    isTitanVip: false,
    hasActiveSubscription: false, // Standardmäßig Null-Zugriff bis verifiziert
    plan: 'none',
    clipsLimitTotal: 0,
    apiCallsLimit: 0,
    clipsUsedCount: 0,
    apiCallsUsedCount: 0,
    isFullyConfigured: false,
    modularConfig: PRESET_MODULAR_PLANS[isPro ? 2 : 0],
    settings: {
      autoPublish: true,
      verticalCropMode: 'facecam_top_gameplay_bottom',
      aiSubtitlesEnabled: true,
      aiHooksEnabled: true,
      cooldownMinutes: 5,
      notificationDiscord: true,
      notificationTelegram: false,
      targetPlatforms: ['tiktok', 'youtube_shorts', 'instagram_reels'],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function authenticateWithTwitch(preferredPlan?: string, initialChannel?: string): void {
  const state = JSON.stringify({ plan: preferredPlan, channel: initialChannel });
  const authUrl = getTwitchOAuthLoginUrl(state);

  const width = 600;
  const height = 750;
  const left = window.screen.width / 2 - width / 2;
  const top = window.screen.height / 2 - height / 2;

  const popup = window.open(
    authUrl,
    'TwitchAuth',
    `width=${width},height=${height},top=${top},left=${left},status=no,toolbar=no,menubar=no`
  );

  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    // Popup blocked, fallback to full page redirect
    window.location.href = authUrl;
  }
}
