export type ProgressiveTierLevel = 1 | 2 | 3 | 4 | 5;
export type SocialChannelsTier = 1 | 2 | 3 | 4 | 5;
export type SubscriptionPlan = 'none' | 'free' | 'starter' | 'basic' | 'creator' | 'pro' | 'elite' | 'titan';

export interface ModularSubscriptionConfig {
  clipVolume: number;
  socialChannelsCount: SocialChannelsTier;
  connectedPlatforms: string[];
  renderTier: number;
  aiSpeechTier: number;
  videoCropTier: number;
  monitoringTier: number;
  publishingTier: number;
  brandingTier: number;
  enableAiSubtitles: boolean;
  enableFaceCrop916: boolean;
  enableMultiStreamMonitoring: boolean;
  enableWhiteLabelBot: boolean;
  billingCycle: 'monthly' | 'annual';
  calculatedPriceMonthly: number;
  calculatedPriceAnnual: number;
  tierName: string;
  tierLevel: ProgressiveTierLevel;
  stripeProductId?: string;
  stripePriceId?: string;
  stripeMetadataCode?: string;
  description: string;
}

export interface UserEntitlements {
  canExport4K: boolean;
  canUseAiDubbing: boolean;
  canUseFaceTracking: boolean;
  canUseMultiStream: boolean;
  canUseWhiteLabel: boolean;
  priorityRendering: boolean;
  teamGoogleSheet: boolean;
  maxSocialChannels: SocialChannelsTier;
  allowedPlatforms: string[];
  autoPublish: boolean;
  dailyClipsLimit: number;
  apiCallsLimit: number;
}

export interface DynamicPricingConfig {
  clipVolume: number;
  dailyClips: number;
  apiCallsLimit: number;
  tierLevel: ProgressiveTierLevel;
  tierName: string;
  monthlyPriceEur: number;
  annualPriceEur: number;
  annualMonthlyEquivalentEur: number;
  pricePerClipMonthly: number;
  pricePerClipAnnual: number;
  savingsAnnualEur: number;
  socialChannelsCount: SocialChannelsTier;
  resolution: string;
  maxDurationSec: number;
  aiFeatures: string[];
  entitlements: UserEntitlements;
  systemCosts: {
    monthlyTotalCustomerEur: number;
    googleCloudInfrastructureCostEur: number;
    stripeTransactionFeeEur: number;
    netSaaSProfitEur: number;
    profitMarginPercent: number;
  };
  stripeProductId?: string;
  stripePriceId?: string;
  stripeMetadataCode?: string;
}

export interface ClipPackage {
  id: string;
  name: string;
  clips: number;
  price: string;
  priceNum: number;
  pricePerClip: string;
  popular?: boolean;
  description: string;
  badge?: string;
}

export interface QuickClickSettings {
  autoPublish?: boolean;
  verticalCropMode?: 'facecam_top_gameplay_bottom' | 'center' | 'split';
  aiSubtitlesEnabled?: boolean;
  aiHooksEnabled?: boolean;
  cooldownMinutes?: number;
  notificationDiscord?: boolean;
  notificationTelegram?: boolean;
  targetPlatforms?: string[];
  discordWebhookUrl?: string;
  telegramChatId?: string;
  socialInvites?: {
    xTwitter: boolean;
    tikTok: boolean;
    instagram: boolean;
    threads: boolean;
    youtubeShorts: boolean;
    customMessage: string;
    appendGameName: boolean;
    appendTwitchUrl: boolean;
    sendTwentyMinReminder: boolean;
    customReminderMessage: string;
    distributeToAllConnected: boolean;
  };
  botSync?: {
    discordWebhook: boolean;
    discordWebhookUrl: string;
    telegramBot: boolean;
    telegramChatId: string;
    pingRole: string;
    embedColor: string;
    includeThumbnail: boolean;
    sendLiveUpdatesDuringStream: boolean;
    intervalMinutes: number;
    liveUpdateMessage: string;
    sendFarewellOnOffline: boolean;
    farewellMessage: string;
  };
  communityOutro?: {
    sendFarewell: boolean;
    thankRaiders: boolean;
    postStreamStats: boolean;
    discordOutroMessage: string;
    telegramOutroMessage: string;
    nextStreamDate: string;
  };
  zeroStorageClip?: {
    waitForMinutes: number;
    autoFetchClips: boolean;
    aiSmartCrop9x16: boolean;
    uploadToTikTok: boolean;
    uploadToShorts: boolean;
    uploadToInstagramReels: boolean;
    deleteMp4ImmediatelyAfterUpload: boolean;
    syncToGoogleSheets: boolean;
    googleSheetName: string;
  };
  healthAgent?: {
    deduplicationLock: boolean;
    signatureVerification: boolean;
    autoRetryFailedSteps: boolean;
    maxRetries: number;
    alertOnFailure: boolean;
    memoryLeakProtector: boolean;
  };
}

export interface GoogleSheetsRow {
  timestamp: string;
  channelName: string;
  eventType: string;
  streamTitle?: string;
  viewerCount?: number;
  liveInviteUrl?: string;
  reminderPostUrl?: string;
  farewellStatus?: string;
  tiktokUrl?: string;
  youtubeShortsUrl?: string;
  instagramReelsUrl?: string;
  twitterUrl?: string;
  status: string;
}

export interface StreamerUser {
  id: string;
  email?: string;
  name?: string;
  channelName?: string;
  displayName?: string;
  avatarUrl?: string;
  isLive?: boolean;
  streamTitle?: string;
  game?: string;
  viewers?: number;
  role: 'streamer' | 'admin' | 'vip';
  isAdmin?: boolean;
  isTitanVip?: boolean;
  isGuest?: boolean;
  hasActiveSubscription: boolean;
  plan: SubscriptionPlan;
  clipsLimitTotal: number;
  apiCallsLimit: number;
  clipsUsedCount?: number;
  clipsUsedThisMonth?: number;
  apiCallsUsedCount?: number;
  apiCallsUsed?: number;
  extraPacksPurchased?: number;
  referralCount?: number;
  referralsCount?: number;
  referralCode?: string;
  earnedCredits?: number;
  bonusClips?: number;
  byokConfig?: {
    enabled: boolean;
    geminiApiKey?: string;
    googleDriveFolderId?: string;
  };
  walletBalanceEur?: number;
  modularConfig?: ModularSubscriptionConfig;
  dynamicPricingConfig?: DynamicPricingConfig;
  entitlements?: UserEntitlements;
  trialActive?: boolean;
  trialStartedAt?: string;
  trialEndsAt?: string;
  trialPlan?: SubscriptionPlan;
  trialPriceAfterEur?: number;
  trialConvertedToPaid?: boolean;
  trialCancelled?: boolean;
  isFullyConfigured?: boolean;
  onboardingStep?: number;
  googleSheetId?: string;
  googleSheetUrl?: string;
  twitchConnected?: boolean;
  googleConnected?: boolean;
  twoFactorEnabled?: boolean;
  twoFactorAuth?: {
    isEnabled: boolean;
    isVerified: boolean;
    method: string;
    secretKey?: string;
    backupCodes?: string[];
  };
  channelConfigs?: Record<string, any>;
  connectedPlatforms?: string[];
  settings?: QuickClickSettings;
  apiUsageHistory?: Array<{
    timestamp: string;
    calls: number;
    endpoint: string;
    status: number;
    latencyMs: number;
  }>;
  apiBreakdown?: {
    geminiAiHooks: number;
    whisperSubtitles: number;
    smartCrop916: number;
    platformDispatch: number;
  };
  createdAt?: string;
  updatedAt?: string;
}
