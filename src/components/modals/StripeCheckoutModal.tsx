import React, { useState } from 'react';
import { X, CreditCard, ShieldCheck, CheckCircle2, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { StreamerUser, ModularSubscriptionConfig, ClipPackage } from '../../types/pipeline';
import { formatEur } from '../../config/stripeUnifiedConfig';

interface StripeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: StreamerUser | null;
  selectedPlan: ModularSubscriptionConfig | null;
  selectedClipPack: ClipPackage | null;
  billingCycle: 'monthly' | 'annual';
  isTrial?: boolean;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onSuccess: (result?: any) => void;
}

export const StripeCheckoutModal: React.FC<StripeCheckoutModalProps> = ({
  isOpen,
  onClose,
  user,
  selectedPlan,
  selectedClipPack,
  billingCycle,
  isTrial = false,
  onOpenTerms,
  onOpenPrivacy,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  if (!isOpen) return null;

  const title = isTrial
    ? '14-Tage Kostenlose Testphase (Basic-Abo)'
    : selectedPlan
    ? `Abonnement: ${selectedPlan.tierName}`
    : selectedClipPack
    ? `Clip-Paket: ${selectedClipPack.name}`
    : 'Stripe Checkout';

  const priceFormatted = isTrial
    ? '0,00 € (danach 12,00 €/Monat)'
    : selectedPlan
    ? billingCycle === 'annual'
      ? `${formatEur(selectedPlan.calculatedPriceAnnual)} / Monat (jährlich)`
      : `${formatEur(selectedPlan.calculatedPriceMonthly)} / Monat`
    : selectedClipPack
    ? selectedClipPack.price
    : '0,00 €';

  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setCheckoutError(null);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || 'streamer_guest',
          userEmail: user?.email,
          itemType: selectedClipPack ? 'clip_package' : 'subscription',
          planName: title,
          tierLevel: selectedPlan?.tierLevel,
          clipVolume: selectedPlan?.clipVolume || selectedClipPack?.clips,
          amountEur: selectedPlan
            ? (billingCycle === 'annual' ? selectedPlan.calculatedPriceAnnual * 12 : selectedPlan.calculatedPriceMonthly)
            : selectedClipPack?.priceNum,
          billingCycle,
          stripeProductId: selectedPlan?.stripeProductId,
          stripePriceId: selectedPlan?.stripePriceId,
          stripeMetadataCode: selectedPlan?.stripeMetadataCode,
          returnUrl: window.location.origin,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Erstellen der Stripe Checkout Session');
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      onSuccess({ success: true, sessionId: data.sessionId, timestamp: new Date().toISOString() });
    } catch (err: any) {
      console.error('Stripe Checkout Error:', err);
      setCheckoutError(err.message || 'Verbindungsfehler zur Stripe API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-auto w-full max-w-lg rounded-3xl border border-purple-500/30 bg-gradient-to-b from-[#140b2e] to-[#080518] p-6 sm:p-8 shadow-2xl space-y-6 text-zinc-100 backdrop:bg-black/80 backdrop:backdrop-blur-md block my-auto"
    >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white transition p-1"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 uppercase">
            <Lock className="h-3.5 w-3.5" /> STRIPE 256-BIT SSL VERSCHLÜSSELUNG
          </div>
          <h3 className="text-xl font-black font-display text-white">
            {title}
          </h3>
          <p className="text-xs text-zinc-400">
            Sichere Zahlungsabwicklung direkt über Stripe Payments Europe Ltd.
          </p>
        </div>

        {/* Order Summary Box */}
        <div className="rounded-2xl bg-zinc-900/70 border border-purple-500/20 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-300">Zu zahlender Betrag:</span>
            <span className="text-lg font-black text-white">{priceFormatted}</span>
          </div>
          <div className="text-xs text-zinc-400 border-t border-zinc-800 pt-2 space-y-1">
            <div className="flex justify-between">
              <span>Account:</span>
              <span className="text-zinc-200">{user?.email || user?.name || 'Streamer'}</span>
            </div>
            {isTrial && (
              <div className="text-emerald-400 text-[11px] font-semibold">
                ✓ Die ersten 14 Tage sind zu 100% kostenlos. Jederzeit mit 1 Klick kündbar.
              </div>
            )}
          </div>
        </div>

        {/* Payment Methods */}
        <div className="p-3.5 rounded-2xl bg-black/40 border border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-purple-400" />
            <span>Kreditkarte, SEPA, Apple Pay, Google Pay</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">Stripe Live</span>
        </div>

        <label className="flex items-start gap-2.5 text-[11px] text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="rounded bg-zinc-800 text-purple-600 mt-0.5"
          />
          <span>
            Ich akzeptiere die{' '}
            <button type="button" onClick={onOpenTerms} className="text-purple-400 underline">
              AGB
            </button>{' '}
            und{' '}
            <button type="button" onClick={onOpenPrivacy} className="text-purple-400 underline">
              Datenschutzbestimmungen
            </button>
            .
          </span>
        </label>

        {checkoutError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-mono">
            {checkoutError}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={loading || !acceptedTerms}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-purple-600/30 transition"
        >
          {loading ? (
            <span>Verarbeite mit Stripe...</span>
          ) : isTrial ? (
            <>
              <span>Kostenlose 14-Tage Testphase starten</span>
              <ArrowRight className="h-4 w-4" />
            </>
          ) : (
            <>
              <span>Jetzt sicher bezahlen</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
    </dialog>
  );
};
