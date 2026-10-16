import {
  PRESET_MODULAR_PLANS,
  BASIC_TRIAL_PLAN,
  FREE_STARTER_PLAN,
  CLIP_PACKAGES,
  STRIPE_OFFICIAL_TIERS,
  formatEur,
  getUnifiedPlanPrice,
} from '../config/stripeUnifiedConfig.js';
import {
  ModularSubscriptionConfig,
  ProgressiveTierLevel,
  SocialChannelsTier,
  UserEntitlements,
  DynamicPricingConfig,
} from '../types/pipeline.js';
import { calculateVerifiedTier } from '../services/pricingEngine.js';

export {
  PRESET_MODULAR_PLANS,
  BASIC_TRIAL_PLAN,
  FREE_STARTER_PLAN,
  CLIP_PACKAGES,
  STRIPE_OFFICIAL_TIERS,
  formatEur,
  getUnifiedPlanPrice,
};

export interface SystemCostAnalysis {
  monthlyTotalCustomerEur: number;
  googleCloudInfrastructureCostEur: number;
  stripeTransactionFeeEur: number;
  netSaaSProfitEur: number;
  profitMarginPercent: number;
}

export const DYNAMIC_PRICING_PRESETS = [
  { clips: 30, label: 'Starter', sub: '1 Clip / Tag', tier: 1 },
  { clips: 90, label: 'Basic', sub: '3 Clips / Tag', tier: 2 },
  { clips: 150, label: 'Pro Grow', sub: '5 Clips / Tag (Bestseller)', tier: 3 },
  { clips: 300, label: 'Studio', sub: '10 Clips / Tag', tier: 4 },
  { clips: 600, label: 'Titan', sub: '20 Clips / Tag', tier: 5 },
  { clips: 1000, label: 'Agency Max', sub: '33+ Clips / Tag', tier: 5 },
];

/**
 * Ermittelt stufenlos den monatlichen Preis über die verifizierte logarithmische Clip-Staffel (1 - 20.000 Clips):
 * - 0,50 € / Clip bei 1 Clip
 * - 0,05 € / Clip bei 20.000 Clips
 */
export function calculateContinuousMonthlyPrice(clips: number): number {
  const tier = calculateVerifiedTier(clips) || calculateVerifiedTier(100)!;
  return tier.monthlyTotalEur;
}

/**
 * Berechnet alle Zugriffsrechte & Entitlements auf Basis der konfigurierten Clip-Menge
 */
export function getEntitlementsForClipVolume(clipVolume: number): UserEntitlements {
  const safeClips = Math.max(15, Math.round(clipVolume));
  const dailyClips = Math.max(1, Math.ceil(safeClips / 30));
  const apiCalls = safeClips * 8;

  if (safeClips < 60) {
    return {
      canExport4K: false,
      canUseAiDubbing: false,
      canUseFaceTracking: false,
      canUseMultiStream: false,
      canUseWhiteLabel: false,
      priorityRendering: false,
      teamGoogleSheet: false,
      maxSocialChannels: 1,
      allowedPlatforms: ['tiktok'],
      autoPublish: true,
      dailyClipsLimit: dailyClips,
      apiCallsLimit: apiCalls,
    };
  }
  if (safeClips < 120) {
    return {
      canExport4K: false,
      canUseAiDubbing: false,
      canUseFaceTracking: false,
      canUseMultiStream: false,
      canUseWhiteLabel: false,
      priorityRendering: false,
      teamGoogleSheet: false,
      maxSocialChannels: 2,
      allowedPlatforms: ['tiktok', 'youtubeShorts'],
      autoPublish: true,
      dailyClipsLimit: dailyClips,
      apiCallsLimit: apiCalls,
    };
  }
  if (safeClips < 250) {
    return {
      canExport4K: false,
      canUseAiDubbing: false,
      canUseFaceTracking: true,
      canUseMultiStream: false,
      canUseWhiteLabel: false,
      priorityRendering: false,
      teamGoogleSheet: false,
      maxSocialChannels: 3,
      allowedPlatforms: ['tiktok', 'youtubeShorts', 'instagramReels'],
      autoPublish: true,
      dailyClipsLimit: dailyClips,
      apiCallsLimit: apiCalls,
    };
  }
  if (safeClips < 500) {
    return {
      canExport4K: false,
      canUseAiDubbing: false,
      canUseFaceTracking: true,
      canUseMultiStream: true,
      canUseWhiteLabel: false,
      priorityRendering: true,
      teamGoogleSheet: true,
      maxSocialChannels: 4,
      allowedPlatforms: ['tiktok', 'youtubeShorts', 'instagramReels', 'twitter'],
      autoPublish: true,
      dailyClipsLimit: dailyClips,
      apiCallsLimit: apiCalls,
    };
  }
  // 500+ Clips (Titan Tier)
  return {
    canExport4K: true,
    canUseAiDubbing: true,
    canUseFaceTracking: true,
    canUseMultiStream: true,
    canUseWhiteLabel: true,
    priorityRendering: true,
    teamGoogleSheet: true,
    maxSocialChannels: 5,
    allowedPlatforms: ['tiktok', 'youtubeShorts', 'instagramReels', 'twitter', 'threads'],
    autoPublish: true,
    dailyClipsLimit: dailyClips,
    apiCallsLimit: apiCalls,
  };
}

/**
 * Vollständige dynamische Preisberechnung mit Nutzungslimits, Regeln und Zugriffsrechten
 */
export function calculateDynamicPricing(
  clipVolume: number,
  billingCycle: 'monthly' | 'annual' = 'annual'
): DynamicPricingConfig {
  const safeClips = Math.max(15, Math.min(2500, Math.round(clipVolume)));
  const monthlyBasePrice = calculateContinuousMonthlyPrice(safeClips);
  const isAnnual = billingCycle === 'annual';

  const annualMonthlyEquivalent = monthlyBasePrice * 0.8;
  const annualTotal = annualMonthlyEquivalent * 12;
  const annualSavings = (monthlyBasePrice * 12) - annualTotal;

  const currentDisplayMonthly = isAnnual ? annualMonthlyEquivalent : monthlyBasePrice;
  const pricePerClipMonthly = monthlyBasePrice / safeClips;
  const pricePerClipAnnual = annualMonthlyEquivalent / safeClips;

  // Stufen-Zuordnung
  let tierLevel: ProgressiveTierLevel = 1;
  let tierName = 'Starter';
  let resolution = '720p 30fps HD';
  let maxDurationSec = 60;
  let channelsCount: SocialChannelsTier = 1;
  let aiFeatures: string[] = ['Standard Metadaten & SEO-Titel', 'Google Sheets Zero-RAM Logging', 'Twitch VOD Auto-Slicing'];

  if (safeClips < 60) {
    tierLevel = 1;
    tierName = 'Stufe 1 • Starter';
    resolution = '720p 30fps HD';
    maxDurationSec = 60;
    channelsCount = 1;
    aiFeatures = [
      'Standard Metadaten & SEO-Titel',
      'Google Sheets Zero-RAM Logging',
      'Twitch VOD Auto-Slicing',
      '0 MB permanenter Speicher',
    ];
  } else if (safeClips < 120) {
    tierLevel = 2;
    tierName = 'Stufe 2 • Basic';
    resolution = '1080p 60fps Full HD';
    maxDurationSec = 60;
    channelsCount = 2;
    aiFeatures = [
      'KI-Untertitel mit dynamischen Farben',
      'TikTok & YouTube Shorts Auto-Sync',
      '1080p 60fps Transcoding',
      '14 Tage Testphase berechtigt',
    ];
  } else if (safeClips < 250) {
    tierLevel = 3;
    tierName = 'Stufe 3 • Pro Grow';
    resolution = '1080p HDR Color Boost';
    maxDurationSec = 90;
    channelsCount = 3;
    aiFeatures = [
      'KI Face-Tracking & 9:16 Smart-Crop',
      'Virale Punchline & Hook Score',
      'TikTok + Shorts + Reels',
      'HDR Color Grading',
    ];
  } else if (safeClips < 500) {
    tierLevel = 4;
    tierName = 'Stufe 4 • Studio';
    resolution = '1080p Ultra-Fast Master (< 45s)';
    maxDurationSec = 120;
    channelsCount = 4;
    aiFeatures = [
      'Multi-Stream Monitoring (Twitch + Kick)',
      'Team Google Sheets Kollaboration',
      'Prioritäts-Renderqueue (< 45s)',
      'Erweiterte Metadaten-Generierung',
    ];
  } else {
    tierLevel = 5;
    tierName = 'Stufe 5 • Titan';
    resolution = '2K / 4K Pro Master (Sofort < 30s)';
    maxDurationSec = 180;
    channelsCount = 5;
    aiFeatures = [
      'Multilingual AI Voice-Dubbing (12 Sprachen)',
      'White-Label Branding Bot',
      '2K/4K Pro Master (< 30s Transcode)',
      '24/7 Vollautonomie & VIP Support',
    ];
  }

  const officialTier = STRIPE_OFFICIAL_TIERS[tierLevel];
  const entitlements = getEntitlementsForClipVolume(safeClips);

  // Systemkosten-Kalkulation (Transparenz für Streamer & Admin)
  const gcpEstimate = Math.max(0.15, currentDisplayMonthly * 0.32);
  const stripeFee = currentDisplayMonthly > 0 ? currentDisplayMonthly * 0.029 + 0.25 : 0;
  const totalCost = gcpEstimate + stripeFee;
  const netProfit = Math.max(0, currentDisplayMonthly - totalCost);
  const marginPercent = currentDisplayMonthly > 0 ? Math.round((netProfit / currentDisplayMonthly) * 100) : 0;

  return {
    clipVolume: safeClips,
    dailyClips: entitlements.dailyClipsLimit,
    apiCallsLimit: entitlements.apiCallsLimit,
    tierLevel,
    tierName,
    monthlyPriceEur: Number(monthlyBasePrice.toFixed(2)),
    annualPriceEur: Number(annualTotal.toFixed(2)),
    annualMonthlyEquivalentEur: Number(annualMonthlyEquivalent.toFixed(2)),
    pricePerClipMonthly: Number(pricePerClipMonthly.toFixed(3)),
    pricePerClipAnnual: Number(pricePerClipAnnual.toFixed(3)),
    savingsAnnualEur: Number(annualSavings.toFixed(2)),
    socialChannelsCount: channelsCount,
    resolution,
    maxDurationSec,
    aiFeatures,
    entitlements,
    systemCosts: {
      monthlyTotalCustomerEur: Number(currentDisplayMonthly.toFixed(2)),
      googleCloudInfrastructureCostEur: Number(gcpEstimate.toFixed(2)),
      stripeTransactionFeeEur: Number(stripeFee.toFixed(2)),
      netSaaSProfitEur: Number(netProfit.toFixed(2)),
      profitMarginPercent: marginPercent,
    },
    stripeProductId: officialTier.productId,
    stripePriceId: officialTier.priceId,
    stripeMetadataCode: officialTier.tierCode,
  };
}

/**
 * Konvertiert eine DynamicPricingConfig in ein valides ModularSubscriptionConfig
 */
export function convertDynamicToModularConfig(
  dynamicConfig: DynamicPricingConfig,
  billingCycle: 'monthly' | 'annual' = 'annual'
): ModularSubscriptionConfig {
  return {
    clipVolume: dynamicConfig.clipVolume,
    socialChannelsCount: dynamicConfig.socialChannelsCount,
    connectedPlatforms: dynamicConfig.entitlements.allowedPlatforms,
    renderTier: dynamicConfig.tierLevel,
    aiSpeechTier: dynamicConfig.tierLevel,
    videoCropTier: dynamicConfig.tierLevel,
    monitoringTier: dynamicConfig.tierLevel,
    publishingTier: dynamicConfig.tierLevel,
    brandingTier: dynamicConfig.tierLevel,
    enableAiSubtitles: dynamicConfig.tierLevel >= 2,
    enableFaceCrop916: dynamicConfig.tierLevel >= 3,
    enableMultiStreamMonitoring: dynamicConfig.tierLevel >= 4,
    enableWhiteLabelBot: dynamicConfig.tierLevel >= 5,
    billingCycle,
    calculatedPriceMonthly: dynamicConfig.monthlyPriceEur,
    calculatedPriceAnnual: dynamicConfig.annualMonthlyEquivalentEur,
    tierName: `${dynamicConfig.tierName} (${dynamicConfig.clipVolume} Clips/Mo)`,
    tierLevel: dynamicConfig.tierLevel,
    stripeProductId: dynamicConfig.stripeProductId,
    stripePriceId: dynamicConfig.stripePriceId,
    stripeMetadataCode: dynamicConfig.stripeMetadataCode,
    description: `Individuelle dynamische Konfiguration: ${dynamicConfig.clipVolume} Clips/Monat (${dynamicConfig.dailyClips} Clips/Tag), ${dynamicConfig.resolution}, ${dynamicConfig.socialChannelsCount} Kanäle.`,
  };
}

export function calculateModularPrice(config: Partial<ModularSubscriptionConfig>): number {
  const clips = config.clipVolume || 100;
  const tier = calculateVerifiedTier(clips) || calculateVerifiedTier(100)!;
  return tier.monthlyTotalEur;
}

export function calculateGoogleSystemCostsAndFairProfit(
  tierLevel: ProgressiveTierLevel | number,
  isAnnual: boolean = false
): SystemCostAnalysis {
  const safeLevel = (Math.max(1, Math.min(5, Math.round(tierLevel)))) as ProgressiveTierLevel;
  const official = STRIPE_OFFICIAL_TIERS[safeLevel] || STRIPE_OFFICIAL_TIERS[1];
  const customerPaysMonthly = isAnnual ? official.annualMonthlyEquivalentEur : official.monthlyPriceEur;

  // Approximate Google Cloud & external infrastructure costs
  const gcpEstimate = Math.max(0.10, customerPaysMonthly * (1 - official.adminMarginPercent / 100) * 0.7);
  const stripeFee = customerPaysMonthly > 0 ? (customerPaysMonthly * 0.029) + 0.25 : 0;
  const totalCost = gcpEstimate + stripeFee;
  const netProfit = Math.max(0, customerPaysMonthly - totalCost);
  const margin = customerPaysMonthly > 0 ? Math.round((netProfit / customerPaysMonthly) * 100) : 0;

  return {
    monthlyTotalCustomerEur: Number(customerPaysMonthly.toFixed(2)),
    googleCloudInfrastructureCostEur: Number(gcpEstimate.toFixed(2)),
    stripeTransactionFeeEur: Number(stripeFee.toFixed(2)),
    netSaaSProfitEur: Number(netProfit.toFixed(2)),
    profitMarginPercent: margin,
  };
}
