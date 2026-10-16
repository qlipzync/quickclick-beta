import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/apiClient';
import { ApiKeyItem, ApiKeysResponse, CreateApiKeyResponse } from '../types/api';

export function useApiKeys(isSubscribed: boolean) {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [newGeneratedKey, setNewGeneratedKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!isSubscribed) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient<ApiKeysResponse>('/api-keys', {
        method: 'GET',
      });
      if (response && Array.isArray(response.keys)) {
        setKeys(response.keys);
      }
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'API-Schlüssel konnten nicht geladen werden.';
      if (!message.includes('Nicht authentifiziert')) {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSubscribed]);

  useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  const createKey = async (name: string): Promise<string | null> => {
    if (!name.trim()) return null;
    setActionLoading(true);
    setError(null);

    try {
      const response = await apiClient<CreateApiKeyResponse>('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });

      if (response && response.key) {
        setNewGeneratedKey(response.key);
        setNewKeyName('');
        await fetchKeys();
        return response.key;
      }
      return null;
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Fehler beim Erstellen des API-Schlüssels.';
      setError(message);
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const revokeKey = async (keyId: string): Promise<boolean> => {
    setActionLoading(true);
    setError(null);

    try {
      await apiClient<{ success: boolean }>(`/api-keys/${keyId}`, {
        method: 'DELETE',
      });
      await fetchKeys();
      return true;
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Fehler beim Widerrufen des API-Schlüssels.';
      setError(message);
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const clearGeneratedKey = () => {
    setNewGeneratedKey(null);
  };

  return {
    keys,
    newGeneratedKey,
    newKeyName,
    setNewKeyName,
    isLoading,
    actionLoading,
    error,
    createKey,
    revokeKey,
    clearGeneratedKey,
    refreshKeys: fetchKeys,
  };
}
