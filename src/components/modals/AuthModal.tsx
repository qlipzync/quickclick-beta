import React, { useState } from 'react';
import { X, Tv, Sparkles, ShieldCheck, ArrowRight, Check } from 'lucide-react';
import { SubscriptionPlan, StreamerUser } from '../../types/pipeline';
import { authenticateWithTwitch } from '../../lib/firebaseAuth';
import { PRESET_MODULAR_PLANS } from '../../config/stripeUnifiedConfig';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: StreamerUser) => void;
  preferredPlan?: SubscriptionPlan;
  initialChannel?: string;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenImpressum: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  preferredPlan = 'creator',
  initialChannel = '',
  onOpenTerms,
  onOpenPrivacy,
  onOpenImpressum,
}) => {
  const [channelInput, setChannelInput] = useState<string>(initialChannel);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(preferredPlan);
  const [agreedTerms, setAgreedTerms] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleTwitchConnect = () => {
    if (!agreedTerms) return;
    authenticateWithTwitch(selectedPlan, channelInput.trim() || undefined);
  };

  const handleDirectDemoLogin = () => {
    const channel = channelInput.trim() || 'twitch_creator';
    const demoUser: StreamerUser = {
      id: `streamer_${Date.now()}`,
      name: channel,
      displayName: channel,
      channelName: channel,
      email: `${channel}@quickclick.local`,
      avatarUrl: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=120&auto=format&fit=crop&q=80',
      role: 'streamer',
      isAdmin: false,
      isTitanVip: false,
      hasActiveSubscription: true,
      plan: selectedPlan,
      clipsLimitTotal: 100,
      apiCallsLimit: 1200,
      clipsUsedCount: 0,
      apiCallsUsedCount: 0,
      isFullyConfigured: true,
      modularConfig: PRESET_MODULAR_PLANS[1],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onLoginSuccess(demoUser);
  };

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-auto w-full max-w-lg rounded-3xl border border-purple-500/30 bg-gradient-to-b from-[#130a2a] to-[#090518] p-6 sm:p-8 shadow-2xl space-y-5 text-left text-zinc-100 backdrop:bg-black/80 backdrop:backdrop-blur-md block my-auto"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 text-zinc-400 hover:text-white transition p-1 cursor-pointer"
        aria-label="Schließen"
      >
        <X className="h-5 w-5" />
      </button>

      <header className="text-center space-y-1.5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#9146FF] to-purple-600 text-white shadow-lg shadow-[#9146FF]/30">
          <Tv className="h-6 w-6" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black font-display text-white">
          Vollen Autopilot freischalten
        </h2>
        <p className="text-xs text-zinc-400">
          Verbinde deinen Kanal mit der autonomous QlipZync Zero-Storage Pipeline.
        </p>
      </header>

      {/* Persuasive Conversion Callout */}
      <article className="rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-950/60 to-[#0e0722] p-4 sm:p-5 space-y-3 text-left shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-fuchsia-400 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-fuchsia-300">
              Warum die Registrierung für alle Features nötig ist
            </h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold">
            100% Autopilot
          </span>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          Im Gast-Modus kannst du das Dashboard und die Architektur einsehen. Für die <strong>echte automatisierte Verarbeitung und Veröffentlichung</strong> benötigt die Engine deinen autorisierten Kanal:
        </p>

        <ul className="space-y-2 pt-1 border-t border-purple-500/20 list-none p-0 m-0">
          <li className="flex items-start gap-2.5 text-xs text-zinc-200">
            <div className="h-5 w-5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <Check className="h-3.5 w-3.5" />
            </div>
            <div>
              <strong className="text-white">Automated Clip Processing:</strong>
              <span className="text-zinc-300 block text-[11px] leading-relaxed">
                5 Minuten nach Stream-Ende holt die Engine Clips per DNS direkt ins RAM (/dev/shm). Gemini 2.5 schneidet Highlights, Hooks & 9:16 Vertikalformate flüchtig ohne Cloud-Disk.
              </span>
            </div>
          </li>

          <li className="flex items-start gap-2.5 text-xs text-zinc-200">
            <div className="h-5 w-5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <Check className="h-3.5 w-3.5" />
            </div>
            <div>
              <strong className="text-white">Autonomes Social Media Posting:</strong>
              <span className="text-zinc-300 block text-[11px] leading-relaxed">
                Vollautomatisches Multi-Format-Publishing von Texten, Bildern und Video-Clips direkt auf TikTok, YouTube Shorts, Instagram Reels & X.
              </span>
            </div>
          </li>

          <li className="flex items-start gap-2.5 text-xs text-zinc-200">
            <div className="h-5 w-5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <Check className="h-3.5 w-3.5" />
            </div>
            <div>
              <strong className="text-white">Live-Events & Bot-Heartbeats:</strong>
              <span className="text-zinc-300 block text-[11px] leading-relaxed">
                Sofortiger Einladungslink bei Live-Gang, 2. Einladung nach 15 Minuten sowie zyklische 10-Minuten-Updates an deine Discord- und Telegram-Bots.
              </span>
            </div>
          </li>
        </ul>
      </article>

      <form onSubmit={(e) => { e.preventDefault(); handleTwitchConnect(); }} className="space-y-4">
        <div>
          <label htmlFor="auth-modal-channel" className="text-xs font-semibold text-zinc-300 block mb-1.5">
            Twitch Kanalname (optional)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-zinc-500 text-sm">twitch.tv/</span>
            <input
              id="auth-modal-channel"
              type="text"
              placeholder="deinkanal"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              className="w-full rounded-xl bg-zinc-900/80 border border-purple-500/30 pl-24 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-400 transition"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
            Start-Tarif (Dynamisch 1 - 20.000 Clips wählbar)
          </label>
          <menu className="grid grid-cols-3 gap-2 list-none p-0 m-0">
            {(['free', 'creator', 'pro'] as SubscriptionPlan[]).map((plan) => (
              <li key={plan}>
                <button
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`w-full py-2 px-2 rounded-xl text-xs font-bold transition uppercase cursor-pointer ${
                    selectedPlan === plan
                      ? 'bg-purple-600 text-white border border-purple-400 shadow-md'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {plan === 'free' ? '0 € Free' : plan === 'creator' ? '100 Clips' : 'Profi-Abo'}
                </button>
              </li>
            ))}
          </menu>
        </div>

        {/* Consent Checkbox */}
        <label className="flex items-start gap-2.5 text-[11px] text-zinc-400 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            className="rounded bg-zinc-900 border-zinc-700 text-purple-600 mt-0.5"
          />
          <span>
            Ich akzeptiere die{' '}
            <button type="button" onClick={onOpenTerms} className="text-purple-400 underline">
              AGB
            </button>
            ,{' '}
            <button type="button" onClick={onOpenPrivacy} className="text-purple-400 underline">
              Datenschutzhinweise
            </button>{' '}
            und das{' '}
            <button type="button" onClick={onOpenImpressum} className="text-purple-400 underline">
              Impressum
            </button>
            .
          </span>
        </label>

        {/* Official Twitch OAuth Button */}
        <button
          type="button"
          onClick={handleTwitchConnect}
          disabled={!agreedTerms}
          className="w-full py-3.5 rounded-xl bg-[#9146FF] hover:bg-[#772ce8] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-[#9146FF]/25 transition cursor-pointer"
        >
          <Tv className="h-4 w-4" /> Mit Twitch anmelden & autorisieren
        </button>

        {/* Instant Sandbox Login */}
        <button
          type="button"
          onClick={handleDirectDemoLogin}
          disabled={!agreedTerms}
          className="w-full py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <span>Schnellstart ohne Twitch-Popup (Sandbox-Modus)</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </form>
    </dialog>
  );
};
