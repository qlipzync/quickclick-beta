import { getAuth } from 'firebase/auth';

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || '/api/v1';

export interface RequestOptions extends RequestInit {
  forceTokenRefresh?: boolean;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Nicht authentifiziert. Bitte melden Sie sich an.');
  }

  // Frisches ID-Token abrufen (Custom Claims wie subscribed: true werden bei Refresh aktualisiert)
  const token = await user.getIdToken(options.forceTokenRefresh ?? false);

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;

  const response = await fetch(`${baseUrl}${normalizedEndpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorPayload: { error?: string; message?: string } = {};
    try {
      errorPayload = await response.json();
    } catch {
      errorPayload = {
        error: 'HTTP_ERROR',
        message: `HTTP Fehler ${response.status}: ${response.statusText}`,
      };
    }

    const error = new Error(errorPayload.message || 'Anfrage fehlgeschlagen');
    (error as Error & { code?: string; status?: number }).code = errorPayload.error;
    (error as Error & { code?: string; status?: number }).status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}
