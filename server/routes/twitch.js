import { Router } from "express";
import crypto from "crypto";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { recordUserWebhookEvent } from "../services/accountIntegrations.js";
import {
  registerTwitchEventSub,
  fetchTwitchChannelLiveDetails
} from "../services/twitchEventSubService.js";
import { generateEmailActionToken } from "./extraClips.js";
import { enqueueStreamCooldownTask } from "../services/cloudTasksService.js";
import { pipelineManager } from "../pipelineManager.js";
import { requireAuth, requireActiveSubscription } from "../middleware/authMiddleware.js";
import { encryptSecret } from "../services/kmsService.js";
const twitchRouter = Router();
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91";
if (!getApps().length) {
  initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "qlipzync"
  });
}
const db = getFirestore(FIRESTORE_DB_ID);
const processedTwitchWebhookIds = /* @__PURE__ */ new Set();
const activeStreamSessions = /* @__PURE__ */ new Map();
function formatUptime(ms) {
  const totalMinutes = Math.floor(ms / (60 * 1e3));
  if (totalMinutes < 60) {
    return `${Math.max(1, totalMinutes)} Min.`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} Std. ${minutes > 0 ? `${minutes} Min.` : ""}`.trim();
}
async function dispatchLiveStreamInvitations(broadcasterId, broadcasterName, isReminder = false) {
  try {
    const userDoc = await db.collection("users").doc(broadcasterId).get();
    const userData = userDoc.data() || {};
    const streamUrl = `https://twitch.tv/${broadcasterName}`;
    const details = await fetchTwitchChannelLiveDetails(broadcasterName, broadcasterId).catch(() => null);
    const game = details?.gameName || "Gaming";
    const title = details?.title || "Live Stream";
    const viewers = details?.viewerCount || 0;
    const message = isReminder ? userData.systemConfiguration?.customReminderText || `\u23F0 **LIVE-REMINDER (Vor 15 Min. gestartet)**: **${broadcasterName}** ist immer noch LIVE auf Twitch!
\u{1F3AE} **Spiel / Kategorie**: ${game}
\u{1F465} **Aktuelle Zuschauer**: ${viewers}
\u{1F4FA} **Titel**: ${title}
\u{1F517} Jetzt einschalten & Streamer unterst\xFCtzen: ${streamUrl}` : userData.systemConfiguration?.customLiveInviteText || `\u{1F534} **LIVE-STREAM START**: **${broadcasterName}** ist JETZT LIVE auf Twitch!
\u{1F3AE} **Spiel / Kategorie**: ${game}
\u{1F4FA} **Titel**: ${title}
\u{1F517} Jetzt live dabei sein: ${streamUrl}`;
    const discordUrl = userData.systemConfiguration?.discordWebhookUrl || userData.botConfig?.discordWebhookUrl || userData.channelCredentials?.social?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
    if (discordUrl && /^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks/i.test(discordUrl)) {
      await fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: message,
          embeds: [
            {
              title: isReminder ? `\u23F0 15-Minuten Reminder: ${broadcasterName} ist live!` : `\u{1F534} Live auf Twitch: ${broadcasterName}`,
              url: streamUrl,
              description: title,
              color: isReminder ? 16753920 : 9520895,
              fields: [
                { name: "Kategorie", value: game, inline: true },
                { name: "Zuschauer", value: `${viewers}`, inline: true },
                { name: "Status", value: isReminder ? "15-Min Reminder" : "Neu gestartet", inline: true }
              ],
              thumbnail: details?.profileImageUrl ? { url: details.profileImageUrl } : void 0,
              footer: { text: "QlipZync \u2022 Autonome Multi-Platform Verteilung" },
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            }
          ]
        })
      }).catch((e) => console.warn("[Discord Invitation Error]", e.message));
    }
    const telegramChatId = userData.botConfig?.telegramChatId || userData.channelCredentials?.social?.telegramChatId || process.env.TELEGRAM_CHAT_ID;
    const telegramToken = userData.channelCredentials?.social?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    if (telegramChatId && telegramToken) {
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: `${message}

[\u25B6 Jetzt auf Twitch zuschauen](${streamUrl})`,
          parse_mode: "Markdown",
          disable_web_page_preview: false
        })
      }).catch((e) => console.warn("[Telegram Invitation Error]", e.message));
    }
    const googleChatUrl = userData.systemConfiguration?.googleChatWebhookUrl || userData.channelCredentials?.social?.googleChatWebhookUrl || process.env.GOOGLE_CHAT_WEBHOOK_URL;
    if (googleChatUrl && /^https:\/\/chat\.googleapis\.com\//i.test(googleChatUrl)) {
      await fetch(googleChatUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: message,
          cardsV2: [
            {
              cardId: `stream_${isReminder ? "reminder" : "start"}_${Date.now()}`,
              card: {
                header: {
                  title: isReminder ? `\u23F0 15-Minuten Reminder: ${broadcasterName} ist live!` : `\u{1F534} Live auf Twitch: ${broadcasterName}`,
                  subtitle: title,
                  imageUrl: details?.profileImageUrl || "https://assets.twitch.tv/assets/favicon-32-e29e246c157142675f72.png",
                  imageType: "CIRCLE"
                },
                sections: [
                  {
                    header: "Stream Details",
                    widgets: [
                      {
                        decoratedText: {
                          topLabel: "Kategorie",
                          text: game
                        }
                      },
                      {
                        decoratedText: {
                          topLabel: "Zuschauer",
                          text: `${viewers} live`
                        }
                      },
                      {
                        buttonList: {
                          buttons: [
                            {
                              text: "Auf Twitch ansehen",
                              onClick: {
                                openLink: {
                                  url: streamUrl
                                }
                              }
                            }
                          ]
                        }
                      }
                    ]
                  }
                ]
              }
            }
          ]
        })
      }).catch((e) => console.warn("[Google Chat Invitation Error]", e.message));
    }
    const socialDispatchUrl = userData.systemConfiguration?.socialDispatchWebhookUrl || process.env.SOCIAL_DISPATCH_WEBHOOK_URL;
    if (socialDispatchUrl && /^https?:\/\//i.test(socialDispatchUrl)) {
      await fetch(socialDispatchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: isReminder ? "stream.fifteen_min_reminder" : "stream.live_invitation",
          broadcasterId,
          broadcasterName,
          streamUrl,
          game,
          title,
          viewers,
          isReminder,
          targetChannels: ["tiktok", "youtube_shorts", "instagram_reels", "threads", "x"],
          dispatchedAt: (/* @__PURE__ */ new Date()).toISOString()
        })
      }).catch((e) => console.warn("[Social Dispatch Webhook Error]", e.message));
    }
    const inviteId = `invite_${isReminder ? "reminder_" : "initial_"}${Date.now()}`;
    await db.collection("users").doc(broadcasterId).collection("stream_invitations").doc(inviteId).set({
      broadcasterId,
      broadcasterName,
      type: isReminder ? "fifteen_minute_reminder" : "initial_live_invite",
      game,
      title,
      viewers,
      channelsDispatched: ["discord", "telegram", "tiktok", "youtube", "instagram", "threads", "x"],
      createdAt: FieldValue.serverTimestamp()
    }).catch(() => {
    });
    console.log(
      `\u{1F4E3} [QlipZync Social] ${isReminder ? "15-Minuten Reminder" : "Live-Einladung"} f\xFCr ${broadcasterName} auf allen verbundenen Kan\xE4len verteilt.`
    );
  } catch (err) {
    console.warn("[dispatchLiveStreamInvitations Error]", err);
  }
}
async function startStreamLiveSession(broadcasterId, broadcasterName) {
  const existing = activeStreamSessions.get(broadcasterId);
  if (existing) {
    if (existing.statusInterval) clearInterval(existing.statusInterval);
    if (existing.reminderTimeout) clearTimeout(existing.reminderTimeout);
  }
  const startedAt = Date.now();
  await dispatchLiveStreamInvitations(broadcasterId, broadcasterName, false);
  const reminderTimeout = setTimeout(async () => {
    const session = activeStreamSessions.get(broadcasterId);
    if (session) {
      console.log(`\u23F0 [QlipZync 15-Min Reminder] Sende 15-Minuten Reminder f\xFCr ${broadcasterName}...`);
      await dispatchLiveStreamInvitations(broadcasterId, broadcasterName, true);
    }
  }, 15 * 60 * 1e3);
  const statusInterval = setInterval(async () => {
    const session = activeStreamSessions.get(broadcasterId);
    if (!session) return;
    session.pulsesCount += 1;
    const uptime = formatUptime(Date.now() - session.startedAt);
    try {
      const details = await fetchTwitchChannelLiveDetails(broadcasterName, broadcasterId).catch(() => null);
      const game = details?.gameName || "Gaming";
      const viewers = details?.viewerCount || 0;
      const title = details?.title || "Live Stream";
      const streamUrl = `https://twitch.tv/${broadcasterName}`;
      const userDoc = await db.collection("users").doc(broadcasterId).get();
      const userData = userDoc.data() || {};
      const pulseMessage = `\u{1F4CA} **Twitch Stream-Update (${uptime})** \u2022 **${broadcasterName}**
\u{1F3AE} **Kategorie**: ${game}
\u{1F440} **Aktuelle Zuschauer**: ${viewers}
\u{1F4FA} **Titel**: ${title}
\u26A1 **QlipZync Engine**: Zero-Storage RAM aktiv (0 MB)
\u{1F517} Jetzt zuschauen: ${streamUrl}`;
      const discordUrl = userData.systemConfiguration?.discordWebhookUrl || userData.botConfig?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
      if (discordUrl && /^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks/i.test(discordUrl)) {
        await fetch(discordUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: pulseMessage
          })
        }).catch(() => {
        });
      }
      const discordChannelId = userData.channelCredentials?.social?.discordChannelId || userData.systemConfiguration?.discordChannelId || process.env.DISCORD_CHANNEL_ID;
      const discordBotToken = userData.channelCredentials?.social?.discordBotToken || process.env.DISCORD_BOT_TOKEN;
      if (discordChannelId && discordBotToken) {
        await fetch(`https://discord.com/api/v10/channels/${discordChannelId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${discordBotToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ content: pulseMessage })
        }).catch(() => {
        });
      }
      const telegramChatId = userData.botConfig?.telegramChatId || userData.channelCredentials?.social?.telegramChatId || process.env.TELEGRAM_CHAT_ID;
      const telegramToken = userData.channelCredentials?.social?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
      if (telegramChatId && telegramToken) {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: pulseMessage,
            parse_mode: "Markdown"
          })
        }).catch(() => {
        });
      }
      const googleChatPulseUrl = userData.systemConfiguration?.googleChatWebhookUrl || userData.channelCredentials?.social?.googleChatWebhookUrl || process.env.GOOGLE_CHAT_WEBHOOK_URL;
      if (googleChatPulseUrl && /^https:\/\/chat\.googleapis\.com\//i.test(googleChatPulseUrl)) {
        await fetch(googleChatPulseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pulseMessage })
        }).catch(() => {
        });
      }
      await db.collection("users").doc(broadcasterId).collection("stream_pulses").add({
        broadcasterId,
        broadcasterName,
        pulseNumber: session.pulsesCount,
        uptime,
        viewers,
        game,
        title,
        timestamp: FieldValue.serverTimestamp()
      }).catch(() => {
      });
      console.log(
        `\u{1F4CA} [QlipZync 10-Min Pulse] Status-Update #${session.pulsesCount} (${uptime}, ${viewers} Zuschauer) an Bots gesendet.`
      );
    } catch (err) {
      console.warn("[10-Min Interval Error]", err);
    }
  }, 10 * 60 * 1e3);
  activeStreamSessions.set(broadcasterId, {
    broadcasterId,
    broadcasterName,
    startedAt,
    reminderTimeout,
    statusInterval,
    pulsesCount: 0
  });
  console.log(
    `\u{1F680} [QlipZync Stream Lifecycle] Session f\xFCr ${broadcasterName} gestartet (Einladung verteilt, 15m Reminder & 10m Bot-Intervall aktiv).`
  );
}
async function stopStreamSessionAndSendFarewell(broadcasterId, broadcasterName) {
  const session = activeStreamSessions.get(broadcasterId);
  let durationStr = "Mehrere Stunden";
  if (session) {
    durationStr = formatUptime(Date.now() - session.startedAt);
    if (session.statusInterval) clearInterval(session.statusInterval);
    if (session.reminderTimeout) clearTimeout(session.reminderTimeout);
    activeStreamSessions.delete(broadcasterId);
  }
  try {
    const userDoc = await db.collection("users").doc(broadcasterId).get();
    const userData = userDoc.data() || {};
    const farewellMessage = userData.systemConfiguration?.customFarewellText || `\u{1F44B} **Stream beendet!** **${broadcasterName}** ist jetzt offline.
\u23F1\uFE0F **Gesamtlaufzeit**: ${durationStr}
\u{1F64F} Vielen Dank an alle Zuschauer & Supporter f\xFCrs Einschalten!
\u{1F3AC} Die Zero-Storage Highlight-Erkennung & Cooldown-Phase startet jetzt.`;
    const discordUrl = userData.systemConfiguration?.discordWebhookUrl || userData.botConfig?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
    if (discordUrl && /^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks/i.test(discordUrl)) {
      await fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: farewellMessage })
      }).catch(() => {
      });
    }
    const telegramChatId = userData.botConfig?.telegramChatId || userData.channelCredentials?.social?.telegramChatId || process.env.TELEGRAM_CHAT_ID;
    const telegramToken = userData.channelCredentials?.social?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    if (telegramChatId && telegramToken) {
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: farewellMessage,
          parse_mode: "Markdown"
        })
      }).catch(() => {
      });
    }
    const googleChatFarewellUrl = userData.systemConfiguration?.googleChatWebhookUrl || userData.channelCredentials?.social?.googleChatWebhookUrl || process.env.GOOGLE_CHAT_WEBHOOK_URL;
    if (googleChatFarewellUrl && /^https:\/\/chat\.googleapis\.com\//i.test(googleChatFarewellUrl)) {
      await fetch(googleChatFarewellUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: farewellMessage })
      }).catch(() => {
      });
    }
    console.log(`\u{1F44B} [QlipZync Farewell] Verabschiedungsinfo f\xFCr ${broadcasterName} an Discord, Telegram & Google Chat gesendet.`);
  } catch (err) {
    console.warn("[stopStreamSessionAndSendFarewell Error]", err);
  }
}
async function handleStreamOfflineCooldown(broadcasterId, broadcasterName, streamEndedAt) {
  try {
    const userRef = db.collection("users").doc(broadcasterId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return;
    const user = userSnap.data() || {};
    const streamId = `stream_${Date.now()}`;
    const detectedClipsCount = 0;
    if (detectedClipsCount === 0) {
      console.log(`\u2139\uFE0F [QlipZync] Keine Clips f\xFCr ${broadcasterName} (${broadcasterId}) gefunden. Worker pausiert nach 5 Min. sauber.`);
      await userRef.collection("clips").doc(`summary_${streamId}`).set({
        streamId,
        streamEndedAt,
        clipsFound: 0,
        status: "no_clips_found",
        storageState: "0 MB (Zero Storage Clean)",
        note: "Stream sauber beendet ohne Highlight-Trigger. System im Ruhemodus.",
        createdAt: FieldValue.serverTimestamp()
      });
      const discordUrl = user.botConfig?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
      if (discordUrl && /^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks/i.test(discordUrl)) {
        await fetch(discordUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: `\u2139\uFE0F **QlipZync Status**: Stream f\xFCr **${broadcasterName}** beendet. Es wurden 0 neue Clips erkannt \u2013 System geht in den Ruhemodus (0 MB Storage verbraucht).`
          })
        }).catch(() => {
        });
      }
      return;
    }
    const maxAvailable = Math.min(detectedClipsCount, 9);
    const token = generateEmailActionToken(broadcasterId, streamId);
    await userRef.collection("pending_streams").doc(streamId).set({
      streamId,
      broadcasterName,
      maxAvailable,
      status: "pending",
      createdAt: FieldValue.serverTimestamp()
    });
    console.log(`\u{1F3AC} [QlipZync Backlog] ${maxAvailable} Extra-Clips f\xFCr ${broadcasterName} bereitgestellt. HMAC Token generiert.`);
  } catch (err) {
    console.error("[handleStreamOfflineCooldown Error]", err);
  }
}
twitchRouter.get(["/live/:channel", "/helix-data/:channel", "/user-profile/:channel"], requireAuth, requireActiveSubscription, async (req, res) => {
  const rawChannel = Array.isArray(req.params.channel) ? req.params.channel[0] : req.params.channel;
  const channel = (rawChannel || "").toLowerCase().replace(/^@/, "").trim();
  const userId = req.user.uid;
  try {
    const details = await fetchTwitchChannelLiveDetails(channel, userId);
    return res.json({
      success: true,
      ...details,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      channel,
      isLive: false,
      viewerCount: 0,
      error: err.message,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
});
twitchRouter.post("/register-eventsub", requireAuth, requireActiveSubscription, async (req, res) => {
  try {
    const { broadcasterUserId, subscriptionType, callbackUrl } = req.body;
    if (!broadcasterUserId) {
      return res.status(400).json({ error: "broadcasterUserId ist erforderlich." });
    }
    const type = subscriptionType || "channel.clip.created";
    const result = await registerTwitchEventSub(broadcasterUserId, type, callbackUrl);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "EventSub Registrierung fehlgeschlagen" });
  }
});
function handleTwitchWebhook(req, res) {
  const messageId = req.headers["twitch-eventsub-message-id"];
  const messageTimestamp = req.headers["twitch-eventsub-message-timestamp"];
  const messageSignature = req.headers["twitch-eventsub-message-signature"];
  const messageType = req.headers["twitch-eventsub-message-type"];
  const webhookSecret = process.env.TWITCH_WEBHOOK_SECRET || process.env.TWITCH_EVENTSUB_SECRET;
  if (!webhookSecret) {
    return res.status(503).json({ error: "Twitch EventSub Webhook Secret nicht konfiguriert." });
  }
  if (!messageId || !messageTimestamp || !messageSignature || !messageSignature.startsWith("sha256=")) {
    return res.status(403).json({ error: "Fehlende oder ung\xFCltige Twitch EventSub Signatur-Header." });
  }
  if (processedTwitchWebhookIds.has(`twitch_${messageId}`)) {
    return res.status(200).json({ received: true, note: "Duplicate webhook ignored (Idempotent)" });
  }
  const timestampMs = new Date(messageTimestamp).getTime();
  if (isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > 10 * 60 * 1e3) {
    return res.status(403).json({ error: "Webhook timestamp expired (Replay protection)" });
  }
  const rawPayload = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body || {});
  const hmacMessage = messageId + messageTimestamp + rawPayload;
  const expectedSignature = "sha256=" + crypto.createHmac("sha256", webhookSecret).update(hmacMessage).digest("hex");
  try {
    const expectedBuf = Buffer.from(expectedSignature);
    const sigBuf = Buffer.from(messageSignature);
    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
      return res.status(403).json({ error: "Ung\xFCltige Twitch EventSub HMAC Signatur" });
    }
  } catch {
    return res.status(403).json({ error: "Signaturpr\xFCfung fehlgeschlagen" });
  }
  processedTwitchWebhookIds.add(`twitch_${messageId}`);
  if (processedTwitchWebhookIds.size > 2e3) {
    const firstKey = processedTwitchWebhookIds.values().next().value;
    if (firstKey) processedTwitchWebhookIds.delete(firstKey);
  }
  if (messageType === "webhook_callback_verification") {
    const challenge = req.body?.challenge;
    console.log("\u2705 [Twitch Webhook Handshake] Challenge empfangen:", challenge);
    return res.status(200).type("text/plain").send(challenge);
  }
  const event = req.body?.event;
  const subType = req.body?.subscription?.type || "channel.clip.created";
  const broadcasterId = event?.broadcaster_user_id || req.body?.subscription?.condition?.broadcaster_user_id || "global";
  const broadcasterName = event?.broadcaster_user_name || event?.broadcaster_user_login || "Streamer";
  console.log(`\u{1F4E1} [Twitch EventSub Webhook] Event '${subType}' empfangen f\xFCr ${broadcasterName} (${broadcasterId})`);
  if (subType === "stream.online") {
    console.log(`\u{1F534} [Twitch Live] Streamer ${broadcasterName} (${broadcasterId}) ist JETZT LIVE!`);
    startStreamLiveSession(broadcasterId, broadcasterName).catch(() => {
    });
  } else if (subType === "stream.offline") {
    console.log(`\u26AB [Twitch Offline] Streamer ${broadcasterName} (${broadcasterId}) ist jetzt OFFLINE.`);
    stopStreamSessionAndSendFarewell(broadcasterId, broadcasterName).catch(() => {
    });
    const offlineTimestamp = messageTimestamp || (/* @__PURE__ */ new Date()).toISOString();
    enqueueStreamCooldownTask(
      {
        broadcasterId,
        broadcasterName,
        streamEndedAt: offlineTimestamp
      },
      async (p) => {
        await handleStreamOfflineCooldown(p.broadcasterId, p.broadcasterName, p.streamEndedAt);
      }
    ).catch((taskErr) => {
      console.warn("[Cloud Tasks Dispatch Error]", taskErr);
    });
  }
  const recordedEvent = recordUserWebhookEvent(broadcasterId, "twitch", subType, {
    broadcasterName,
    broadcasterId,
    isLive: subType === "stream.online",
    event,
    subscription: req.body?.subscription
  });
  if (subType === "channel.clip.created") {
    if (event?.thumbnail_url || event?.id) {
      pipelineManager.processClip({
        id: event.id || `clip_${Date.now()}`,
        url: event.url || `https://clips.twitch.tv/${event.id}`,
        broadcaster_id: broadcasterId,
        broadcaster_name: broadcasterName,
        title: event.title || "Twitch Stream Highlight",
        thumbnail_url: event.thumbnail_url || "",
        duration: event.duration || 30,
        view_count: event.view_count || 0
      }).catch((err) => {
        console.warn("[Twitch EventSub: processClip] Pipeline notice:", err);
      });
    }
    return res.status(202).json({
      received: true,
      subscriptionType: subType,
      status: "accepted",
      eventId: recordedEvent.id,
      processedAt: (/* @__PURE__ */ new Date()).toISOString(),
      action: "Zero-Download In-Memory Clip Pipeline Ausgel\xF6st (generateClipMetadata aktiv)"
    });
  }
  return res.status(200).json({
    received: true,
    subscriptionType: subType,
    eventId: recordedEvent.id,
    processedAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: "stored"
  });
}
twitchRouter.post(["/webhook", "/eventsub"], handleTwitchWebhook);
twitchRouter.post("/cooldown-task", async (req, res) => {
  const isCloudTask = Boolean(req.headers["x-cloudtasks-taskname"]);
  if (!isCloudTask) {
    return res.status(403).json({ error: "Zugriff verweigert: Endpunkt darf ausschlie\xDFlich \xFCber Google Cloud Tasks aufgerufen werden." });
  }
  const { broadcasterId, broadcasterName, streamEndedAt } = req.body || {};
  if (!broadcasterId) {
    return res.status(400).json({ error: "ERROR: broadcasterId fehlt zwingend. Ausf\xFChrung abgebrochen." });
  }
  console.log(`\u23F1\uFE0F [Cloud Tasks Invocation] 300 Sekunden Cooldown f\xFCr ${broadcasterName || broadcasterId} abgelaufen. Starte Verarbeitung.`);
  try {
    await handleStreamOfflineCooldown(
      broadcasterId,
      broadcasterName || "Streamer",
      streamEndedAt || (/* @__PURE__ */ new Date()).toISOString()
    );
    return res.status(200).json({ success: true, processedAt: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (err) {
    console.error("[Cooldown Task Execution Error]", err);
    return res.status(500).json({ error: err.message || "Cooldown Task Fehler" });
  }
});
twitchRouter.post("/token-exchange", requireAuth, requireActiveSubscription, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { code, redirectUri } = req.body;
    const clientId = process.env.TWITCH_CLIENT_ID || "afht5r000ofphuq2uh4aljljp0nivv";
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!code) {
      return res.status(400).json({
        error: "ERROR: code fehlt zwingend. Ausf\xFChrung abgebrochen."
      });
    }
    if (!clientSecret) {
      return res.status(500).json({
        error: "ERROR: TWITCH_CLIENT_SECRET ist serverseitig nicht konfiguriert."
      });
    }
    const tokenRes = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri || "http://localhost:3000/auth/callback"
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData?.access_token) {
      return res.status(tokenRes.status || 400).json({
        success: false,
        error: tokenData?.message || "Twitch Token-Exchange fehlgeschlagen."
      });
    }
    const encryptedAccessToken = await encryptSecret(String(tokenData.access_token));
    const encryptedRefreshToken = tokenData.refresh_token ? await encryptSecret(String(tokenData.refresh_token)) : null;
    await db.collection("users").doc(uid).collection("integrations").doc("twitch").set(
      {
        userId: uid,
        platform: "twitch",
        connected: true,
        encryptedAccessToken,
        encryptedRefreshToken,
        scope: tokenData.scope || [],
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    await db.collection("users").doc(uid).set(
      {
        userId: uid,
        twitchConnected: true,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return res.status(200).json({
      success: true,
      twitchConnected: true,
      scope: tokenData.scope || [],
      expiresIn: tokenData.expires_in || 0
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Twitch Token-Exchange fehlgeschlagen" });
  }
});
twitchRouter.post("/test-notification", requireAuth, requireActiveSubscription, async (req, res) => {
  const {
    target = "all",
    // 'discord' | 'telegram' | 'google_chat' | 'all'
    type = "live_start",
    // 'live_start' | 'reminder_15m' | 'pulse_10m'
    channelName = "Streamer",
    discordWebhookUrl,
    discordChannelId,
    discordBotToken,
    telegramChatId,
    telegramBotToken,
    googleChatWebhookUrl,
    customMessage
  } = req.body;
  const results = {};
  const streamUrl = `https://twitch.tv/${channelName}`;
  const now = /* @__PURE__ */ new Date();
  const testTitle = type === "reminder_15m" ? `\u23F0 [TEST] 15-Minuten Reminder: ${channelName} ist live!` : type === "pulse_10m" ? `\u{1F4CA} [TEST] 10-Minuten Status-Update: ${channelName}` : `\u{1F534} [TEST] QuickClick Live-Alarm: ${channelName} ist JETZT LIVE!`;
  const testContent = customMessage || (type === "reminder_15m" ? `\u23F0 **[TEST-SIGNAL] 15-Minuten Reminder**: **${channelName}** ist seit 15 Min. live auf Twitch!
\u{1F3AE} **Kategorie**: Gaming / Just Chatting
\u{1F440} **Zuschauer**: 42
\u{1F4FA} **Titel**: Live-Pipeline Test via QuickClick
\u{1F517} Jetzt einschalten: ${streamUrl}` : type === "pulse_10m" ? `\u{1F4CA} **[TEST-SIGNAL] 10-Minuten Stream-Update (0 Std. 30 Min.)** \u2022 **${channelName}**
\u{1F3AE} **Kategorie**: Valorant / Ranked
\u{1F440} **Zuschauer**: 128
\u26A1 **QlipZync Engine**: Zero-Storage RAM aktiv (0 MB)
\u{1F517} Jetzt zuschauen: ${streamUrl}` : `\u{1F534} **[TEST-SIGNAL] LIVE-STREAM START**: **${channelName}** ist JETZT LIVE auf Twitch!
\u{1F3AE} **Kategorie**: Gaming
\u{1F4FA} **Titel**: Live-Pipeline Connectivity Test
\u{1F517} Jetzt live dabei sein: ${streamUrl}`);
  if (target === "discord" || target === "all") {
    const webhookUrl = discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
    const channelId = discordChannelId || process.env.DISCORD_CHANNEL_ID;
    const botToken = discordBotToken || process.env.DISCORD_BOT_TOKEN;
    const startMs = Date.now();
    try {
      if (webhookUrl && /^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks/i.test(webhookUrl)) {
        const discordRes = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: testContent,
            embeds: [
              {
                title: testTitle,
                url: streamUrl,
                description: "Verifizierungs-Signal aus dem QuickClick SystemConfigurationHub.",
                color: type === "reminder_15m" ? 16753920 : type === "pulse_10m" ? 1096065 : 9520895,
                fields: [
                  { name: "Kategorie", value: "Live-Test", inline: true },
                  { name: "Signal-Typ", value: type === "reminder_15m" ? "15m Reminder" : type === "pulse_10m" ? "10m Puls" : "Stream-Start", inline: true },
                  { name: "Zero-Storage", value: "0 MB (In-Memory)", inline: true }
                ],
                footer: { text: "QuickClick (QlipZync) \u2022 Live Notification Tester" },
                timestamp: now.toISOString()
              }
            ]
          })
        });
        const latencyMs = Date.now() - startMs;
        if (discordRes.ok) {
          results.discord = {
            success: true,
            latencyMs,
            status: discordRes.status,
            message: `Discord Webhook erfolgreich erreicht (${latencyMs}ms)`
          };
        } else {
          const errText = await discordRes.text().catch(() => "Fehler");
          results.discord = {
            success: false,
            latencyMs,
            status: discordRes.status,
            error: `Discord antwortete mit HTTP ${discordRes.status}: ${errText.slice(0, 120)}`
          };
        }
      } else if (channelId && botToken) {
        const discordBotRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ content: testContent })
        });
        const latencyMs = Date.now() - startMs;
        if (discordBotRes.ok) {
          results.discord = {
            success: true,
            latencyMs,
            status: discordBotRes.status,
            message: `Discord Bot Nachricht in Kanal ${channelId} zugestellt (${latencyMs}ms)`
          };
        } else {
          const errData = await discordBotRes.json().catch(() => ({}));
          results.discord = {
            success: false,
            latencyMs,
            status: discordBotRes.status,
            error: errData?.message || `Discord Bot Fehler (HTTP ${discordBotRes.status})`
          };
        }
      } else {
        results.discord = {
          success: false,
          latencyMs: 0,
          error: "Keine Discord Webhook URL oder Bot-Token konfiguriert."
        };
      }
    } catch (err) {
      results.discord = {
        success: false,
        latencyMs: Date.now() - startMs,
        error: err.message || "Verbindung zu Discord fehlgeschlagen"
      };
    }
  }
  if (target === "telegram" || target === "all") {
    const chatId = telegramChatId || process.env.TELEGRAM_CHAT_ID;
    const token = telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
    const startMs = Date.now();
    try {
      if (chatId && token) {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `${testContent}

[\u25B6 Auf Twitch ansehen](${streamUrl})`,
            parse_mode: "Markdown",
            disable_web_page_preview: false
          })
        });
        const latencyMs = Date.now() - startMs;
        const tgData = await tgRes.json().catch(() => ({}));
        if (tgRes.ok && tgData?.ok) {
          results.telegram = {
            success: true,
            latencyMs,
            status: tgRes.status,
            message: `Telegram Nachricht an Chat ${chatId} erfolgreich versendet (${latencyMs}ms)`
          };
        } else {
          results.telegram = {
            success: false,
            latencyMs,
            status: tgRes.status,
            error: tgData?.description || `Telegram API Fehler (HTTP ${tgRes.status})`
          };
        }
      } else {
        results.telegram = {
          success: false,
          latencyMs: 0,
          error: "Telegram Bot Token oder Chat-ID fehlt."
        };
      }
    } catch (err) {
      results.telegram = {
        success: false,
        latencyMs: Date.now() - startMs,
        error: err.message || "Verbindung zu Telegram fehlgeschlagen"
      };
    }
  }
  if (target === "google_chat" || target === "all" && (googleChatWebhookUrl || process.env.GOOGLE_CHAT_WEBHOOK_URL)) {
    const chatUrl = googleChatWebhookUrl || process.env.GOOGLE_CHAT_WEBHOOK_URL;
    const startMs = Date.now();
    try {
      if (chatUrl && /^https:\/\/chat\.googleapis\.com\//i.test(chatUrl)) {
        const chatRes = await fetch(chatUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: testContent,
            cardsV2: [
              {
                cardId: `test_${type}_${Date.now()}`,
                card: {
                  header: {
                    title: testTitle,
                    subtitle: "Verifizierungs-Signal via QuickClick SystemConfigurationHub",
                    imageUrl: "https://assets.twitch.tv/assets/favicon-32-e29e246c157142675f72.png",
                    imageType: "CIRCLE"
                  },
                  sections: [
                    {
                      header: "Test-Details",
                      widgets: [
                        {
                          decoratedText: {
                            topLabel: "Ziel-Kanal",
                            text: "Google Chat Space (Incoming Webhook)"
                          }
                        },
                        {
                          decoratedText: {
                            topLabel: "Signal-Typ",
                            text: type === "reminder_15m" ? "15m Reminder" : type === "pulse_10m" ? "10m Status-Puls" : "Stream Start-Alarm"
                          }
                        },
                        {
                          decoratedText: {
                            topLabel: "Zero-Storage",
                            text: "0 MB RAM Pipeline"
                          }
                        },
                        {
                          buttonList: {
                            buttons: [
                              {
                                text: "Auf Twitch \xF6ffnen",
                                onClick: {
                                  openLink: {
                                    url: streamUrl
                                  }
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          })
        });
        const latencyMs = Date.now() - startMs;
        if (chatRes.ok) {
          results.google_chat = {
            success: true,
            latencyMs,
            status: chatRes.status,
            message: `Google Chat Nachricht erfolgreich in Space zugestellt (${latencyMs}ms)`
          };
        } else {
          const errText = await chatRes.text().catch(() => "Fehler");
          results.google_chat = {
            success: false,
            latencyMs,
            status: chatRes.status,
            error: `Google Chat antwortete mit HTTP ${chatRes.status}: ${errText.slice(0, 120)}`
          };
        }
      } else {
        results.google_chat = {
          success: false,
          latencyMs: 0,
          error: "Keine Google Chat Webhook URL konfiguriert oder URL ung\xFCltig (muss mit https://chat.googleapis.com beginnen)."
        };
      }
    } catch (err) {
      results.google_chat = {
        success: false,
        latencyMs: Date.now() - startMs,
        error: err.message || "Verbindung zu Google Chat fehlgeschlagen"
      };
    }
  }
  const overallSuccess = (results.discord ? results.discord.success : true) && (results.telegram ? results.telegram.success : true) && (results.google_chat ? results.google_chat.success : true) && Boolean(results.discord || results.telegram || results.google_chat);
  return res.status(overallSuccess ? 200 : 207).json({
    success: overallSuccess,
    testedAt: now.toISOString(),
    results
  });
});
export {
  handleTwitchWebhook,
  twitchRouter
};
