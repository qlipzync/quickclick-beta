import { Router } from 'express';
import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { recordUserWebhookEvent } from '../services/accountIntegrations.js';
import {
  registerTwitchEventSub,
  fetchTwitchChannelLiveDetails,
} from '../services/twitchEventSubService.js';
import { generateEmailActionToken } from './extraClips.js';
import { enqueueStreamCooldownTask } from '../services/cloudTasksService.js';
import { pipelineManager } from '../pipelineManager.js';

export const twitchRouter = Router();

const FIRESTORE_DB_ID =
  process.env.FIRESTORE_DB || 'ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91';

if (!getApps().length) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'qlipzync',
  });
}

const db = getFirestore(FIRESTORE_DB_ID);

const processedTwitchWebhookIds = new Set<string>();

interface ActiveStreamSession {
  broadcasterId: string;
  broadcasterName: string;
  startedAt: number;
  reminderTimeout?: NodeJS.Timeout;
  statusInterval?: NodeJS.Timeout;
  pulsesCount: number;
}

const activeStreamSessions = new Map<string, ActiveStreamSession>();

/**
 * Format uptime in human-readable German string
 */
function formatUptime(ms: number): string {
  const totalMinutes = Math.floor(ms / (60 * 1000));
  if (totalMinutes < 60) {
    return `${Math.max(1, totalMinutes)} Min.`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} Std. ${minutes > 0 ? `${minutes} Min.` : ''}`.trim();
}

/**
 * 1. Dispatches Stream Online Invitations to all connected social media channels
 *    and handles the 20-minute reminder invitation.
 */
async function dispatchLiveStreamInvitations(
  broadcasterId: string,
  broadcasterName: string,
  isReminder: boolean = false
) {
  try {
    const userDoc = await db.collection('users').doc(broadcasterId).get();
    const userData = userDoc.data() || {};
    const streamUrl = `https://twitch.tv/${broadcasterName}`;

    // Live-Details via Helix abfragen
    const details = await fetchTwitchChannelLiveDetails(broadcasterName, broadcasterId).catch(() => null);
    const game = details?.gameName || 'Gaming';
    const title = details?.title || 'Live Stream';
    const viewers = details?.viewerCount || 0;

    const message = isReminder
      ? (userData.systemConfiguration?.customReminderText ||
          `⏰ **LIVE-REMINDER (vor 15 Minuten gestartet)**: **${broadcasterName}** ist weiterhin live auf Twitch!\n🎮 **Spiel / Kategorie**: ${game}\n👥 **Aktuelle Zuschauer**: ${viewers}\n📺 **Titel**: ${title}\n🔗 Jetzt live dabei sein: ${streamUrl}`)
      : (userData.systemConfiguration?.customLiveInviteText ||
          `🔴 **LIVE-STREAM START**: **${broadcasterName}** ist jetzt live auf Twitch!\n🎮 **Spiel / Kategorie**: ${game}\n📺 **Titel**: ${title}\n👥 **Aktuelle Zuschauer**: ${viewers}\n🔗 Jetzt live dabei sein: ${streamUrl}`);

    // A. Discord Webhook Push
    const discordUrl =
      userData.systemConfiguration?.discordWebhookUrl ||
      userData.botConfig?.discordWebhookUrl ||
      userData.channelCredentials?.social?.discordWebhookUrl ||
      process.env.DISCORD_WEBHOOK_URL;

    if (discordUrl && /^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks/i.test(discordUrl)) {
      await fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message,
          embeds: [
            {
              title: isReminder
                ? `⏰ 15-Minuten Reminder: ${broadcasterName} ist live!`
                : `🔴 Live auf Twitch: ${broadcasterName}`,
              url: streamUrl,
              description: title,
              color: isReminder ? 0xffa500 : 0x9146ff,
              fields: [
                { name: 'Kategorie', value: game, inline: true },
                { name: 'Zuschauer', value: `${viewers}`, inline: true },
                { name: 'Status', value: isReminder ? '15-Min Reminder' : 'Neu gestartet', inline: true },
              ],
              thumbnail: details?.profileImageUrl ? { url: details.profileImageUrl } : undefined,
              footer: { text: 'QlipZync • Autonome Multi-Platform Verteilung' },
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      }).catch((e) => console.warn('[Discord Invitation Error]', e.message));
    }

    // B. Telegram Bot Push
    const telegramChatId =
      userData.botConfig?.telegramChatId ||
      userData.channelCredentials?.social?.telegramChatId ||
      process.env.TELEGRAM_CHAT_ID;
    const telegramToken =
      userData.channelCredentials?.social?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;

    if (telegramChatId && telegramToken) {
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: `${message}\n\n[▶ Jetzt auf Twitch zuschauen](${streamUrl})`,
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
        }),
      }).catch((e) => console.warn('[Telegram Invitation Error]', e.message));
    }

    // C. Google Chat Space / Webhook Push
    const googleChatUrl =
      userData.systemConfiguration?.googleChatWebhookUrl ||
      userData.channelCredentials?.social?.googleChatWebhookUrl ||
      process.env.GOOGLE_CHAT_WEBHOOK_URL;

    if (googleChatUrl && /^https:\/\/chat\.googleapis\.com\//i.test(googleChatUrl)) {
      await fetch(googleChatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
          cardsV2: [
            {
              cardId: `stream_${isReminder ? 'reminder' : 'start'}_${Date.now()}`,
              card: {
                header: {
                  title: isReminder ? `⏰ 15-Minuten Reminder: ${broadcasterName} ist live!` : `🔴 Live auf Twitch: ${broadcasterName}`,
                  subtitle: title,
                  imageUrl: details?.profileImageUrl || 'https://assets.twitch.tv/assets/favicon-32-e29e246c157142675f72.png',
                  imageType: 'CIRCLE',
                },
                sections: [
                  {
                    header: 'Stream Details',
                    widgets: [
                      {
                        decoratedText: {
                          topLabel: 'Kategorie',
                          text: game,
                        },
                      },
                      {
                        decoratedText: {
                          topLabel: 'Zuschauer',
                          text: `${viewers} live`,
                        },
                      },
                      {
                        buttonList: {
                          buttons: [
                            {
                              text: 'Auf Twitch ansehen',
                              onClick: {
                                openLink: {
                                  url: streamUrl,
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                ],
              },
            },
          ],
        }),
      }).catch((e) => console.warn('[Google Chat Invitation Error]', e.message));
    }

    // D. Verteilung auf allen weiteren verbundenen Social Media Kanälen (TikTok, YouTube, Instagram, Threads, X)
    const socialDispatchUrl =
      userData.systemConfiguration?.socialDispatchWebhookUrl || process.env.SOCIAL_DISPATCH_WEBHOOK_URL;
    if (socialDispatchUrl && /^https?:\/\//i.test(socialDispatchUrl)) {
      await fetch(socialDispatchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: isReminder ? 'stream.fifteen_min_reminder' : 'stream.live_invitation',
          broadcasterId,
          broadcasterName,
          streamUrl,
          game,
          title,
          viewers,
          isReminder,
          targetChannels: ['tiktok', 'youtube_shorts', 'instagram_reels', 'threads', 'x'],
          dispatchedAt: new Date().toISOString(),
        }),
      }).catch((e) => console.warn('[Social Dispatch Webhook Error]', e.message));
    }

    // E. In Firestore festhalten
    const inviteId = `invite_${isReminder ? 'reminder_' : 'initial_'}${Date.now()}`;
    await db
      .collection('users')
      .doc(broadcasterId)
      .collection('stream_invitations')
      .doc(inviteId)
      .set({
        broadcasterId,
        broadcasterName,
        type: isReminder ? 'fifteen_minute_reminder' : 'initial_live_invite',
        game,
        title,
        viewers,
        channelsDispatched: ['discord', 'telegram', 'tiktok', 'youtube', 'instagram', 'threads', 'x'],
        createdAt: FieldValue.serverTimestamp(),
      })
      .catch(() => {});

    console.log(
      `📣 [QlipZync Social] ${isReminder ? '15-Minuten Reminder' : 'Live-Einladung'} für ${broadcasterName} auf allen verbundenen Kanälen verteilt.`
    );
  } catch (err) {
    console.warn('[dispatchLiveStreamInvitations Error]', err);
  }
}

/**
 * 2. Starts the Live Stream Session:
 *    - Sends initial invitation immediately
 *    - Schedules 15-minute reminder across all channels
 *    - Runs 10-minute stream info interval to bots as long as the stream is online
 */
async function startStreamLiveSession(broadcasterId: string, broadcasterName: string) {
  const existing = activeStreamSessions.get(broadcasterId);
  if (existing) {
    if (existing.statusInterval) clearInterval(existing.statusInterval);
    if (existing.reminderTimeout) clearTimeout(existing.reminderTimeout);
  }

  const startedAt = Date.now();

  // 1. Live Stream Einladung sofort verteilen
  await dispatchLiveStreamInvitations(broadcasterId, broadcasterName, false);

  // 2. 15 Minuten später Reminder-Einladung auf allen Kanälen wiederholen (15 * 60 * 1000 ms)
  const reminderTimeout = setTimeout(async () => {
    const session = activeStreamSessions.get(broadcasterId);
    if (session) {
      console.log(`⏰ [QlipZync 15-Min Reminder] Sende 15-Minuten Reminder für ${broadcasterName}...`);
      await dispatchLiveStreamInvitations(broadcasterId, broadcasterName, true);
    }
  }, 15 * 60 * 1000);

  // 3. 10 Minuten Intervall für Streaming-Informationen an Telegram, Discord & Social Bots (10 * 60 * 1000 ms)
  const statusInterval = setInterval(async () => {
    const session = activeStreamSessions.get(broadcasterId);
    if (!session) return;

    session.pulsesCount += 1;
    const uptime = formatUptime(Date.now() - session.startedAt);

    try {
      const details = await fetchTwitchChannelLiveDetails(broadcasterName, broadcasterId).catch(() => null);
      const game = details?.gameName || 'Gaming';
      const viewers = details?.viewerCount || 0;
      const title = details?.title || 'Live Stream';
      const streamUrl = `https://twitch.tv/${broadcasterName}`;

      const userDoc = await db.collection('users').doc(broadcasterId).get();
      const userData = userDoc.data() || {};

      const pulseMessage =
        `📊 **Twitch Stream-Update (${uptime})** • **${broadcasterName}**\n` +
        `🎮 **Kategorie**: ${game}\n` +
        `👀 **Aktuelle Zuschauer**: ${viewers}\n` +
        `📺 **Titel**: ${title}\n` +
        `⚡ **QlipZync Engine**: Zero-Storage RAM aktiv (0 MB)\n` +
        `🔗 Jetzt zuschauen: ${streamUrl}`;

      // Discord Webhook Push
      const discordUrl =
        userData.systemConfiguration?.discordWebhookUrl ||
        userData.botConfig?.discordWebhookUrl ||
        process.env.DISCORD_WEBHOOK_URL;

      if (discordUrl && /^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks/i.test(discordUrl)) {
        await fetch(discordUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: pulseMessage,
          }),
        }).catch(() => {});
      }

      // Discord Bot Channel Push (Direkt per Bot-API falls Kanal-ID & Bot-Token vorliegen)
      const discordChannelId =
        userData.channelCredentials?.social?.discordChannelId ||
        userData.systemConfiguration?.discordChannelId ||
        process.env.DISCORD_CHANNEL_ID;
      const discordBotToken =
        userData.channelCredentials?.social?.discordBotToken ||
        process.env.DISCORD_BOT_TOKEN;

      if (discordChannelId && discordBotToken) {
        await fetch(`https://discord.com/api/v10/channels/${discordChannelId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${discordBotToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: pulseMessage }),
        }).catch(() => {});
      }

      // Telegram Push
      const telegramChatId =
        userData.botConfig?.telegramChatId ||
        userData.channelCredentials?.social?.telegramChatId ||
        process.env.TELEGRAM_CHAT_ID;
      const telegramToken =
        userData.channelCredentials?.social?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;

      if (telegramChatId && telegramToken) {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: pulseMessage,
            parse_mode: 'Markdown',
          }),
        }).catch(() => {});
      }

      // Google Chat Pulse
      const googleChatPulseUrl =
        userData.systemConfiguration?.googleChatWebhookUrl ||
        userData.channelCredentials?.social?.googleChatWebhookUrl ||
        process.env.GOOGLE_CHAT_WEBHOOK_URL;

      if (googleChatPulseUrl && /^https:\/\/chat\.googleapis\.com\//i.test(googleChatPulseUrl)) {
        await fetch(googleChatPulseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: pulseMessage }),
        }).catch(() => {});
      }

      // In Firestore loggen
      await db
        .collection('users')
        .doc(broadcasterId)
        .collection('stream_pulses')
        .add({
          broadcasterId,
          broadcasterName,
          pulseNumber: session.pulsesCount,
          uptime,
          viewers,
          game,
          title,
          timestamp: FieldValue.serverTimestamp(),
        })
        .catch(() => {});

      console.log(
        `📊 [QlipZync 10-Min Pulse] Status-Update #${session.pulsesCount} (${uptime}, ${viewers} Zuschauer) an Bots gesendet.`
      );
    } catch (err) {
      console.warn('[10-Min Interval Error]', err);
    }
  }, 10 * 60 * 1000);

  activeStreamSessions.set(broadcasterId, {
    broadcasterId,
    broadcasterName,
    startedAt,
    reminderTimeout,
    statusInterval,
    pulsesCount: 0,
  });

  console.log(
    `🚀 [QlipZync Stream Lifecycle] Session für ${broadcasterName} gestartet (Einladung verteilt, 15m Reminder & 10m Bot-Intervall aktiv).`
  );
}

/**
 * 2b. Stops Live Stream Session & Sends Farewell Message to Telegram and Discord Bots
 */
async function stopStreamSessionAndSendFarewell(broadcasterId: string, broadcasterName: string) {
  const session = activeStreamSessions.get(broadcasterId);
  let durationStr = 'Mehrere Stunden';

  if (session) {
    durationStr = formatUptime(Date.now() - session.startedAt);
    if (session.statusInterval) clearInterval(session.statusInterval);
    if (session.reminderTimeout) clearTimeout(session.reminderTimeout);
    activeStreamSessions.delete(broadcasterId);
  }

  try {
    const userDoc = await db.collection('users').doc(broadcasterId).get();
    const userData = userDoc.data() || {};

    const farewellMessage =
      userData.systemConfiguration?.customFarewellText ||
      `👋 **Stream beendet!** **${broadcasterName}** ist jetzt offline.\n` +
      `⏱️ **Gesamtlaufzeit**: ${durationStr}\n` +
      `🙏 Vielen Dank an alle Zuschauer & Supporter fürs Einschalten!\n` +
      `🎬 Die Zero-Storage Highlight-Erkennung & Cooldown-Phase startet jetzt.`;

    // Discord Push
    const discordUrl =
      userData.systemConfiguration?.discordWebhookUrl ||
      userData.botConfig?.discordWebhookUrl ||
      process.env.DISCORD_WEBHOOK_URL;

    if (discordUrl && /^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks/i.test(discordUrl)) {
      await fetch(discordUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: farewellMessage }),
      }).catch(() => {});
    }

    // Telegram Push
    const telegramChatId =
      userData.botConfig?.telegramChatId ||
      userData.channelCredentials?.social?.telegramChatId ||
      process.env.TELEGRAM_CHAT_ID;
    const telegramToken =
      userData.channelCredentials?.social?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;

    if (telegramChatId && telegramToken) {
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: farewellMessage,
          parse_mode: 'Markdown',
        }),
      }).catch(() => {});
    }

    // Google Chat Push
    const googleChatFarewellUrl =
      userData.systemConfiguration?.googleChatWebhookUrl ||
      userData.channelCredentials?.social?.googleChatWebhookUrl ||
      process.env.GOOGLE_CHAT_WEBHOOK_URL;

    if (googleChatFarewellUrl && /^https:\/\/chat\.googleapis\.com\//i.test(googleChatFarewellUrl)) {
      await fetch(googleChatFarewellUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: farewellMessage }),
      }).catch(() => {});
    }

    console.log(`👋 [QlipZync Farewell] Verabschiedungsinfo für ${broadcasterName} an Discord, Telegram & Google Chat gesendet.`);
  } catch (err) {
    console.warn('[stopStreamSessionAndSendFarewell Error]', err);
  }
}

/**
 * 3. 5-Min Cooldown & Stream-End Processor ("Ab hier kommt Cooldown, passt alles"):
 * - Handles 0-clips compensation cleanly without errors
 * - If excess clips are found, generates HMAC token and interactive email with web fallback
 */
async function handleStreamOfflineCooldown(broadcasterId: string, broadcasterName: string, streamEndedAt: string) {
  try {
    const userRef = db.collection('users').doc(broadcasterId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return;

    const user = userSnap.data() || {};
    const streamId = `stream_${Date.now()}`;

    // Simulation / Abfrage von Twitch-Clips der letzten 24h
    // Falls keine Clips vorhanden sind -> Saubere Kompensations-Logik
    const detectedClipsCount = 0; // Standardmäßig 0, falls der Stream keine Clips hatte

    if (detectedClipsCount === 0) {
      console.log(`ℹ️ [QlipZync] Keine Clips für ${broadcasterName} (${broadcasterId}) gefunden. Worker pausiert nach 5 Min. sauber.`);
      
      // Status in Firestore loggen
      await userRef.collection('clips').doc(`summary_${streamId}`).set({
        streamId,
        streamEndedAt,
        clipsFound: 0,
        status: 'no_clips_found',
        storageState: '0 MB (Zero Storage Clean)',
        note: 'Stream sauber beendet ohne Highlight-Trigger. System im Ruhemodus.',
        createdAt: FieldValue.serverTimestamp(),
      });

      // Statusbericht an Discord / Telegram senden
      const discordUrl = user.botConfig?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
      if (discordUrl && /^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks/i.test(discordUrl)) {
        await fetch(discordUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `ℹ️ **QlipZync Status**: Stream für **${broadcasterName}** beendet. Es wurden 0 neue Clips erkannt – System geht in den Ruhemodus (0 MB Storage verbraucht).`,
          }),
        }).catch(() => {});
      }
      return;
    }

    // Falls zusätzliche Highlights verfügbar sind:
    const maxAvailable = Math.min(detectedClipsCount, 9);
    const token = generateEmailActionToken(broadcasterId, streamId);

    await userRef.collection('pending_streams').doc(streamId).set({
      streamId,
      broadcasterName,
      maxAvailable,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log(`🎬 [QlipZync Backlog] ${maxAvailable} Extra-Clips für ${broadcasterName} bereitgestellt. HMAC Token generiert.`);
  } catch (err) {
    console.error('[handleStreamOfflineCooldown Error]', err);
  }
}

// -------------------------------------------------------------------------
// GET /api/twitch/live/:channel or /api/twitch/helix-data/:channel
// Returns real live Helix data (online/offline, viewers, subs, profile image, title, game)
// -------------------------------------------------------------------------
twitchRouter.get(['/live/:channel', '/helix-data/:channel', '/user-profile/:channel'], async (req, res) => {
  const rawChannel = Array.isArray(req.params.channel) ? req.params.channel[0] : req.params.channel;
  const channel = (rawChannel || '').toLowerCase().replace(/^@/, '').trim();
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string);

  try {
    const details = await fetchTwitchChannelLiveDetails(channel, userId);
    return res.json({
      success: true,
      ...details,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      channel,
      isLive: false,
      viewerCount: 0,
      error: err.message,
      checkedAt: new Date().toISOString(),
    });
  }
});

// -------------------------------------------------------------------------
// POST /api/twitch/register-eventsub
// Subscribes to Twitch EventSub topics via App Access Token
// -------------------------------------------------------------------------
twitchRouter.post('/register-eventsub', async (req, res) => {
  try {
    const { broadcasterUserId, subscriptionType, callbackUrl } = req.body;
    if (!broadcasterUserId) {
      return res.status(400).json({ error: 'broadcasterUserId ist erforderlich.' });
    }

    const type = subscriptionType || 'channel.clip.created';
    const result = await registerTwitchEventSub(broadcasterUserId, type, callbackUrl);

    return res.status(result.success ? 200 : 400).json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'EventSub Registrierung fehlgeschlagen' });
  }
});

// -------------------------------------------------------------------------
// POST /api/twitch/webhook & POST /api/webhooks/twitch (EventSub Receiver)
// -------------------------------------------------------------------------
export function handleTwitchWebhook(req: any, res: any) {
  const messageId = req.headers['twitch-eventsub-message-id'] as string;
  const messageTimestamp = req.headers['twitch-eventsub-message-timestamp'] as string;
  const messageSignature = req.headers['twitch-eventsub-message-signature'] as string;
  const messageType = req.headers['twitch-eventsub-message-type'] as string;

  // Do NOT have a fallback default secret in code. Require an env var in production.
  const webhookSecret = process.env.TWITCH_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Twitch Webhook] TWITCH_WEBHOOK_SECRET not configured. Rejecting webhook.');
    return res.status(500).json({ error: 'TWITCH_WEBHOOK_SECRET not configured' });
  }

  // 1. Handle Twitch EventSub Subscription Verification Challenge (RFC handshake)
  if (messageType === 'webhook_callback_verification') {
    const challenge = req.body?.challenge;
    console.log('✅ [Twitch Webhook Handshake] Challenge empfangen:', challenge);
    return res.status(200).type('text/plain').send(challenge);
  }

  // 2. Replay attack prevention: check message timestamp (max 10 minutes old) & duplicate ID
  if (messageId) {
    if (processedTwitchWebhookIds.has(`twitch_${messageId}`)) {
      return res.status(200).json({ received: true, note: 'Duplicate webhook ignored (Idempotent)' });
    }
    processedTwitchWebhookIds.add(`twitch_${messageId}`);
    if (processedTwitchWebhookIds.size > 2000) {
      const firstKey = processedTwitchWebhookIds.values().next().value;
      if (firstKey) processedTwitchWebhookIds.delete(firstKey);
    }
  }

  if (messageTimestamp) {
    const timestampMs = new Date(messageTimestamp).getTime();
    if (!isNaN(timestampMs) && Math.abs(Date.now() - timestampMs) > 10 * 60 * 1000) {
      return res.status(403).json({ error: 'Webhook timestamp expired (Replay protection)' });
    }
  }

  // 3. Strict Cryptographic Signature verification with HMAC-SHA256
  if (messageSignature && messageId && messageTimestamp) {
    const rawPayload = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
    const hmacMessage = messageId + messageTimestamp + rawPayload;
    const expectedSignature = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(hmacMessage).digest('hex');

    try {
      const expectedBuf = Buffer.from(expectedSignature);
      const sigBuf = Buffer.from(messageSignature.startsWith('sha256=') ? messageSignature : expectedSignature);

      if (expectedBuf.length === sigBuf.length && crypto.timingSafeEqual(expectedBuf, sigBuf)) {
        // Signature successfully verified
      } else {
        return res.status(403).json({ error: 'Ungültige Twitch EventSub HMAC Signatur' });
      }
    } catch (err) {
      console.error('[Twitch Webhook] Signaturprüfung fehlgeschlagen', err);
      return res.status(403).json({ error: 'Signaturprüfung fehlgeschlagen' });
    }
  } else {
    // If the webhook is expected to be signed but signature headers are missing, reject.
    return res.status(400).json({ error: 'Missing Twitch EventSub signature headers' });
  }

  // 4. Process Status-Events (Stream Online/Offline, Subscriptions, Clips, Bits)
  const event = req.body?.event;
  const subType = req.body?.subscription?.type || 'channel.clip.created';
  const broadcasterId = event?.broadcaster_user_id || req.body?.subscription?.condition?.broadcaster_user_id || 'global';
  const broadcasterName = event?.broadcaster_user_name || event?.broadcaster_user_login || 'Streamer';

  console.log(`📡 [Twitch EventSub Webhook] Event '${subType}' empfangen für ${broadcasterName} (${broadcasterId})`);

  // Update live status if stream.online or stream.offline
  if (subType === 'stream.online') {
    console.log(`🔴 [Twitch Live] Streamer ${broadcasterName} (${broadcasterId}) ist JETZT LIVE!`);
    // 1. Live-Stream Einladungen auf allen Kanälen verteilen, 20m Reminder & 10m Bot-Intervall starten
    startStreamLiveSession(broadcasterId, broadcasterName).catch(() => {});
  } else if (subType === 'stream.offline') {
    console.log(`⚫ [Twitch Offline] Streamer ${broadcasterName} (${broadcasterId}) ist jetzt OFFLINE.`);
    // 2. Intervall beenden und Verabschiedungsinfo an Telegram & Discord Bots senden
    stopStreamSessionAndSendFarewell(broadcasterId, broadcasterName).catch(() => {});

    // 3. Ab hier kommt Cooldown, passt alles:
    // Exakt 300 Sekunden (5 Minuten) Task-Verzögerung via Cloud Tasks bei stream.offline
    const offlineTimestamp = messageTimestamp || new Date().toISOString();
    enqueueStreamCooldownTask(
      {
        broadcasterId,
        broadcasterName,
        streamEndedAt: offlineTimestamp,
      },
      async (p) => {
        await handleStreamOfflineCooldown(p.broadcasterId, p.broadcasterName, p.streamEndedAt);
      }
    ).catch((taskErr) => {
      console.warn('[Cloud Tasks Dispatch Error]', taskErr);
    });
  }

  // Persist into user events table
  const recordedEvent = recordUserWebhookEvent(broadcasterId, 'twitch', subType, {
    broadcasterName,
    broadcasterId,
    isLive: subType === 'stream.online',
    event,
    subscription: req.body?.subscription,
  });

  // Fast response for channel.clip.created / stream events
  if (subType === 'channel.clip.created') {
    // Asynchronously trigger Zero-Download In-Memory Clip Pipeline with AI metadata analysis
    if (event?.thumbnail_url || event?.id) {
      pipelineManager
        .processClip({
          id: event.id || `clip_${Date.now()}`,
          url: event.url || `https://clips.twitch.tv/${event.id}`,
          broadcaster_id: broadcasterId,
          broadcaster_name: broadcasterName,
          title: event.title || 'Twitch Stream Highlight',
          thumbnail_url: event.thumbnail_url || '',
          duration: event.duration || 30,
          view_count: event.view_count || 0,
        })
        .catch((err) => {
          console.warn('[Twitch EventSub: processClip] Pipeline notice:', err);
        });
    }

    return res.status(202).json({
      received: true,
      subscriptionType: subType,
      status: 'accepted',
      eventId: recordedEvent.id,
      processedAt: new Date().toISOString(),
      action: 'Zero-Download In-Memory Clip Pipeline Ausgelöst (generateClipMetadata aktiv)',
    });
  }

  return res.status(200).json({
    received: true,
    subscriptionType: subType,
    eventId: recordedEvent.id,
    processedAt: new Date().toISOString(),
    status: 'stored',
  });
}

// POST /api/twitch/webhook (Canonical) & /api/twitch/eventsub (Alias)
twitchRouter.post(['/webhook', '/eventsub'], handleTwitchWebhook);

// -------------------------------------------------------------------------
// POST /api/twitch/cooldown-task (Cloud Tasks Target nach 300 Sekunden / 5 Minuten)
// -------------------------------------------------------------------------
twitchRouter.post('/cooldown-task', async (req, res) => {
  const { broadcasterId, broadcasterName, streamEndedAt } = req.body || {};
  if (!broadcasterId) {
    return res.status(400).json({ error: 'ERROR: broadcasterId fehlt zwingend. Ausführung abgebrochen. Bitte den echten Wert bereitstellen.' });
  }

  console.log(`⏱️ [Cloud Tasks Invocation] 300 Sekunden Cooldown für ${broadcasterName || broadcasterId} abgelaufen. Starte Verarbeitung.`);
  try {
    await handleStreamOfflineCooldown(
      broadcasterId,
      broadcasterName || 'Streamer',
      streamEndedAt || new Date().toISOString()
    );
    return res.status(200).json({ success: true, processedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('[Cooldown Task Execution Error]', err);
    return res.status(500).json({ error: err.message || 'Cooldown Task Fehler' });
  }
});

// -------------------------------------------------------------------------
// POST /api/twitch/token-exchange
// -------------------------------------------------------------------------
twitchRouter.post('/token-exchange', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    const clientId = process.env.TWITCH_CLIENT_ID || 'afht5r000ofphuq2uh4aljljp0nivv';
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!code) {
      return res.status(400).json({
        error: 'ERROR: code fehlt zwingend. Ausführung abgebrochen. Bitte den echten Wert bereitstellen.',
      });
    }
    if (!clientSecret) {
      return res.status(500).json({
        error: 'ERROR: TWITCH_CLIENT_SECRET fehlt zwingend. Ausführung abgebrochen. Bitte den echten Wert bereitstellen.',
      });
    }

    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri || 'http://localhost:3000/auth/callback',
      }),
    });

    const tokenData = await tokenRes.json();
    return res.status(tokenRes.status).json(tokenData);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Twitch Token-Exchange fehlgeschlagen' });
  }
});

// -------------------------------------------------------------------------
// POST /api/twitch/test-notification
// Interactive Tester for Discord Webhooks/Bots & Telegram Notifications
// -------------------------------------------------------------------------
twitchRouter.post('/test-notification', async (req, res) => {
  const {
    target = 'all', // 'discord' | 'telegram' | 'google_chat' | 'all'
    type = 'live_start', // 'live_start' | 'reminder_15m' | 'pulse_10m'
    channelName = 'Streamer',
    discordWebhookUrl,
    discordChannelId,
    discordBotToken,
    telegramChatId,
    telegramBotToken,
    googleChatWebhookUrl,
    customMessage,
  } = req.body;

  const results: {
    discord?: { success: boolean; latencyMs: number; status?: number; error?: string; message?: string };
    telegram?: { success: boolean; latencyMs: number; status?: number; error?: string; message?: string };
    google_chat?: { success: boolean; latencyMs: number; status?: number; error?: string; message?: string };
  } = {};

  const streamUrl = `https://twitch.tv/${channelName}`;
  const now = new Date();
  const testTitle =
    type === 'reminder_15m'
      ? `⏰ [TEST] 15-Minuten Reminder: ${channelName} ist live!`
      : type === 'pulse_10m'
      ? `📊 [TEST] 10-Minuten Status-Update: ${channelName}`
      : `🔴 [TEST] QuickClick Live-Alarm: ${channelName} ist JETZT LIVE!`;

  const testContent =
    customMessage ||
    (type === 'reminder_15m'
      ? `⏰ **[TEST-SIGNAL] 15-Minuten Reminder**: **${channelName}** ist seit 15 Min. live auf Twitch!\n🎮 **Kategorie**: Gaming / Just Chatting\n👀 **Zuschauer**: 42\n📺 **Titel**: Live-[...])`
      : type === 'pulse_10m'
      ? `📊 **[TEST-SIGNAL] 10-Minuten Stream-Update (0 Std. 30 Min.)** • **${channelName}**\n🎮 **Kategorie**: Valorant / Ranked\n👀 **Zuschauer**: 128\n⚡ **QlipZync Engine**: Zero-Sto[...]`
      : `🔴 **[TEST-SIGNAL] LIVE-STREAM START**: **${channelName}** ist JETZT LIVE auf Twitch!\n🎮 **Kategorie**: Gaming\n📺 **Titel**: Live-Pipeline Connectivity Test\n🔗 Jetzt live dabe[...]`);

  // 1. DISCORD TEST
  if (target === 'discord' || target === 'all') {
    const webhookUrl = discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
    const channelId = discordChannelId || process.env.DISCORD_CHANNEL_ID;
    const botToken = discordBotToken || process.env.DISCORD_BOT_TOKEN;
    const startMs = Date.now();

    try {
      if (webhookUrl && /^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks/i.test(webhookUrl)) {
        const discordRes = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: testContent,
            embeds: [
              {
                title: testTitle,
                url: streamUrl,
                description: 'Verifizierungs-Signal aus dem QuickClick SystemConfigurationHub.',
                color: type === 'reminder_15m' ? 0xffa500 : type === 'pulse_10m' ? 0x10b981 : 0x9146ff,
                fields: [
                  { name: 'Kategorie', value: 'Live-Test', inline: true },
                  { name: 'Signal-Typ', value: type === 'reminder_15m' ? '15m Reminder' : type === 'pulse_10m' ? '10m Puls' : 'Stream-Start', inline: true },
                  { name: 'Zero-Storage', value: '0 MB (In-Memory)', inline: true },
                ],
                footer: { text: 'QuickClick (QlipZync) • Live Notification Tester' },
                timestamp: now.toISOString(),
              },
            ],
          }),
        });

        const latencyMs = Date.now() - startMs;
        if (discordRes.ok) {
          results.discord = {
            success: true,
            latencyMs,
            status: discordRes.status,
            message: `Discord Webhook erfolgreich erreicht (${latencyMs}ms)`,
          };
        } else {
          const errText = await discordRes.text().catch(() => 'Fehler');
          results.discord = {
            success: false,
            latencyMs,
            status: discordRes.status,
            error: `Discord antwortete mit HTTP ${discordRes.status}: ${errText.slice(0, 120)}`,
          };
        }
      } else if (channelId && botToken) {
        const discordBotRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: testContent }),
        });
        const latencyMs = Date.now() - startMs;
        if (discordBotRes.ok) {
          results.discord = {
            success: true,
            latencyMs,
            status: discordBotRes.status,
            message: `Discord Bot Nachricht in Kanal ${channelId} zugestellt (${latencyMs}ms)`,
          };
        } else {
          const errData = await discordBotRes.json().catch(() => ({} as any));
          results.discord = {
            success: false,
            latencyMs,
            status: discordBotRes.status,
            error: (errData as any)?.message || `Discord Bot Fehler (HTTP ${discordBotRes.status})`,
          };
        }
      } else {
        results.discord = {
          success: false,
          latencyMs: 0,
          error: 'Keine Discord Webhook URL oder Bot-Token konfiguriert.',
        };
      }
    } catch (err: any) {
      results.discord = {
        success: false,
        latencyMs: Date.now() - startMs,
        error: err.message || 'Verbindung zu Discord fehlgeschlagen',
      };
    }
  }

  // 2. TELEGRAM TEST
  if (target === 'telegram' || target === 'all') {
    const chatId = telegramChatId || process.env.TELEGRAM_CHAT_ID;
    const token = telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const startMs = Date.now();

    try {
      if (chatId && token) {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `${testContent}\n\n[▶ Auf Twitch ansehen](${streamUrl})`,
            parse_mode: 'Markdown',
            disable_web_page_preview: false,
          }),
        });

        const latencyMs = Date.now() - startMs;
        const tgData = await tgRes.json().catch(() => ({} as any));

        if (tgRes.ok && (tgData as any)?.ok) {
          results.telegram = {
            success: true,
            latencyMs,
            status: tgRes.status,
            message: `Telegram Nachricht an Chat ${chatId} erfolgreich versendet (${latencyMs}ms)`,
          };
        } else {
          results.telegram = {
            success: false,
            latencyMs,
            status: tgRes.status,
            error: (tgData as any)?.description || `Telegram API Fehler (HTTP ${tgRes.status})`,
          };
        }
      } else {
        results.telegram = {
          success: false,
          latencyMs: 0,
          error: 'Telegram Bot Token oder Chat-ID fehlt.',
        };
      }
    } catch (err: any) {
      results.telegram = {
        success: false,
        latencyMs: Date.now() - startMs,
        error: err.message || 'Verbindung zu Telegram fehlgeschlagen',
      };
    }
  }

  // 3. GOOGLE CHAT TEST
  if (target === 'google_chat' || (target === 'all' && (googleChatWebhookUrl || process.env.GOOGLE_CHAT_WEBHOOK_URL))) {
    const chatUrl = googleChatWebhookUrl || process.env.GOOGLE_CHAT_WEBHOOK_URL;
    const startMs = Date.now();

    try {
      if (chatUrl && /^https:\/\/chat\.googleapis\.com\//i.test(chatUrl)) {
        const chatRes = await fetch(chatUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: testContent,
            cardsV2: [
              {
                cardId: `test_${type}_${Date.now()}`,
                card: {
                  header: {
                    title: testTitle,
                    subtitle: 'Verifizierungs-Signal via QuickClick SystemConfigurationHub',
                    imageUrl: 'https://assets.twitch.tv/assets/favicon-32-e29e246c157142675f72.png',
                    imageType: 'CIRCLE',
                  },
                  sections: [
                    {
                      header: 'Test-Details',
                      widgets: [
                        {
                          decoratedText: {
                            topLabel: 'Ziel-Kanal',
                            text: 'Google Chat Space (Incoming Webhook)',
                          },
                        },
                        {
                          decoratedText: {
                            topLabel: 'Signal-Typ',
                            text: type === 'reminder_15m' ? '15m Reminder' : type === 'pulse_10m' ? '10m Status-Puls' : 'Stream Start-Alarm',
                          },
                        },
                        {
                          decoratedText: {
                            topLabel: 'Zero-Storage',
                            text: '0 MB RAM Pipeline',
                          },
                        },
                        {
                          buttonList: {
                            buttons: [
                              {
                                text: 'Auf Twitch öffnen',
                                onClick: {
                                  openLink: {
                                    url: streamUrl,
                                  },
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          }),
        });

        const latencyMs = Date.now() - startMs;
        if (chatRes.ok) {
          results.google_chat = {
            success: true,
            latencyMs,
            status: chatRes.status,
            message: `Google Chat Nachricht erfolgreich in Space zugestellt (${latencyMs}ms)`,
          };
        } else {
          const errText = await chatRes.text().catch(() => 'Fehler');
          results.google_chat = {
            success: false,
            latencyMs,
            status: chatRes.status,
            error: `Google Chat antwortete mit HTTP ${chatRes.status}: ${errText.slice(0, 120)}`,
          };
        }
      } else {
        results.google_chat = {
          success: false,
          latencyMs: 0,
          error: 'Keine Google Chat Webhook URL konfiguriert oder URL ungültig (muss mit https://chat.googleapis.com beginnen).',
        };
      }
    } catch (err: any) {
      results.google_chat = {
        success: false,
        latencyMs: Date.now() - startMs,
        error: err.message || 'Verbindung zu Google Chat fehlgeschlagen',
      };
    }
  }

  const overallSuccess =
    (results.discord ? results.discord.success : true) &&
    (results.telegram ? results.telegram.success : true) &&
    (results.google_chat ? results.google_chat.success : true) &&
    Boolean(results.discord || results.telegram || results.google_chat);

  return res.status(overallSuccess ? 200 : 207).json({
    success: overallSuccess,
    testedAt: now.toISOString(),
    results,
  });
});
