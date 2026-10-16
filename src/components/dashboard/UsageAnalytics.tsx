import React from 'react';
import { Film, Zap, TrendingUp, Sparkles, ShoppingBag, Sliders } from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';
import { ApiQuotaDashboard } from './ApiQuotaDashboard';

interface UsageAnalyticsProps {
  user: StreamerUser;
  onOpenClipPacksModal: () => void;
  onUpgradePlan: () => void;
}

export const UsageAnalytics: React.FC<UsageAnalyticsProps> = ({
  user,
  onOpenClipPacksModal,
  onUpgradePlan,
}) => {
  const clipsUsed = user.clipsUsedThisMonth || user.clipsUsedCount || 0;
  const clipsTotal = user.clipsLimitTotal || 30;
  const percent = Math.min(100, Math.round((clipsUsed / clipsTotal) * 100));

  return (
    <div className="space-y-6">
      {/* High-level Quick Summary Bar */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white font-display">
              Nutzungs- & Kontingent-Analysen
            </h3>
            <p className="text-xs text-zinc-400">
              Detaillierte Übersicht deines monatlichen Kontingents und deiner API-Aufrufe.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onUpgradePlan}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Dynamisches Kontingent (Regler)</span>
            </button>
            <button
              onClick={onOpenClipPacksModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Clips aufstocken</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <span className="text-xs text-zinc-400 block">Monatliche Clips:</span>
            <div className="text-2xl font-black text-white font-mono">
              {clipsUsed} / {clipsTotal}
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <span className="text-xs text-zinc-400 block">Gemini 2.5 API Aufrufe:</span>
            <div className="text-2xl font-black text-purple-300 font-mono">
              {user.apiCallsUsedCount ?? user.apiCallsUsed ?? 0} / {user.apiCallsLimit || 300}
            </div>
            <span className="text-[10px] text-zinc-500 font-mono block">Zero-Storage Processing</span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
            <span className="text-xs text-zinc-400 block">Cloud Speicherverbrauch:</span>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              0,00 MB
            </div>
            <span className="text-[10px] text-zinc-500 font-mono block">Flüchtiges RAM (/dev/shm)</span>
          </div>
        </div>
      </div>

      {/* Real-time Recharts API Quota Visualization Dashboard pulling from Firestore */}
      <ApiQuotaDashboard user={user} onUpgradePlan={onUpgradePlan} />
    </div>
  );
};
