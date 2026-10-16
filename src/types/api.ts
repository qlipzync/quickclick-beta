export interface PlatformDetails {
  connected: boolean;
  accountName: string | null;
  updatedAt: string | null;
}

export interface PlatformsStatusResponse {
  platforms: {
    twitch: PlatformDetails;
    youtube: PlatformDetails;
    tiktok: PlatformDetails;
  };
}

export type SupportedPlatform = 'twitch' | 'youtube' | 'tiktok';

export interface SubscriptionStatusResponse {
  isSubscribed: boolean;
  tier: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface CheckoutResponse {
  checkoutUrl: string;
}

export interface ApiError {
  error: string;
  message: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

export interface ApiKeysResponse {
  success: boolean;
  keys: ApiKeyItem[];
}

export interface CreateApiKeyResponse {
  success: boolean;
  id: string;
  key: string;
  name: string;
  keyPrefix: string;
  message?: string;
}
