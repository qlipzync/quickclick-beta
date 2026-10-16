import React from 'react';
import { Lock, Sparkles, CheckCircle2, ShieldAlert, LogOut, ArrowRight, Zap } from 'lucide-react';
import { StreamerUser, SubscriptionPlan } from '../../types/pipeline';

interface AccessDeniedPaywallProps {
  user: StreamerUser;
  onActivateSubscription: (plan?: SubscriptionPlan) => void;
  onLogout: () => void;
}

export const AccessDeniedPaywall: React.FC<AccessDeniedPaywallProps> = ({
  user,
  onActivateSubscription,
  onLogout,
}) => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 p-8 shadow-2xl backdrop-blur-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-6 shadow-lg shadow-emerald-500/10">
          <Lock className="h-8 w-8" />
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1 text-xs font-semibold text-emerald-400 mb-3">
          <ShieldAlert className="h-3.5 w-3.5" /> Clip-Kontingent erforderlich
        </span>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-display mb-3">
          Aktives Clip-Guthaben wählen
        </h2>
        <p className="text-sm text-zinc-400 max-w-xl mx-auto mb-8">
          Hallo <span className="text-zinc-200 font-semibold">{user.displayName || user.name || 'Streamer'}</span>,
          wähle dein dynamisches Monatskontingent (1 bis 20.000 Clips), um auf das Autopilot-Dashboard
          und die Zero-Storage Cloud-Pipeline zuzugreifen.
        </p>

        {/* Feature Preview Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left">
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1">
              <Zap className="h-4 w-4" /> 0 MB RAM Pipeline
            </div>
            <p className="text-xs text-zinc-400">Keine Speichergebühren, flüchtige /dev/shm Clip-Verarbeitung.</p>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs mb-1">
              <Sparkles className="h-4 w-4" /> Gemini 2.5 Flash
            </div>
            <p className="text-xs text-zinc-400">KI-Punchlines, Hooks und automatische 9:16 Untertitel.</p>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
            <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs mb-1">
              <CheckCircle2 className="h-4 w-4" /> Omni-Publishing
            </div>
            <p className="text-xs text-zinc-400">Autonomes Posting auf TikTok, Shorts, Reels und X.</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => onActivateSubscription('pro')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 transition transform hover:scale-[1.02] cursor-pointer"
          >
            <span>Clip-Kontingent konfigurieren (1 - 20k)</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onLogout}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-sm transition cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> Abmelden
          </button>
        </div>
      </div>
    </div>
  );
};
