import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';
import { SubscriptionStatusResponse, CheckoutResponse } from '../types/api';

export function useSubscription() {
  const [data, setData] = useState<SubscriptionStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptionStatus = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient<SubscriptionStatusResponse>('/subscription/status', {
        method: 'GET',
        forceTokenRefresh: forceRefresh,
      });
      setData(response);
    } catch (err: any) {
      // If user is not yet logged in with Firebase, don't crash
      const message = err instanceof Error ? err.message : 'Fehler beim Laden des Abo-Status.';
      if (!message.includes('Nicht authentifiziert')) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSubscriptionStatus();
  }, [fetchSubscriptionStatus]);

  const initiateCheckout = async (priceId: string): Promise<void> => {
    setIsProcessingCheckout(true);
    setError(null);

    try {
      const successUrl = `${window.location.origin}/?payment=success#dashboard`;
      const cancelUrl = `${window.location.origin}/?payment=cancelled#pricing`;

      const response = await apiClient<CheckoutResponse>('/subscription/checkout', {
        method: 'POST',
        body: JSON.stringify({ priceId, successUrl, cancelUrl }),
      });

      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      } else {
        throw new Error('Keine Weiterleitungs-URL erhalten.');
      }
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Checkout-Initialisierung fehlgeschlagen.';
      setError(message);
      setIsProcessingCheckout(false);
    }
  };

  return {
    subscription: data,
    isSubscribed: Boolean(data?.isSubscribed),
    tier: data?.tier ?? 'free',
    isLoading,
    isProcessingCheckout,
    error,
    refreshSubscription: () => fetchSubscriptionStatus(true),
    initiateCheckout,
  };
}
