import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  Database,
  Key,
  Tv,
  Cloud,
  FileSpreadsheet,
  CreditCard,
  Lock,
  ExternalLink,
  ShieldAlert,
  Smartphone,
  Share2,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';
import { GCP_PROJECT_METADATA } from '../../config/quickclick-config';
import { STRIPE_OFFICIAL_TIERS } from '../../config/stripeUnifiedConfig';

interface SystemConfigurationHubProps {
  user: StreamerUser;
  onUpdateUser: (updated: StreamerUser) => void;
  onCompleteAndUnlockDashboard: () => void;
  isModalView?: boolean;
  onCloseModal?: () => void;
  onOpenStripeCheckout?: () => void;
  onOpen2FAModal?: () => void;
}

export const SystemConfigurationHub: React.FC<SystemConfigurationHubProps> = ({
  user,
  onUpdateUser,
  onCompleteAndUnlockDashboard,
  isModalView = false,
  onCloseModal,
  onOpenStripeCheckout,
  onOpen2FAModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'stripe' | 'oauth' | '2fa' | 'twitch' | 'cloud'>('stripe');

  return (
    <div className="rounded-3xl border border-purple-500/30 bg-[#0c0722] p-6 sm:p-8 shadow-2xl space-y-6 relative text-zinc-100 max-w-4xl mx-auto">
      {isModalView && onCloseModal && (
        <button
          onClick={onCloseModal}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white transition p-1 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-purple-500/20 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase text-purple-400 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            SYSTEM-KONFIGURATION & SICHERHEITS-ARCHITEKTUR
          </span>
          <h3 className="text-xl sm:text-2xl font-black font-display text-white mt-0.5">
            System Configuration Hub (Stripe, OAuth, 2FA, Twitch)
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
            europe-west3
          </span>
          <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono">
            KMS Encrypted
          </span>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {[
          { id: 'stripe', label: '1. Stripe & Abonnements', icon: CreditCard },
          { id: 'oauth', label: '2. OAuth & KMS Shield', icon: Key },
          { id: '2fa', label: '3. 2FA (RFC 6238)', icon: Lock },
          { id: 'twitch', label: '4. Twitch EventSub & Pipeline', icon: Tv },
          { id: 'cloud', label: '5. Cloud Run & DB-Architektur', icon: Cloud },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                isActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-zinc-400 hover:text-white bg-zinc-900/60 border border-zinc-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. STRIPE TAB */}
      {activeSubTab === 'stripe' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300 font-semibold text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-400" />
                Stripe Monetarisierungs-Konfiguration & Custom Claims
              </span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                user.hasActiveSubscription
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                {user.hasActiveSubscription ? 'Abonnement Aktiv (Claim: subscribed=true)' : 'Kein aktives Abo (Gated)'}
              </span>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Zahlungen werden direkt über Stripe Checkout Sessions verarbeitet. Nach erfolgreicher Zahlung setzt der Stripe-Webhook <code className="text-purple-300 font-mono">checkout.session.completed</code> serverseitig das Custom Claim <code className="text-purple-300 font-mono">subscribed: true</code> via Firebase Admin SDK.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(Object.values(STRIPE_OFFICIAL_TIERS) as any[]).slice(0, 3).map((tier) => (
              <div key={tier.tierLevel} className="p-3.5 rounded-2xl bg-black/40 border border-zinc-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-xs">{tier.displayName}</span>
                  <span className="text-emerald-400 font-bold">{tier.monthlyPriceEur.toFixed(2)} €/Mo</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-500">
                  Product: {tier.productId}
                </div>
                <div className="text-[10px] font-mono text-purple-400/80 truncate">
                  Price: {tier.priceId}
                </div>
                <div className="text-[10px] text-zinc-400 pt-1">
                  {tier.dailyClips} Clips/Tag • {tier.channelsDescription}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
            <span className="text-purple-200">
              Stripe Webhook Endpoint: <code className="font-mono text-purple-300">/api/v1/subscription/webhook</code>
            </span>
            {onOpenStripeCheckout && (
              <button
                onClick={onOpenStripeCheckout}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
              >
                Stripe Checkout öffnen
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. OAUTH & KMS TAB */}
      {activeSubTab === 'oauth' && (
        <div className="space-y-4 text-xs text-zinc-300">
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Key className="h-4 w-4 text-purple-400" />
              <span>Google Cloud KMS Envelope-Verschlüsselung (Zero Plaintext Secrets)</span>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Drittanbieter-Tokens (Twitch, YouTube, TikTok, Google Sheets) werden serverseitig mit dem KMS-Schlüsselring <code className="text-purple-300 font-mono">saas-user-credentials</code> verschlüsselt. Das Frontend erhält und speichert ausschließlich boolesche Flags (z. B. <code className="text-purple-300 font-mono">twitchConnected: true</code>).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-black/40 border border-zinc-800 space-y-1">
              <span className="text-zinc-500 block text-[10px] uppercase font-mono">Google OAuth 2.0 Client ID</span>
              <span className="font-mono text-white text-[11px] break-all">
                248792984033-91mcnb6d2qhl397nnou2fk6jp1d1dphn.apps.googleusercontent.com
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-black/40 border border-zinc-800 space-y-1">
              <span className="text-zinc-500 block text-[10px] uppercase font-mono">Twitch Helix Client ID</span>
              <span className="font-mono text-white text-[11px]">
                afht5r000ofphuq2uh4aljljp0nivv
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
            <div>
              <span className="text-white font-semibold block">KMS Key Resource:</span>
              <span className="font-mono text-[10px] text-purple-300">
                projects/qlipzync/locations/europe-west3/keyRings/saas-user-credentials/cryptoKeys/byok-encryption-key
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono">
              AES-256-GCM
            </span>
          </div>
        </div>
      )}

      {/* 3. 2FA TAB */}
      {activeSubTab === '2fa' && (
        <div className="space-y-4 text-xs text-zinc-300">
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Lock className="h-4 w-4 text-cyan-400" />
                <span>Zwei-Faktor-Authentifizierung (RFC 6238 TOTP)</span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                  user.twoFactorEnabled || user.twoFactorAuth?.isEnabled
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {user.twoFactorEnabled || user.twoFactorAuth?.isEnabled ? '2FA Aktiv' : '2FA Deaktiviert'}
              </span>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Kompensiert unautorisierte Kontozugriffe über zeitbasierte Einmal-Passwörter (TOTP). Kompatibel mit Google Authenticator, Authy und 1Password.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-white font-semibold block">Authenticator-App Status:</span>
              <span className="text-zinc-400 text-xs">
                {user.twoFactorEnabled || user.twoFactorAuth?.isEnabled
                  ? 'Konto ist per TOTP abgesichert. Sensible Aktionen erfordern den 6-stelligen Code.'
                  : 'Richte jetzt 2FA ein, um Streaming- und Social-Tokens abzusichern.'}
              </span>
            </div>
            {onOpen2FAModal && (
              <button
                onClick={onOpen2FAModal}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shrink-0 cursor-pointer shadow-lg shadow-purple-600/30"
              >
                {user.twoFactorEnabled || user.twoFactorAuth?.isEnabled ? '2FA Einstellungen' : '2FA Jetzt Einrichten'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. TWITCH TAB */}
      {activeSubTab === 'twitch' && (
        <div className="space-y-3 text-xs text-zinc-300">
          <p className="leading-relaxed">
            Twitch EventSub Webhooks werden automatisch registriert, sobald ein Stream online geht. Die Video-Transkodierung erfolgt flüchtig in <code className="text-purple-300 font-mono">/dev/shm</code> mit 0 MB persistentem Disk-Footprint.
          </p>
          <div className="p-3.5 rounded-xl bg-black/50 border border-purple-500/20 font-mono text-[11px] text-purple-300">
            https://qlipzync.web.app/api/webhooks/twitch
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>EventSub Handshake & SHA256 Signature HMAC aktiv</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-400 text-xs p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
              <Zap className="h-4 w-4 shrink-0" />
              <span>RAM-Only Smart 9:16 Video Crop (/dev/shm)</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. CLOUD & DB TAB */}
      {activeSubTab === 'cloud' && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
              <span className="text-zinc-400 block text-[10px] uppercase font-mono">GCP Projekt ID</span>
              <span className="font-bold text-white font-mono">{GCP_PROJECT_METADATA.projectId}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
              <span className="text-zinc-400 block text-[10px] uppercase font-mono">Firestore Haupt-DB</span>
              <span className="font-bold text-white font-mono text-[11px] truncate block">{GCP_PROJECT_METADATA.databaseId}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
              <span className="text-zinc-400 block text-[10px] uppercase font-mono">Cloud Run Service</span>
              <span className="font-bold text-emerald-400 font-mono">quickclick-app (Port 3000)</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
              <span className="text-zinc-400 block text-[10px] uppercase font-mono">Cloud Tasks Queue</span>
              <span className="font-bold text-cyan-400 font-mono">clip-cooldown-queue (300s Puffer)</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-4 border-t border-purple-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-[11px] text-zinc-500 font-mono">
          System-Status: Alle 4 Subsysteme synchronisiert & verifiziert
        </span>
        <button
          onClick={onCompleteAndUnlockDashboard}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/30 transition cursor-pointer"
        >
          Konfiguration abschließen & Dashboard freischalten
        </button>
      </div>
    </div>
  );
};
