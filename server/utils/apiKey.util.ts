import crypto from 'crypto';

export const API_KEY_PREFIX = 'qc_live_';

export interface GeneratedApiKey {
  rawKey: string;
  hashedKey: string;
  keyPrefix: string;
}

/**
 * Generiert einen sicheren, unvorhersehbaren 256-Bit API-Schlüssel mit Prefix.
 */
export function generateSecureApiKey(): GeneratedApiKey {
  const entropy = crypto.randomBytes(32).toString('hex');
  const rawKey = `${API_KEY_PREFIX}${entropy}`;
  const hashedKey = hashApiKey(rawKey);
  const keyPrefix = `${rawKey.slice(0, 16)}...`;

  return {
    rawKey,
    hashedKey,
    keyPrefix,
  };
}

/**
 * Erzeugt einen SHA-256 Hash des API-Schlüssels für den Datenbankabgleich.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
}
