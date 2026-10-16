import React, { useState } from 'react';
import {
  Sparkles,
  CreditCard,
  CheckCircle2,
  TrendingDown,
  Zap,
  ShieldCheck,
} from 'lucide-react';
import { ClipQuotaInput, PricingDetails } from '../ClipQuotaInput';
import { DashboardTopup } from '../DashboardTopup';
import { StreamerUser, ModularSubscriptionConfig } from '../../types/pipeline';
import { calculateVerifiedTier } from '../../services/pricingEngine';

interface DynamicPricingCalculatorProps {
  user?: StreamerUser | null;
  initialClips?: number;
  initialCycle?: 'monthly' | 'annual';
  onSelectPlan?: (config: ModularSubscriptionConfig, cycle: 'monthly' | 'annual') => void;
  onOpenStripeCheckout?: (config: ModularSubscriptionConfig, cycle: 'monthly' | 'annual') => void;
  onUpdateUser?: (updated: StreamerUser) => void;
  isDashboardMode?: boolean;
}

export const DynamicPricingCalculator: React.FC<DynamicPricingCalculatorProps> = ({
  user,
  initialClips = 100,
  onUpdateUser,
  isDashboardMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'topup'>('plan');
  const [pricingDetails, setPricingDetails] = useState<PricingDetails>({
    clips: initialClips,
    unitPriceEur: 0.2907,
    totalPriceEur: 29.07,
    discountPercent: 42,
    isValid: true,
  });

  const handlePriceChange = React.useCallback((details: PricingDetails) => {
    setPricingDetails((prev) => {
      if (
        prev.clips === details.clips &&
        prev.unitPriceEur === details.unitPriceEur &&
        prev.totalPriceEur === details.totalPriceEur &&
        prev.discountPercent === details.discountPercent &&
        prev.isValid === details.isValid
      ) {
        return prev;
      }
      return details;
    });
  }, []);

  const handleApplyQuota = () => {
    if (!pricingDetails.isValid) return;
    if (onUpdateUser && user) {
      onUpdateUser({
        ...user,
        clipsLimitTotal: pricingDetails.clips,
      });
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-[#070b16] p-6 sm:p-8 space-y-6 max-w-3xl mx-auto shadow-2xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 uppercase">
            <Sparkles className="w-3.5 h-3.5" /> DYNAMISCHE PREISGESTALTUNG (1 - 20.000 CLIPS)
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white font-display mt-1">
            Individuelles Clip-Kontingent anpassen
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Volle Skalierbarkeit ohne starre Tarife: 50 ct bei Einzelclips bis zu 5 ct bei 20.000 Clips.
          </p>
        </div>

        <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('plan')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition ${
              activeTab === 'plan'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Monats-Abo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('topup')}
            className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'topup'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3 h-3 text-emerald-300" />
            <span>Google Pay Topup</span>
          </button>
        </div>
      </div>

      {activeTab === 'plan' ? (
        <div className="space-y-6 flex flex-col items-center">
          <ClipQuotaInput
            mode="register"
            initialValue={pricingDetails.clips}
            onPriceChange={handlePriceChange}
          />

          {isDashboardMode && (
            <div className="w-full max-w-xl">
              <button
                type="button"
                disabled={!pricingDetails.isValid}
                onClick={handleApplyQuota}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50 text-white font-bold text-sm transition shadow-lg shadow-emerald-500/20"
              >
                Monatskontingent auf {pricingDetails.clips.toLocaleString()} Clips umstellen ({pricingDetails.totalPriceEur.toFixed(2)} €/Mo)
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <DashboardTopup
            userId={user?.id || 'usr_94821a'}
            onSuccess={(addedClips) => {
              if (onUpdateUser && user) {
                onUpdateUser({
                  ...user,
                  bonusClips: (user.bonusClips || 0) + addedClips,
                });
              }
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Staffelrabatt bis zu -90%</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>100% Zero-Storage RAM-Pipeline</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>Keine Mindestvertragslaufzeit</span>
        </div>
      </div>
    </div>
  );
};
