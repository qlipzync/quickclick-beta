import React from 'react';
import { Sliders, Sparkles } from 'lucide-react';
import { calculateVerifiedTier } from '../../services/pricingEngine';

interface ProgressiveExtensionsMatrixProps {
  clipVolume?: number;
  onActionClick?: () => void;
  actionButtonLabel?: string;
}

const QUOTA_STEPS = [50, 100, 250, 1000, 5000];

export const ProgressiveExtensionsMatrix: React.FC<ProgressiveExtensionsMatrixProps> = ({
  onActionClick,
  actionButtonLabel = 'Auswählen',
}) => {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Sliders className="h-5 w-5 text-emerald-400" />
            <span>Dynamische Clip-Staffelung</span>
          </h3>
          <p className="text-xs text-zinc-400">
            Logarithmische Mengenrabattierung von 1 bis 20.000 Clips.
          </p>
        </div>
        {onActionClick && (
          <button
            onClick={onActionClick}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
          >
            {actionButtonLabel}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {QUOTA_STEPS.map((clips) => {
          const tier = calculateVerifiedTier(clips)!;
          return (
            <div
              key={clips}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> {clips} Clips
                </span>
                <div className="text-lg font-black text-white font-mono mt-1">
                  {tier.monthlyTotalEur.toFixed(2)} €
                  <span className="text-[10px] text-zinc-500 font-normal"> / Mo</span>
                </div>
                <div className="text-xs text-cyan-300 font-mono mt-1">
                  {(tier.unitPriceEur * 100).toFixed(2)} ct / Clip
                </div>
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold">
                -{tier.discountPercent}% Rabatt
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
