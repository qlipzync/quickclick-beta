import React from 'react';
import { useSubscription } from '../../hooks/useSubscription';
import { usePlatformStatus } from '../../hooks/usePlatformStatus';
import { Tv, Youtube, Share2, Shield, Lock, ExternalLink, RefreshCw } from 'lucide-react';

export const DashboardIntegrations: React.FC = () => {
  const { isSubscribed, isLoading: subLoading, initiateCheckout, isProcessingCheckout } = useSubscription();
  const { platforms, isLoading: platformsLoading, actionLoading, disconnectPlatform, error, refreshPlatforms } = usePlatformStatus(isSubscribed);

  if (subLoading) {
    return (
      <div className="p-8 border border-slate-800 rounded-2xl bg-slate-900/40 backdrop-blur-md flex items-center justify-center space-x-3 text-gray-300">
        <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
        <span>Abonnement-Status wird serverseitig überprüft...</span>
      </div>
    );
  }

  // 1. Subscription-Gate: Unabonnierte Nutzer sehen keine Integrations-Aktionen
  if (!isSubscribed) {
    return (
      <div className="p-8 border border-red-500/30 rounded-2xl bg-gradient-to-b from-slate-900/90 to-red-950/20 backdrop-blur-md text-left shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Abonnement erforderlich (Subscription Gate)</h2>
        <p className="text-gray-400 mb-6 max-w-xl text-sm leading-relaxed">
          Der Zugriff auf Plattform-Synchronisierungen und automatisierte Workflows steht exklusiv aktiven Abonnenten zur Verfügung. Benutzerkonten haben nach der Registrierung standardmäßig Null-Zugriff auf die SaaS-Engine, bis ein aktives Abonnement serverseitig über Stripe und Firebase Custom Claims verifiziert ist.
        </p>
        <button
          onClick={() => initiateCheckout('price_1Q_PRO_TIER')}
          disabled={isProcessingCheckout}
          className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all disabled:opacity-50 cursor-pointer"
        >
          {isProcessingCheckout ? 'Weiterleitung zu Stripe...' : 'Jetzt abonnieren & freischalten'}
        </button>
      </div>
    );
  }

  if (platformsLoading) {
    return (
      <div className="p-8 border border-slate-800 rounded-2xl bg-slate-900/40 backdrop-blur-md flex items-center justify-center space-x-3 text-gray-300">
        <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
        <span>Lade verbundene Kanäle (Zero-Token Shield)...</span>
      </div>
    );
  }

  // 2. Ansicht für verifizierte Abonnenten
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Entkoppelte Plattform-Statusverwaltung (Zero Client-Token Exposure)
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            OAuth-Tokens werden serverseitig mit Google Cloud KMS verschlüsselt gespeichert. Der Client erhält ausschließlich boolesche Status-Flags und Metadaten.
          </p>
        </div>
        <button
          onClick={() => void refreshPlatforms()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Aktualisieren
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Twitch Card */}
        <div className="p-5 border border-slate-800 rounded-2xl bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Tv className="w-5 h-5" />
                </div>
                <h4 className="text-base font-semibold text-white">Twitch</h4>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  platforms?.twitch.connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-gray-400'
                }`}
              >
                {platforms?.twitch.connected ? 'Verbunden' : 'Getrennt'}
              </span>
            </div>

            <p className="text-sm text-gray-400 mb-6">
              {platforms?.twitch.connected
                ? `Kanal: ${platforms.twitch.accountName}`
                : 'Verbinde deinen Twitch-Kanal für den automatisierten Clip-Import.'}
            </p>
          </div>

          <div>
            {platforms?.twitch.connected ? (
              <button
                onClick={() => disconnectPlatform('twitch')}
                disabled={actionLoading === 'twitch'}
                className="w-full py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm font-medium rounded-xl border border-red-500/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {actionLoading === 'twitch' ? 'Trennen...' : 'Verbindung trennen'}
              </button>
            ) : (
              <a
                href={`https://id.twitch.tv/oauth2/authorize?client_id=${import.meta.env.VITE_TWITCH_CLIENT_ID || 'afht5r000ofphuq2uh4aljljp0nivv'}&redirect_uri=${encodeURIComponent(
                  `${window.location.origin}/auth/callback/twitch`
                )}&response_type=code&scope=clips:edit+user:read:email`}
                className="block text-center w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl shadow transition-colors"
              >
                Twitch verbinden
              </a>
            )}
          </div>
        </div>

        {/* YouTube Card */}
        <div className="p-5 border border-slate-800 rounded-2xl bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                  <Youtube className="w-5 h-5" />
                </div>
                <h4 className="text-base font-semibold text-white">YouTube</h4>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  platforms?.youtube.connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-gray-400'
                }`}
              >
                {platforms?.youtube.connected ? 'Verbunden' : 'Getrennt'}
              </span>
            </div>

            <p className="text-sm text-gray-400 mb-6">
              {platforms?.youtube.connected
                ? `Kanal: ${platforms.youtube.accountName}`
                : 'Automatische Veröffentlichung als YouTube Shorts via Google API Gateway.'}
            </p>
          </div>

          <div>
            {platforms?.youtube.connected ? (
              <button
                onClick={() => disconnectPlatform('youtube')}
                disabled={actionLoading === 'youtube'}
                className="w-full py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm font-medium rounded-xl border border-red-500/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {actionLoading === 'youtube' ? 'Trennen...' : 'Verbindung trennen'}
              </button>
            ) : (
              <a
                href={`/api/auth/google/connect`}
                className="block text-center w-full py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl shadow transition-colors"
              >
                YouTube verbinden
              </a>
            )}
          </div>
        </div>

        {/* TikTok Card */}
        <div className="p-5 border border-slate-800 rounded-2xl bg-slate-900/60 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Share2 className="w-5 h-5" />
                </div>
                <h4 className="text-base font-semibold text-white">TikTok</h4>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  platforms?.tiktok.connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-800 text-gray-400'
                }`}
              >
                {platforms?.tiktok.connected ? 'Verbunden' : 'Getrennt'}
              </span>
            </div>

            <p className="text-sm text-gray-400 mb-6">
              {platforms?.tiktok.connected
                ? `Kanal: ${platforms.tiktok.accountName}`
                : 'Direkte Distribution vertikaler Gaming-Highlights auf deinen TikTok-Kanal.'}
            </p>
          </div>

          <div>
            {platforms?.tiktok.connected ? (
              <button
                onClick={() => disconnectPlatform('tiktok')}
                disabled={actionLoading === 'tiktok'}
                className="w-full py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-sm font-medium rounded-xl border border-red-500/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {actionLoading === 'tiktok' ? 'Trennen...' : 'Verbindung trennen'}
              </button>
            ) : (
              <a
                href={`/api/auth/tiktok/connect`}
                className="block text-center w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl border border-slate-700 shadow transition-colors"
              >
                TikTok verbinden
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
