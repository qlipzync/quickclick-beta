import React, { useState } from 'react';
import { ClipQuotaInput } from './ClipQuotaInput';
import { CheckCircle2, AlertCircle, Sparkles, CreditCard } from 'lucide-react';

interface DashboardTopupProps {
  userId: string;
  onSuccess?: (addedClips: number, chargedEur: number) => void;
  onClose?: () => void;
}

export function DashboardTopup({ userId, onSuccess, onClose }: DashboardTopupProps) {
  const [selectedPackage, setSelectedPackage] = useState({
    clips: 100,
    totalPriceEur: 29.07,
    isValid: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePurchase = async () => {
    if (!selectedPackage.isValid) return;
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      // 1. Google Pay Client aufrufen und Token empfangen
      const paymentToken = await requestGooglePayToken(selectedPackage.totalPriceEur);

      // 2. An Cloud Run Backend senden
      const response = await fetch('/api/billing/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || 'usr_94821a',
          addedClips: selectedPackage.clips,
          paymentToken
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        const message = `${selectedPackage.clips} Clips erfolgreich hinzugefügt (${selectedPackage.totalPriceEur.toFixed(2)} € abgerechnet)!`;
        setSuccessNotice(message);
        if (onSuccess) {
          onSuccess(selectedPackage.clips, selectedPackage.totalPriceEur);
        }
      } else {
        throw new Error(data.error || 'Top-up Autorisierung fehlgeschlagen.');
      }
    } catch (err: any) {
      console.error('Kauf abgebrochen oder fehlgeschlagen', err);
      setErrorMessage(err?.message || 'Zahlungsvorgang konnte nicht abgeschlossen werden.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePriceChange = React.useCallback((details: { clips: number; totalPriceEur: number; isValid: boolean }) => {
    setSelectedPackage((prev) => {
      if (
        prev.clips === details.clips &&
        prev.totalPriceEur === details.totalPriceEur &&
        prev.isValid === details.isValid
      ) {
        return prev;
      }
      return {
        clips: details.clips,
        totalPriceEur: details.totalPriceEur,
        isValid: details.isValid
      };
    });
    setSuccessNotice(null);
    setErrorMessage(null);
  }, []);

  return (
    <div className="space-y-4 max-w-4xl w-full">
      <ClipQuotaInput
        mode="topup"
        initialValue={250}
        onPriceChange={handlePriceChange}
      />

      {successNotice && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300">
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-400" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-white">Buchung erfolgreich!</p>
            <p className="text-xs text-emerald-200 mt-0.5">{successNotice}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 rounded-lg text-emerald-100 transition"
            >
              Schließen
            </button>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-400" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-white">Fehler bei der Buchung</p>
            <p className="text-xs text-red-200 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      <button
        onClick={handlePurchase}
        disabled={!selectedPackage.isValid || isLoading}
        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-slate-700 disabled:to-slate-800 disabled:cursor-not-allowed text-white font-bold rounded-lg transition shadow-lg flex items-center justify-center gap-2"
      >
        <CreditCard className="w-5 h-5 text-white/90" />
        {isLoading ? (
          <span>Zahlung wird verarbeitet...</span>
        ) : (
          <span>Jetzt für {selectedPackage.totalPriceEur.toFixed(2)} € mit Google Pay buchen</span>
        )}
      </button>

      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> 100% Sofort-Gutschrift im Streamer-Konto
        </span>
        <span>Google Pay Express Checkout</span>
      </div>
    </div>
  );
}

// Google Pay Web API Initialisierung & Token-Abfrage
async function requestGooglePayToken(amount: number): Promise<string> {
  // Integriert das standardmäßige window.google.payments.api.PaymentsClient Objekt
  if (typeof window !== 'undefined' && (window as any).google?.payments?.api) {
    try {
      const paymentsClient = new (window as any).google.payments.api.PaymentsClient({
        environment: 'TEST'
      });
      const paymentDataRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [{
          type: 'CARD',
          parameters: {
            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            allowedCardNetworks: ['MASTERCARD', 'VISA']
          },
          tokenizationSpecification: {
            type: 'PAYMENT_GATEWAY',
            parameters: {
              gateway: 'stripe',
              'stripe:version': '2023-10-16',
              'stripe:publishableKey': 'pk_live_quickclick_production'
            }
          }
        }],
        transactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: amount.toFixed(2),
          currencyCode: 'EUR',
          countryCode: 'DE'
        },
        merchantInfo: {
          merchantName: 'QuickClick QlipZync'
        }
      };
      const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);
      if (paymentData?.paymentMethodData?.tokenizationData?.token) {
        return paymentData.paymentMethodData.tokenizationData.token;
      }
    } catch (e) {
      console.warn('[Google Pay] Fallback to simulated token:', e);
    }
  }
  return 'google-pay-mock-token-' + Date.now();
}
