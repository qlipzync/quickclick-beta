export const API_KEY_PREFIX = 'qc_live_';

export interface GeneratedApiKey {
  rawKey: string;
  hashedKey: string;
  keyPrefix: string;
}

export function isValidApiKeyFormat(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return key.trim().startsWith(API_KEY_PREFIX) && key.trim().length >= 32;
}

export function formatKeyPrefix(rawKey: string): string {
  if (!rawKey) return '';
  const clean = rawKey.trim();
  if (clean.length <= 16) return clean;
  return `${clean.slice(0, 16)}...`;
}
