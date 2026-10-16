import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Zap,
  CheckCircle2,
  TrendingDown,
} from 'lucide-react';
import { ClipQuotaInput, PricingDetails } from '../ClipQuotaInput';
import { DashboardTopup } from '../DashboardTopup';
import { SubscriptionPlan, ModularSubscriptionConfig } from '../../types/pipeline';

interface CentralStripePricingSectionProps {
  onOpenAuth: (preferredPlan?: SubscriptionPlan, initialChannel?: string) => void;
  onSelectPlan?: (plan: SubscriptionPlan) => void;
  onStartTrial?: () => void;
  onOpenStripeCheckout?: (plan: ModularSubscriptionConfig, cycle: 'monthly' | 'annual') => void;
  onBuyClipPackage?: (pkg: any) => void;
}

export const CentralStripePricingSection: React.FC<CentralStripePricingSectionProps> = ({
  onOpenAuth,
}) => {
  const [activeMode, setActiveMode] = useState<'subscription' | 'topup'>('subscription');
  const [quotaDetails, setQuotaDetails] = useState<PricingDetails>({
    clips: 100,
    unitPriceEur: 0.2907,
    totalPriceEur: 29.07,
    discountPercent: 42,
    isValid: true,
  });

  const handlePriceChange = React.useCallback((details: PricingDetails) => {
    setQuotaDetails((prev) => {
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

  return (
    <section id="pricing" className="rounded-3xl border border-emerald-500/30 bg-[#070b16] p-6 sm:p-12 shadow-2xl space-y-10 scroll-mt-24">
      {/* Header */}
      <header className="text-center space-y-4 w-full max-w-4xl mx-auto">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold tracking-wide uppercase">
          <Sparkles className="w-3.5 h-3.5" /> DYNAMISCHE PREISGESTALTUNG • 1 BIS 20.000 CLIPS
        </span>
        <h2 className="text-3xl sm:text-5xl font-black font-display uppercase tracking-tight text-white">
          Zahle nur, was du verbrauchst
        </h2>
        <p className="text-sm sm:text-base text-zinc-300 max-w-3xl mx-auto">
          Keine starren Pakete mehr. Wähle deine Wunschmenge von 1 bis 20.000 Clips pro Monat.
        </p>

        {/* Mode Selector: Monats-Abo vs. Sofort-Topup */}
        <nav aria-label="Abrechnungsmodus" className="inline-flex items-center p-1.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-inner mt-2">
          <button
            type="button"
            onClick={() => setActiveMode('subscription')}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeMode === 'subscription'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4 text-emerald-300" />
            <span>Monats-Abonnement wählen</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('topup')}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeMode === 'topup'
                ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="h-4 w-4 text-cyan-300" />
            <span>Google Pay Sofort-Topup</span>
            <span className="rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 border border-emerald-500/40">
              Direkt aufladen
            </span>
          </button>
        </nav>
      </header>

      {/* Main Pricing Interactive View */}
      <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-4xl mx-auto">
        {activeMode === 'subscription' ? (
          <>
            <ClipQuotaInput
              mode="register"
              initialValue={100}
              onPriceChange={handlePriceChange}
            />

            <button
              type="button"
              disabled={!quotaDetails.isValid}
              onClick={() => onOpenAuth('pro')}
              className="w-full max-w-4xl py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:opacity-50 text-white font-bold text-base transition shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Abo mit {quotaDetails.clips.toLocaleString()} Clips buchen ({quotaDetails.totalPriceEur.toFixed(2)} €/Mo)</span>
              <ArrowRight className="w-5 h-5 ml-1" />
            </button>
          </>
        ) : (
          <DashboardTopup userId="usr_94821a" />
        )}

        {/* Feature Highlights Grid */}
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full pt-6 border-t border-slate-800 list-none p-0 m-0">
          <li className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-1">
            <h3 className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <TrendingDown className="w-4 h-4" />
              <span>Staffelrabatt</span>
            </h3>
            <p className="text-xs text-slate-400">
              Automatische Rabattierung von 1 bis 20.000 Clips ohne manuelle Gutscheincodes.
            </p>
          </li>

          <li className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-1">
            <h3 className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Zap className="w-4 h-4" />
              <span>Zero-Storage</span>
            </h3>
            <p className="text-xs text-slate-400">
              Verarbeitung im RAM (0 MB persistenter Speicher) garantiert günstigste Betriebskosten.
            </p>
          </li>

          <li className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-1">
            <h3 className="flex items-center gap-2 text-purple-400 font-bold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Jederzeit kündbar</span>
            </h3>
            <p className="text-xs text-slate-400">
              Monatlich kündbar, Restguthaben verfällt nicht und bleibt im Konto erhalten.
            </p>
          </li>
        </ul>
      </div>
    </section>
  );
};
