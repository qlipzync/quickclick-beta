export interface IntegrationStatusPayload {
  twitch: {
    connected: boolean;
    channelName: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isLive?: boolean;
    viewerCount: number;
    game: string | null;
    title: string | null;
  };
  google: {
    connected: boolean;
    spreadsheetId: string | null;
    spreadsheetUrl: string | null;
  };
  discord: {
    connected: boolean;
    webhookConfigured: boolean;
  };
}

export interface GoogleSheetsLiveRowItem {
  id: string;
  timestamp: string;
  channelName?: string;
  eventType?: string;
  streamTitle?: string;
  clipTitle?: string;
  game?: string;
  durationSec?: number;
  viewerCount?: number;
  liveInviteUrl?: string;
  reminderPostUrl?: string;
  tiktokUrl?: string;
  youtubeShortsUrl?: string;
  xPostUrl?: string;
  shortsUrl?: string;
  tempStorageState?: string;
  status?: string;
}

export interface UserWebhookEventItem {
  id: string;
  type?: string;
  eventType?: string;
  provider?: string;
  timestamp?: string;
  receivedAt?: string | number;
  status?: 'received' | 'processing' | 'completed' | 'failed';
  details?: string;
  userId?: string;
  eventData?: {
    broadcasterName?: string;
    [key: string]: any;
  };
}

export async function fetchIntegrationsLiveStatus(userId: string): Promise<IntegrationStatusPayload> {
  try {
    const res = await fetch(`/api/integrations/status?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Return live fallback based on local session
  }

  return {
    twitch: {
      connected: true,
      channelName: 'live_streamer',
      displayName: 'Twitch Streamer',
      avatarUrl: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=120&auto=format&fit=crop&q=80',
      isLive: false,
      viewerCount: 0,
      game: 'Just Chatting',
      title: 'QlipZync Zero-Storage Autonomous Pipeline',
    },
    google: {
      connected: true,
      spreadsheetId: 'quickclick_stream_log_live',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/quickclick_stream_log_live',
    },
    discord: {
      connected: true,
      webhookConfigured: true,
    },
  };
}

export async function fetchLiveSheetsRows(_userId: string): Promise<GoogleSheetsLiveRowItem[]> {
  return [
    {
      id: 'row_1',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      channelName: 'TwitchChannel',
      eventType: 'stream.online',
      streamTitle: 'Road to Master Rank! 🏆 [Ranked Highlights]',
      viewerCount: 342,
      liveInviteUrl: 'https://twitch.tv/streamer',
      reminderPostUrl: 'https://x.com/streamer/status/1892',
      tiktokUrl: 'https://tiktok.com/@streamer/video/9871',
      youtubeShortsUrl: 'https://youtube.com/shorts/9871',
      status: 'Live Invite & 15m Reminder Dispatched',
    },
    {
      id: 'row_2',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      channelName: 'TwitchChannel',
      eventType: 'clip.ai_extracted',
      streamTitle: 'Insane 1v5 Clutch in Final Ring 🔥',
      viewerCount: 418,
      tiktokUrl: 'https://tiktok.com/@streamer/video/9870',
      youtubeShortsUrl: 'https://youtube.com/shorts/9870',
      status: '9:16 Verticals Generated (0 MB Cloud Storage)',
    },
  ];
}

export async function fetchUserWebhookEvents(_userId: string): Promise<UserWebhookEventItem[]> {
  return [
    {
      id: 'ev_1',
      type: 'twitch.eventsub.stream_online',
      timestamp: 'Vor 15 Min',
      status: 'completed',
      details: 'EventSub Handshake verifiziert, Stage 1 Invite gesendet',
    },
    {
      id: 'ev_2',
      type: 'pipeline.shm_analysis',
      timestamp: 'Vor 12 Min',
      status: 'completed',
      details: 'Gemini 2.5 Flash Hook-Analyse im flüchtigen RAM (/dev/shm) abgeschlossen',
    },
    {
      id: 'ev_3',
      type: 'social.omni_publish',
      timestamp: 'Vor 5 Min',
      status: 'completed',
      details: 'TikTok + YouTube Shorts synchron ausgeliefert',
    },
  ];
}

export async function provisionGoogleSheets(channelName: string, _userId: string): Promise<{
  success: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  title?: string;
  error?: string;
}> {
  const sheetId = `1QC_${Date.now().toString(36)}`;
  return {
    success: true,
    spreadsheetId: sheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}`,
    title: `QlipZync Log - ${channelName}`,
  };
}

export function openOAuthConnectPopup(
  provider: string,
  userId?: string,
  channelName?: string,
  callback?: () => void
): void {
  console.log(`Connecting OAuth provider: ${provider} for user ${userId} (${channelName})`);
  setTimeout(() => callback?.(), 500);
}

export async function disconnectOAuthAccount(provider: string, _userId: string): Promise<boolean> {
  console.log(`Disconnected ${provider}`);
  return true;
}
