import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Zap,
  Moon,
  Radio,
  Share2,
  Bot,
  HeartHandshake,
  Film,
  ShieldCheck,
  CheckCircle2,
  Tv,
  FileSpreadsheet,
  Trash2,
  Clock,
  Sparkles,
  ExternalLink,
  Settings2,
  Check,
  Copy,
  AlertTriangle,
  ArrowRight,
  Database,
  RefreshCw,
  Terminal,
  Gift,
  Sliders,
  Users,
  Award,
  Layers,
  TrendingUp,
  Lock,
  Crown,
  Key,
  Unlink,
  Trophy,
} from 'lucide-react';
import {
  StreamerUser,
  QuickClickSettings,
  GoogleSheetsRow,
  SubscriptionPlan,
  SocialChannelsTier,
  ProgressiveTierLevel,
} from '../../types/pipeline';
import { ClipPacksModal } from '../modals/ClipPacksModal';
import {
  calculateGoogleSystemCostsAndFairProfit,
  FREE_STARTER_PLAN,
} from '../../utils/pricingCalculator';
import { DynamicPricingCalculator } from '../monetization/DynamicPricingCalculator';
import { UsageAnalytics } from './UsageAnalytics';
import { ReferralHub } from '../modals/ReferralHub';
import { TopReferrersLeaderboard } from './TopReferrersLeaderboard';
import { GdprPrivacyAuditModal } from '../modals/GdprPrivacyAuditModal';
import { PipelineVisualSequence } from '../landing/PipelineVisualSequence';
import { ChannelSetupWizard } from '../modals/ChannelSetupWizard';
import { SystemConfigurationHub } from '../modals/SystemConfigurationHub';
import { AdminProfitMatrix } from './AdminProfitMatrix';
import { ByokSettingsModal } from '../modals/ByokSettingsModal';
import { GoogleWorkspaceHub } from '../modals/GoogleWorkspaceHub';
import { LiveIntegrationsDashboard } from './LiveIntegrationsDashboard';
import { RealtimeStatusPulse } from './RealtimeStatusPulse';
import { EphemeralMemoryShmWidget } from './EphemeralMemoryShmWidget';
import { syncUserToFirestore, auth } from '../../lib/firebase';
import {
  fetchIntegrationsLiveStatus,
  fetchLiveSheetsRows,
  fetchUserWebhookEvents,
  provisionGoogleSheets,
  openOAuthConnectPopup,
  disconnectOAuthAccount,
  IntegrationStatusPayload,
  GoogleSheetsLiveRowItem,
  UserWebhookEventItem,
} from '../../lib/accountIntegrationsApi';

interface StreamerDashboardProps {
  user: StreamerUser;
  onLogout: () => void;
  onGoToLanding?: () => void;
  onUpdateUser?: (user: StreamerUser) => void;
  onUpgradePlan?: (plan: SubscriptionPlan) => void;
  onStartTrial?: () => void;
  onOpenImpressum?: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenAvv?: () => void;
  onOpenCookieSettings?: () => void;
}

export type DashboardTab =
  | 'quickclick'
  | 'endpoints'
  | 'workspace'
  | 'modules'
  | 'analytics'
  | 'referrals'
  | 'logs'
  | 'admin';

export const StreamerDashboard: React.FC<StreamerDashboardProps> = ({
  user,
  onLogout,
  onGoToLanding,
  onUpdateUser,
  onUpgradePlan,
  onStartTrial,
  onOpenImpressum,
  onOpenPrivacy,
  onOpenTerms,
  onOpenAvv,
  onOpenCookieSettings,
}) => {
  const [isClipPacksModalOpen, setIsClipPacksModalOpen] = useState<boolean>(false);
  const [isGdprModalOpen, setIsGdprModalOpen] = useState<boolean>(false);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [isByokModalOpen, setIsByokModalOpen] = useState<boolean>(false);
  const [isTrialCancelConfirmOpen, setIsTrialCancelConfirmOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('quickclick');

  // Real Integration Status from Backend
  const [liveStatus, setLiveStatus] = useState<IntegrationStatusPayload>({
    twitch: {
      connected: Boolean(user.channelName),
      channelName: user.channelName || null,
      displayName: user.name || null,
      avatarUrl: user.avatarUrl || null,
      isLive: user.isLive,
      viewerCount: 0,
      game: user.game || null,
      title: null,
    },
    google: {
      connected: Boolean(user.googleSheetId),
      spreadsheetId: user.googleSheetId || null,
      spreadsheetUrl: user.googleSheetUrl || null,
    },
    discord: {
      connected: false,
      webhookConfigured: false,
    },
  });

  // Real Google Sheets Rows
  const [liveRows, setLiveRows] = useState<GoogleSheetsLiveRowItem[]>([]);
  const [isRowsLoading, setIsRowsLoading] = useState<boolean>(false);
  const [isProvisioningSheet, setIsProvisioningSheet] = useState<boolean>(false);

  // Real Webhook Events
  const [webhookEvents, setWebhookEvents] = useState<UserWebhookEventItem[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState<boolean>(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState<boolean>(false);

  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const userRef = useRef(user);
  userRef.current = user;

  // Fetch real data from server using authentic Firebase Auth ID token
  const loadRealData = useCallback(async () => {
    setIsRefreshingStatus(true);
    try {
      const currentUser = userRef.current;
      const uid = auth.currentUser?.uid || currentUser.id || currentUser.channelName || 'streamer_user';
      const [statusData, rowsData, eventsData] = await Promise.all([
        fetchIntegrationsLiveStatus(uid),
        fetchLiveSheetsRows(uid),
        fetchUserWebhookEvents(uid),
      ]);

      setLiveStatus(statusData);
      setLiveRows(rowsData || []);
      setWebhookEvents(eventsData || []);
    } catch (err) {
      console.error('[QuickClick Dashboard] Fehler beim Laden der Live-Daten:', err);
    } finally {
      setIsRefreshingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadRealData();
    const interval = setInterval(loadRealData, 30000); // 30s Polling for live status
    return () => clearInterval(interval);
  }, [loadRealData]);

  // Automatische System-Konfigurations-Pop-up nach Registrierung auf dem persöhnlichen Dashboard
  useEffect(() => {
    const shouldAutoStart =
      sessionStorage.getItem('quickclick_auto_open_config') === 'true' ||
      (!user.isFullyConfigured && !sessionStorage.getItem('quickclick_config_dismissed'));

    if (shouldAutoStart) {
      sessionStorage.removeItem('quickclick_auto_open_config');
      const timer = setTimeout(() => {
        setIsWizardOpen(true);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [user.isFullyConfigured]);

  // Handle Sheet Provisioning
  const handleProvisionSheet = async () => {
    setIsProvisioningSheet(true);
    setActionNotice(null);
    try {
      const channel = user.channelName || user.name || 'streamer';
      const result = await provisionGoogleSheets(channel, user.id);
      if (result.success && result.spreadsheetId) {
        setActionNotice(`✅ Google Sheet erfolgreich erstellt: "${result.title || 'QuickClick Log'}"`);
        const updated: StreamerUser = {
          ...user,
          googleSheetId: result.spreadsheetId,
          googleSheetUrl: result.spreadsheetUrl,
        };
        onUpdateUser?.(updated);
        syncUserToFirestore(updated);
        await loadRealData();
      } else {
        setActionNotice(`❌ Fehler bei Bereitstellung: ${result.error || 'Google OAuth erforderlich'}`);
      }
    } catch (err: any) {
      setActionNotice(`❌ Fehler: ${err.message}`);
    } finally {
      setIsProvisioningSheet(false);
      setTimeout(() => setActionNotice(null), 6000);
    }
  };

  // 14-Tage Basic-Abo Testphase Logik
  const trialDaysRemaining = useMemo(() => {
    if (!user.trialEndsAt) return 14;
    const diffMs = new Date(user.trialEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [user.trialEndsAt]);

  const handleCancelTrial = async () => {
    const downgradedUser: StreamerUser = {
      ...user,
      trialActive: false,
      trialCancelled: true,
      trialConvertedToPaid: false,
      plan: 'free',
      hasActiveSubscription: true,
      clipsLimitTotal: 30,
      apiCallsLimit: 300,
      modularConfig: FREE_STARTER_PLAN,
    };
    onUpdateUser?.(downgradedUser);
    await syncUserToFirestore(downgradedUser);
    setIsTrialCancelConfirmOpen(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 1800);
  };

  // QuickClick Pipeline Configurations
  const [config, setConfig] = useState<QuickClickSettings>({
    socialInvites: {
      xTwitter: true,
      tikTok: true,
      instagram: false,
      threads: true,
      youtubeShorts: true,
      customMessage: '🔴 Wir sind JETZT LIVE! Kommt rein & lasst Liebe da! 🔥',
      appendGameName: true,
      appendTwitchUrl: true,
      sendTwentyMinReminder: true,
      customReminderMessage: '⏰ REMINDER: Wir sind immer noch LIVE! Jetzt einschalten! 🔥',
      distributeToAllConnected: true,
    },
    botSync: {
      discordWebhook: true,
      discordWebhookUrl: 'https://discord.com/api/webhooks/quickclick-live-feed',
      telegramBot: true,
      telegramChatId: '@pixelvortex_community',
      pingRole: '@everyone',
      embedColor: '#9146FF',
      includeThumbnail: true,
      sendLiveUpdatesDuringStream: true,
      intervalMinutes: 10,
      liveUpdateMessage: '🎮 Live-Update: Neue Runde gestartet!',
      sendFarewellOnOffline: true,
      farewellMessage: '👋 Stream beendet! Vielen Dank an alle Zuschauer fürs Einschalten!',
    },
    communityOutro: {
      sendFarewell: true,
      thankRaiders: true,
      postStreamStats: true,
      discordOutroMessage: '🏁 Stream beendet! Danke an alle Zuschauer & Raider! Bis zum nächsten Mal!',
      telegramOutroMessage: 'GGs! Stream ist offline. Schaut euch die Highlights an! ❤️',
      nextStreamDate: 'Morgen um 18:00 Uhr',
    },
    zeroStorageClip: {
      waitForMinutes: 5,
      autoFetchClips: true,
      aiSmartCrop9x16: true,
      uploadToTikTok: true,
      uploadToShorts: true,
      uploadToInstagramReels: false,
      deleteMp4ImmediatelyAfterUpload: true,
      syncToGoogleSheets: true,
      googleSheetName: 'QuickClick_Clips_Master',
    },
    healthAgent: {
      deduplicationLock: true,
      signatureVerification: true,
      autoRetryFailedSteps: true,
      maxRetries: 3,
      alertOnFailure: true,
      memoryLeakProtector: true,
    },
  });

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300">
      {/* Top Streamer Profile & Live Helix Status Bar (Synchronized Purple Theme) */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-[#140831] via-[#0c0622] to-[#12082f] p-6 shadow-2xl shadow-purple-950/40 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        {/* Subtle Wave Glow Background Ambient */}
        <div className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-purple-600/15 blur-2xl animate-wave-pulse" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 rounded-full bg-fuchsia-600/10 blur-xl" aria-hidden="true" />

        {/* Streamer Info */}
        <div className="flex items-center gap-4 relative z-10">
          <div className="relative">
            {liveStatus.twitch.avatarUrl || user.avatarUrl ? (
              <img
                src={liveStatus.twitch.avatarUrl || user.avatarUrl}
                alt={liveStatus.twitch.displayName || user.name}
                className="h-16 w-16 rounded-2xl border-2 border-purple-400/60 object-cover shadow-lg shadow-purple-950/50"
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl border-2 border-purple-500/40 bg-purple-950/40 flex items-center justify-center text-purple-300">
                <Tv className="h-8 w-8" />
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#0c0622] ${
                liveStatus.twitch.isLive ? 'bg-red-500 animate-pulse' : 'bg-purple-900'
              }`}
              title={liveStatus.twitch.isLive ? 'Live auf Twitch' : 'Offline'}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white">
                {liveStatus.twitch.displayName || user.name}
              </h2>
              {liveStatus.twitch.connected ? (
                <span className="rounded-full bg-[#9146FF]/15 border border-[#9146FF]/40 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 flex items-center gap-1 shadow-sm">
                  <Tv className="h-3 w-3 text-[#9146FF]" />
                  <span>Twitch Verbunden</span>
                </span>
              ) : (
                <button
                  onClick={() => openOAuthConnectPopup('twitch', user.id, user.channelName || user.name, loadRealData)}
                  className="rounded-full bg-purple-500/15 border border-purple-500/40 px-2.5 py-0.5 text-[10px] font-bold text-purple-300 hover:bg-purple-500/25 transition flex items-center gap-1 cursor-pointer"
                >
                  <Tv className="h-3 w-3" />
                  <span>Twitch verbinden</span>
                </button>
              )}
            </div>
            <p className="text-xs text-purple-200/70 mt-0.5">
              {liveStatus.twitch.channelName ? (
                <>
                  Kanal: <code className="text-purple-300 font-mono bg-purple-950/50 px-1 py-0.5 rounded border border-purple-500/30">twitch.tv/{liveStatus.twitch.channelName}</code>
                  {liveStatus.twitch.game && <span> • Spiel: <span className="text-zinc-200">{liveStatus.twitch.game}</span></span>}
                </>
              ) : (
                <span className="text-zinc-500">Noch kein Twitch-Kanal verknüpft</span>
              )}
            </p>
          </div>
        </div>

        {/* Live Stream Status & Zero-Storage Metric */}
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          {/* Live Status Box */}
          <div className="rounded-xl border border-purple-500/25 bg-[#09041d]/85 p-3 flex items-center gap-3 shadow-inner">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                liveStatus.twitch.isLive
                  ? 'border-red-500/30 bg-red-950/40 text-red-400 animate-pulse'
                  : 'border-purple-500/30 bg-purple-950/40 text-purple-400'
              }`}
            >
              {liveStatus.twitch.isLive ? <Radio className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </div>
            <div>
              <div className="text-[10px] font-semibold text-purple-300/80 uppercase tracking-wider">
                Twitch Live-Status
              </div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>{liveStatus.twitch.isLive ? '🔴 LIVE auf Twitch' : '💤 Offline'}</span>
                {liveStatus.twitch.isLive && liveStatus.twitch.viewerCount > 0 && (
                  <span className="text-[11px] font-mono text-purple-300">({liveStatus.twitch.viewerCount} Zuschauer)</span>
                )}
              </div>
            </div>
          </div>

          {/* Zero-Storage Status */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-950/30 p-3 flex items-center gap-3 shadow-inner">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
              <Trash2 className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-purple-300 uppercase tracking-wider">
                Permanenter Speicher
              </div>
              <div className="text-xs font-bold text-white font-mono flex items-center gap-1">
                <span>0,00 MB (100% Frei)</span>
                <CheckCircle2 className="h-3.5 w-3.5 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Real-time Status Pulse Indicator (Driven by /api/health heartbeat) */}
          <RealtimeStatusPulse />

          {/* System Configuration Button */}
          <button
            type="button"
            onClick={() => setIsWizardOpen(true)}
            className="rounded-xl border border-purple-500/40 bg-purple-950/50 hover:bg-purple-900/70 px-3.5 py-2.5 text-xs font-bold text-purple-200 transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-purple-950/40"
            title="APIs, Webhooks, OBS & Kontoverbindungen bearbeiten"
          >
            <Settings2 className="h-4 w-4 text-purple-400" />
            <span className="hidden sm:inline">Konfiguration</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadRealData}
            disabled={isRefreshingStatus}
            className="rounded-xl border border-purple-500/30 bg-purple-950/30 p-2.5 text-purple-300 hover:text-white hover:bg-purple-900/50 transition cursor-pointer"
            title="Live-Daten von Twitch & Google aktualisieren"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshingStatus ? 'animate-spin text-purple-400' : ''}`} />
          </button>

          {/* Logout button */}
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-purple-500/30 bg-purple-950/30 px-3.5 py-2.5 text-xs font-semibold text-purple-200 hover:text-white hover:bg-purple-900/50 transition cursor-pointer"
          >
            Abmelden
          </button>
        </div>
      </div>

      {/* Action Notice Toast */}
      {actionNotice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-xs font-bold text-emerald-300 flex items-center justify-between shadow-lg">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-zinc-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Subscription Tier Banner */}
      {(() => {
        const displayTierName =
          user.modularConfig?.tierName ||
          (user.plan === 'free'
            ? '0,00 € Dauerhafter Free Starter'
            : user.plan === 'elite'
            ? 'Stufe 5 • Titan'
            : user.plan === 'pro'
            ? 'Stufe 3 • Pro Grow'
            : user.plan === 'basic'
            ? 'Stufe 2 • Basic'
            : 'Stufe 1 • Starter');
        const baseClips = user.clipsLimitTotal || 30;
        const bonusClips = user.bonusClips || 0;
        const extraPacks = user.extraPacksPurchased || 0;
        const totalEffectiveClips = baseClips + bonusClips + extraPacks;
        const socialCount =
          user.modularConfig?.socialChannelsCount ||
          (user.plan === 'free' ? 1 : user.plan === 'elite' ? 5 : user.plan === 'pro' ? 3 : user.plan === 'basic' ? 2 : 1);

        return (
          <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-[#130830]/95 via-[#0c0622]/95 to-[#150935]/95 p-5 space-y-4 shadow-2xl shadow-purple-950/30 relative overflow-hidden">
            {/* Ambient subtle glow */}
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-purple-600/10 blur-xl" aria-hidden="true" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-300/80">
                  Dein Cloud-Abonnement:
                </span>
                <span
                  className="rounded-xl px-3 py-1 text-xs font-extrabold flex items-center gap-1.5 bg-purple-500/20 text-purple-200 border border-purple-500/40 shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" />
                  <span>{displayTierName}</span>
                </span>

                <span className="text-[11px] text-purple-200/70">
                  ({baseClips} Clips/Mo • Connect {socialCount} Social-Media • 0 MB lokal)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {user.plan === 'free' && (
                  <button
                    onClick={() => setActiveTab('modules')}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-fuchsia-500 text-white px-3.5 py-2.5 text-xs font-black transition active:scale-95 cursor-pointer shadow-lg shadow-purple-600/30 min-h-[40px]"
                  >
                    <Zap className="h-4 w-4 fill-current text-amber-300" />
                    <span>Auf Stufen 1–5 upgraden</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveTab('endpoints')}
                  className="flex items-center gap-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/35 px-3.5 py-2.5 text-xs font-bold text-purple-200 transition active:scale-95 cursor-pointer min-h-[40px]"
                >
                  <Tv className="h-4 w-4 text-purple-400" />
                  <span>Konto-Verknüpfungen</span>
                </button>

                <button
                  onClick={() => setIsByokModalOpen(true)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition active:scale-95 cursor-pointer min-h-[40px] ${
                    user.byokConfig?.enabled
                      ? 'bg-purple-600/20 text-purple-200 border-purple-500/50 hover:bg-purple-600/30'
                      : 'bg-[#10072b] hover:bg-[#1a0c44] border-purple-500/30 text-purple-200'
                  }`}
                  title="Eigene Gemini & Google Drive Keys"
                >
                  <Key className="h-4 w-4 text-purple-400" />
                  <span>{user.byokConfig?.enabled ? 'BYOK Aktiv' : 'BYOK Keys'}</span>
                </button>
              </div>
            </div>

            {/* Quota Progress Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 relative z-10">
              <div className="space-y-1.5 rounded-xl border border-purple-500/25 bg-[#09041d]/85 p-3 shadow-inner">
                <div className="flex justify-between text-xs">
                  <span className="text-purple-200 font-semibold flex items-center gap-1.5">
                    <Film className="h-3.5 w-3.5 text-purple-400" />
                    <span>Clip-Kontingent diesen Monat:</span>
                  </span>
                  <span className="font-mono font-bold text-white">
                    {user.clipsUsedThisMonth} / {totalEffectiveClips} Clips
                  </span>
                </div>
                <div className="w-full h-2 bg-purple-950/80 border border-purple-500/20 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      (user.clipsUsedThisMonth || 0) >= totalEffectiveClips
                        ? 'bg-red-500'
                        : (user.clipsUsedThisMonth || 0) / totalEffectiveClips > 0.8
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-400'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.round(((user.clipsUsedThisMonth || 0) / totalEffectiveClips) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-purple-500/25 bg-[#09041d]/85 p-3 shadow-inner">
                <div className="flex justify-between text-xs">
                  <span className="text-purple-200 font-semibold flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-purple-400" />
                    <span>Google Sheets Log:</span>
                  </span>
                  <span className="font-mono font-bold text-purple-200">
                    {liveStatus.google.connected ? 'Verbunden' : 'Nicht verknüpft'}
                  </span>
                </div>
                <div className="text-[11px] text-purple-300/80 truncate">
                  {liveStatus.google.spreadsheetId ? (
                    <a
                      href={liveStatus.google.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${liveStatus.google.spreadsheetId}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-300 hover:text-fuchsia-300 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Tabelle auf Drive öffnen</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span>Keine Tabelle hinterlegt</span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-purple-500/25 bg-[#09041d]/85 p-3 shadow-inner">
                <div className="flex justify-between text-xs">
                  <span className="text-purple-200 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                    <span>EventSub Webhooks:</span>
                  </span>
                  <span className="font-mono font-bold text-purple-300">Aktiv</span>
                </div>
                <div className="text-[11px] text-purple-300/80">
                  {webhookEvents.length} Events empfangen
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Real-time Ephemeral Memory /dev/shm Widget (Live Telemetry Stream) */}
      <EphemeralMemoryShmWidget />

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          {onGoToLanding && (
            <button
              onClick={onGoToLanding}
              className="flex items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 px-3 py-2 min-h-[44px] text-xs font-bold text-purple-200 hover:text-white transition cursor-pointer shrink-0 shadow-sm"
              title="Zurück zur Startseite wechseln"
            >
              <Tv className="h-3.5 w-3.5 text-fuchsia-400" />
              <span>Zur Startseite</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('quickclick')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'quickclick'
                ? 'bg-emerald-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>QuickClick Pipeline</span>
          </button>

          <button
            onClick={() => setActiveTab('endpoints')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'endpoints'
                ? 'bg-emerald-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <Tv className="h-4 w-4 text-purple-400" />
            <span>Konten & Endpunkte</span>
          </button>

          <button
            onClick={() => setActiveTab('workspace')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'workspace'
                ? 'bg-emerald-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>Google Workspace & Sheets ({liveRows.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('modules')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'modules'
                ? 'bg-emerald-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4 text-cyan-300" />
            <span>Clip-Kontingent & Top-up</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'analytics'
                ? 'bg-emerald-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span>Usage Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('referrals')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'referrals'
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-zinc-950 shadow-lg shadow-amber-500/20'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            <span>🏆 Referrals & Leaderboard ({user.referralCount || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-bold transition cursor-pointer shrink-0 ${
              activeTab === 'logs'
                ? 'bg-emerald-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span>Webhooks ({webhookEvents.length})</span>
          </button>

          {(user.isAdmin || user.email === 'robert.f.telekom@gmail.com') && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === 'admin'
                  ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20'
                  : 'text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              <span>👑 Admin-Gewinne</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW: QuickClick System Pipeline Config */}
      {activeTab === 'quickclick' && (
        <div className="space-y-6">
          <PipelineVisualSequence />

          {/* Connected Accounts Quick Status Cards (Synchronized Purple Theme) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Twitch Channel Card */}
            <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#140833]/90 via-[#0c0522]/95 to-[#09041a] p-5 space-y-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-sm">
                    <Tv className="h-5 w-5 text-purple-300" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Twitch Kanal</h4>
                    <p className="text-[11px] text-purple-200/70">Helix API & EventSub</p>
                  </div>
                </div>
                {liveStatus.twitch.connected ? (
                  <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2.5 py-0.5 text-[10px] font-bold text-purple-200">
                    Verbunden
                  </span>
                ) : (
                  <span className="rounded-full bg-purple-950/80 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold text-purple-300/70">
                    Getrennt
                  </span>
                )}
              </div>

              {liveStatus.twitch.connected ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-purple-500/20">
                    <span className="text-purple-200/70">Kanalname:</span>
                    <span className="font-bold text-white">{liveStatus.twitch.channelName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-purple-500/20">
                    <span className="text-purple-200/70">Status:</span>
                    <span className={`font-bold ${liveStatus.twitch.isLive ? 'text-red-400 animate-pulse' : 'text-purple-300/70'}`}>
                      {liveStatus.twitch.isLive ? '🔴 Live Stream' : 'Offline'}
                    </span>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => setActiveTab('endpoints')}
                      className="w-full rounded-xl bg-purple-950/70 hover:bg-purple-900 border border-purple-500/30 text-purple-200 py-2 text-xs font-semibold transition"
                    >
                      Kanal-Details anzeigen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-purple-200/70">
                    Verbinde deinen Twitch-Kanal, um automatische Live-Erkennung und Clip-Pipelines zu aktivieren.
                  </p>
                  <button
                    onClick={() => openOAuthConnectPopup('twitch', user.id, user.channelName || user.name, loadRealData)}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
                  >
                    <Tv className="h-4 w-4" />
                    <span>Twitch autorisieren</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2. Google Workspace & Drive Sheets Card */}
            <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#140833]/90 via-[#0c0522]/95 to-[#09041a] p-5 space-y-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-sm">
                    <FileSpreadsheet className="h-5 w-5 text-purple-300" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Google Sheets</h4>
                    <p className="text-[11px] text-purple-200/70">Drive API v3 & Sheets v4</p>
                  </div>
                </div>
                {liveStatus.google.connected ? (
                  <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2.5 py-0.5 text-[10px] font-bold text-purple-200">
                    Bereitgestellt
                  </span>
                ) : (
                  <span className="rounded-full bg-purple-950/80 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold text-purple-300/70">
                    Nicht geklont
                  </span>
                )}
              </div>

              {liveStatus.google.connected ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-purple-500/20">
                    <span className="text-purple-200/70">Protokollierte Zeilen:</span>
                    <span className="font-bold text-white">{liveRows.length} Clips</span>
                  </div>
                  <div className="pt-2 flex flex-col gap-2">
                    <a
                      href={liveStatus.google.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${liveStatus.google.spreadsheetId}/edit`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/35 text-purple-200 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <span>Auf Google Drive öffnen</span>
                      <ExternalLink className="h-3.5 w-3.5 text-purple-300" />
                    </a>
                    <button
                      onClick={() => setActiveTab('workspace')}
                      className="w-full rounded-xl bg-purple-950/70 hover:bg-purple-900 border border-purple-500/30 text-purple-200 py-2 text-xs font-semibold transition"
                    >
                      Zeilen im Dashboard anzeigen
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-purple-200/70">
                    Dupliziere die Master-Vorlage mit 1-Klick in deine persönliche Google Drive.
                  </p>
                  <button
                    onClick={handleProvisionSheet}
                    disabled={isProvisioningSheet}
                    className="w-full rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-fuchsia-500 text-white py-2.5 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{isProvisioningSheet ? 'Kopiere Vorlage...' : 'Vorlage in Drive duplizieren'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. Community Bots Card */}
            <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#140833]/90 via-[#0c0522]/95 to-[#09041a] p-5 space-y-4 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-sm">
                    <Bot className="h-5 w-5 text-purple-300" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Discord & Telegram</h4>
                    <p className="text-[11px] text-purple-200/70">Pipeline 2 Bots</p>
                  </div>
                </div>
                <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2.5 py-0.5 text-[10px] font-bold text-purple-200">
                  Aktiv
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-purple-500/20">
                  <span className="text-purple-200/70">Discord Live-Feed:</span>
                  <span className="font-mono text-purple-300 font-semibold">Konfiguriert</span>
                </div>
                <div className="flex justify-between py-1 border-b border-purple-500/20">
                  <span className="text-purple-200/70">Zero-Storage RAM:</span>
                  <span className="font-mono text-white">0,00 MB</span>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab('endpoints')}
                    className="w-full rounded-xl bg-purple-950/70 hover:bg-purple-900 border border-purple-500/30 text-purple-200 py-2 text-xs font-semibold transition"
                  >
                    Bot-Endpunkte konfigurieren
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Endpoints & Connected Accounts Hub */}
      {activeTab === 'endpoints' && (
        <div className="space-y-6">
          <LiveIntegrationsDashboard user={user} onUpdateUser={onUpdateUser} />
        </div>
      )}

      {/* VIEW: Google Workspace & Sheets Hub (Unified Live Table & Master Doc Sync) */}
      {activeTab === 'workspace' && (
        <div className="space-y-6">
          <GoogleWorkspaceHub user={user} isOpen={true} />

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Google Sheets Auto-Sync: QuickClick Master Clip Log
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Live-Dokumentation aller erfolgreichen Social Media Postings (TikTok, X, YouTube Shorts).
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {liveStatus.google.spreadsheetUrl && (
                  <a
                    href={liveStatus.google.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-3.5 py-1.5 text-xs font-bold shadow transition cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Auf Google Drive öffnen</span>
                  </a>
                )}
                <button
                  onClick={loadRealData}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Aktualisieren</span>
                </button>
              </div>
            </div>

            {/* Zero Mock Data Table Render */}
            {liveRows.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 bg-zinc-900 text-zinc-400 font-mono text-[11px]">
                    <tr>
                      <th className="p-3">Zeitstempel</th>
                      <th className="p-3">Clip-Titel</th>
                      <th className="p-3">Spiel</th>
                      <th className="p-3">Dauer</th>
                      <th className="p-3">TikTok Link</th>
                      <th className="p-3">X Post Link</th>
                      <th className="p-3">YouTube Shorts</th>
                      <th className="p-3">Temp-MP4 Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-sans">
                    {liveRows.map((row) => (
                      <tr key={row.id} className="hover:bg-zinc-900/40 transition">
                        <td className="p-3 text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                          {row.timestamp}
                        </td>
                        <td className="p-3 font-semibold text-white">
                          {row.clipTitle}
                        </td>
                        <td className="p-3 text-zinc-300">{row.game}</td>
                        <td className="p-3 text-zinc-400 font-mono">{row.durationSec}s</td>
                        <td className="p-3">
                          {row.tiktokUrl ? (
                            <a
                              href={row.tiktokUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-mono text-[11px]"
                            >
                              <span>TikTok</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {row.xPostUrl ? (
                            <a
                              href={row.xPostUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sky-400 hover:underline font-mono text-[11px]"
                            >
                              <span>X.com</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {row.shortsUrl ? (
                            <a
                              href={row.shortsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-rose-400 hover:underline font-mono text-[11px]"
                            >
                              <span>Shorts</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1 w-fit">
                            <Check className="h-3 w-3" />
                            <span>{row.tempStorageState || 'GELÖSCHT (0 MB)'}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-12 text-center space-y-3">
                <FileSpreadsheet className="h-12 w-12 text-zinc-600 mx-auto" />
                <h4 className="text-sm font-bold text-white">Bisher noch keine Clips protokolliert</h4>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Starte deinen Live-Stream auf Twitch. Sobald der Stream beendet ist oder Clips erzeugt werden, synchronisiert Pipeline 3 alle Beitrags-URLs automatisch hierher.
                </p>
                {!liveStatus.google.connected && (
                  <div className="pt-2">
                    <button
                      onClick={handleProvisionSheet}
                      disabled={isProvisioningSheet}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition cursor-pointer"
                    >
                      Google Sheets Vorlage in Drive kopieren
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: Real Webhook Event Stream (ZERO MOCK DATA) */}
      {activeTab === 'logs' && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                Live Twitch EventSub & Webhook Stream
              </h3>
            </div>
            <button
              onClick={loadRealData}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Aktualisieren</span>
            </button>
          </div>

          {webhookEvents.length > 0 ? (
            <div className="max-h-96 overflow-y-auto space-y-2 font-mono text-xs">
              {webhookEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 flex items-start justify-between gap-3 text-zinc-300"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-[10px] font-bold uppercase">
                        {evt.provider} • {evt.eventType}
                      </span>
                      <span className="text-zinc-500 text-[10px]">
                        {evt.receivedAt ? new Date(evt.receivedAt).toLocaleTimeString('de-DE') : ''}
                      </span>
                    </div>
                    <p className="text-xs font-sans text-zinc-300">
                      Broadcaster: <strong className="text-white">{evt.eventData?.broadcasterName || evt.userId}</strong>
                    </p>
                  </div>
                  <span className="rounded bg-zinc-800 text-zinc-400 text-[10px] font-mono px-2 py-0.5">
                    HMAC Verified
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-2">
              <Terminal className="h-10 w-10 text-zinc-700 mx-auto" />
              <p className="text-xs text-zinc-400">
                Noch keine Events verzeichnet. System im Tiefschlaf (0% CPU, 0 MB Speicher). Wartet auf Twitch EventSub Webhooks.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW: Usage Analytics */}
      {activeTab === 'analytics' && (
        <UsageAnalytics
          user={user}
          onOpenClipPacksModal={() => setIsClipPacksModalOpen(true)}
          onUpgradePlan={() => setActiveTab('modules')}
        />
      )}

      {/* VIEW: Unified Referral Hub & Leaderboard */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          <ReferralHub user={user} onUpdateUser={onUpdateUser} />
          <TopReferrersLeaderboard
            user={user}
            onUpdateUser={onUpdateUser}
            onOpenClipPacksModal={() => setIsClipPacksModalOpen(true)}
          />
        </div>
      )}

      {/* VIEW: Modules & Stufen Configurator (Dynamische Preisgestaltung) */}
      {activeTab === 'modules' && (
        <div className="space-y-6">
          <DynamicPricingCalculator
            user={user}
            isDashboardMode={true}
            onUpdateUser={onUpdateUser}
            onOpenStripeCheckout={(modularPlan) => {
              if (onUpgradePlan) {
                const planName: SubscriptionPlan =
                  modularPlan.tierLevel >= 4 ? 'elite' : modularPlan.tierLevel >= 2 ? 'pro' : 'creator';
                onUpgradePlan(planName);
              }
            }}
            onSelectPlan={(modularPlan) => {
              if (onUpgradePlan) {
                const planName: SubscriptionPlan =
                  modularPlan.tierLevel >= 4 ? 'elite' : modularPlan.tierLevel >= 2 ? 'pro' : 'creator';
                onUpgradePlan(planName);
              }
            }}
          />
        </div>
      )}

      {/* VIEW: Admin Profit Matrix (Exclusive to Master Admin) */}
      {activeTab === 'admin' && (user.isAdmin || user.email === 'robert.f.telekom@gmail.com') && (
        <AdminProfitMatrix />
      )}

      {/* Modals */}
      {isByokModalOpen && (
        <ByokSettingsModal
          user={user}
          isOpen={isByokModalOpen}
          onClose={() => setIsByokModalOpen(false)}
          onUpdateUser={async (updatedUser) => {
            onUpdateUser?.(updatedUser);
            await syncUserToFirestore(updatedUser);
            setIsByokModalOpen(false);
          }}
        />
      )}

      {isGdprModalOpen && (
        <GdprPrivacyAuditModal
          isOpen={isGdprModalOpen}
          onClose={() => setIsGdprModalOpen(false)}
          user={user}
        />
      )}

      {isWizardOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 m-auto max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-purple-500/30 bg-[#0c0620] p-4 sm:p-6 shadow-2xl backdrop:bg-black/85 backdrop:backdrop-blur-md block my-auto text-left"
        >
          <SystemConfigurationHub
            user={user}
            onUpdateUser={async (updatedUser) => {
              onUpdateUser?.(updatedUser);
              await syncUserToFirestore(updatedUser);
            }}
            onCompleteAndUnlockDashboard={() => {
              setIsWizardOpen(false);
              sessionStorage.setItem('quickclick_config_dismissed', 'true');
              loadRealData();
            }}
            isModalView={true}
            onCloseModal={() => {
              setIsWizardOpen(false);
              sessionStorage.setItem('quickclick_config_dismissed', 'true');
            }}
          />
        </dialog>
      )}

      {isClipPacksModalOpen && (
        <ClipPacksModal
          isOpen={isClipPacksModalOpen}
          onClose={() => setIsClipPacksModalOpen(false)}
          currentClipsUsed={user.clipsUsedThisMonth}
          currentClipsLimit={user.clipsLimitTotal}
          bonusClips={user.bonusClips}
          userId={user.id || 'usr_94821a'}
          onTopupSuccess={(addedClips) => {
            if (onUpdateUser) {
              onUpdateUser({
                ...user,
                bonusClips: (user.bonusClips || 0) + addedClips,
              });
            }
          }}
          onBuyPackage={(pkg) => {
            if (onUpdateUser) {
              onUpdateUser({
                ...user,
                bonusClips: (user.bonusClips || 0) + pkg.clips,
              });
            }
            setIsClipPacksModalOpen(false);
          }}
        />
      )}

      {/* Trial Cancellation Confirmation Modal */}
      {isTrialCancelConfirmOpen && (
        <dialog
          open
          className="fixed inset-0 z-50 m-auto max-w-md w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm block my-auto text-left"
        >
          <h3 className="text-lg font-bold text-white">Testphase beenden?</h3>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Möchtest du die 14-tägige Testphase für Stufe 2 Basic vorzeitig beenden? Dein Account wechselt sofort kostenlos in den dauerhaften <strong>0 € Free Starter</strong> (30 Clips/Monat).
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsTrialCancelConfirmOpen(false)}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleCancelTrial}
              className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold cursor-pointer"
            >
              Ja, Testphase beenden (Auf 0 € Free)
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
};
