import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';
import { PlatformsStatusResponse, SupportedPlatform } from '../types/api';

export function usePlatformStatus(isSubscribed: boolean) {
  const [platforms, setPlatforms] = useState<PlatformsStatusResponse['platforms'] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<SupportedPlatform | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPlatforms = useCallback(async () => {
    // Endpunkt erfordert aktives Abo; ohne Abo wird der Aufruf clientseitig gar nicht erst abgeschickt
    if (!isSubscribed) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient<PlatformsStatusResponse>('/platforms/status', {
        method: 'GET',
      });
      setPlatforms(response.platforms);
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Plattform-Status konnte nicht geladen werden.';
      if (!message.includes('Nicht authentifiziert')) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSubscribed]);

  useEffect(() => {
    void fetchPlatforms();
  }, [fetchPlatforms]);

  // Twitch OAuth-Code an das Backend übermitteln (Backend übernimmt Token-Austausch & KMS)
  const linkTwitchAccount = async (code: string, redirectUri: string): Promise<boolean> => {
    setActionLoading('twitch');
    setError(null);

    try {
      await apiClient<{ success: boolean; accountName: string }>('/platforms/callback/twitch', {
        method: 'POST',
        body: JSON.stringify({ code, redirectUri }),
      });
      await fetchPlatforms();
      return true;
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Twitch-Verknüpfung fehlgeschlagen.';
      setError(message);
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  // Plattform trennen
  const disconnectPlatform = async (platform: SupportedPlatform): Promise<boolean> => {
    setActionLoading(platform);
    setError(null);

    try {
      await apiClient<{ success: boolean }>(`/platforms/disconnect/${platform}`, {
        method: 'POST',
      });
      await fetchPlatforms();
      return true;
    } catch (err: any) {
      const message = err instanceof Error ? err.message : `Fehler beim Trennen von ${platform}.`;
      setError(message);
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  return {
    platforms,
    isLoading,
    actionLoading,
    error,
    refreshPlatforms: fetchPlatforms,
    linkTwitchAccount,
    disconnectPlatform,
  };
}
