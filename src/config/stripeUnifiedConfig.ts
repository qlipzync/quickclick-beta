import { ModularSubscriptionConfig, ClipPackage, ProgressiveTierLevel, SocialChannelsTier } from '../types/pipeline.js';

export interface StripeOfficialTier {
  tierLevel: ProgressiveTierLevel;
  tierCode: 'abo1' | 'abo2' | 'abo3' | 'abo4' | 'abo5';
  name: string;
  displayName: string;
  productId: string;
  priceId: string;
  monthlyPriceEur: number;
  annualPriceEur: number; // 20% discount: monthly * 0.8 * 12
  annualMonthlyEquivalentEur: number; // monthly * 0.8
  clipVolume: number;
  dailyClips: number;
  socialChannelsCount: SocialChannelsTier;
  adminMarginPercent: number;
  metadataKey: string;
  metadataVal: string;
  description: string;
  channelsDescription: string;
  resolution: string;
  aiFeatures: string;
}

/**
 * 👑 OFFIZIELLE STRIPE PRODUKT- & PREIS-DEFINITIONEN (EINZIGE SOURCE OF TRUTH)
 * Synchronisiert mit Stripe Live-Katalog & allen Landingpage-Sektionen.
 */
export const STRIPE_OFFICIAL_TIERS: Record<ProgressiveTierLevel, StripeOfficialTier> = {
  1: {
    tierLevel: 1,
    tierCode: 'abo1',
    name: 'Starter',
    displayName: 'Stufe 1 • Starter',
    productId: 'prod_VI7fizMtnmRrJs',
    priceId: 'price_1UHXQDGvVjdBryCgFpPxcIeD',
    monthlyPriceEur: 3.0,
    annualPriceEur: 28.8,
    annualMonthlyEquivalentEur: 2.4,
    clipVolume: 30,
    dailyClips: 1,
    socialChannelsCount: 1,
    adminMarginPercent: 40,
    metadataKey: 'STARTER_ABO',
    metadataVal: 'Abo1',
    description: '1 Clip pro Tag (30 Clips/Monat) auf 1 Kanal (TikTok), 720p HD Transcoding, Google Sheets Logging, 0 MB Speicherbedarf.',
    channelsDescription: '1 Kanal: TikTok',
    resolution: '720p 30fps',
    aiFeatures: 'Standard Metadaten',
  },
  2: {
    tierLevel: 2,
    tierCode: 'abo2',
    name: 'Basic',
    displayName: 'Stufe 2 • Basic',
    productId: 'prod_VI7huDDXgyGUjg',
    priceId: 'price_1UHXSQGvVjdBryCgWpDTqmxR',
    monthlyPriceEur: 12.0,
    annualPriceEur: 115.2,
    annualMonthlyEquivalentEur: 9.6,
    clipVolume: 90,
    dailyClips: 3,
    socialChannelsCount: 2,
    adminMarginPercent: 33,
    metadataKey: 'BASIC_ABO',
    metadataVal: 'Abo2',
    description: '3 Clips pro Tag (90 Clips/Monat) auf 2 Kanäle (TikTok + Shorts), 1080p 60fps, KI-Untertitel, Option auf 14 Tage kostenlose Testphase.',
    channelsDescription: '2 Kanäle: TikTok + YouTube Shorts',
    resolution: '1080p 60fps',
    aiFeatures: 'KI Hook & dynamische Untertitel',
  },
  3: {
    tierLevel: 3,
    tierCode: 'abo3',
    name: 'Pro Grow',
    displayName: 'Stufe 3 • Pro Grow',
    productId: 'prod_VI7lxjYB503Gdo',
    priceId: 'price_1UHXWEGvVjdBryCgf9yx5vY9',
    monthlyPriceEur: 21.0,
    annualPriceEur: 201.6,
    annualMonthlyEquivalentEur: 16.8,
    clipVolume: 150,
    dailyClips: 5,
    socialChannelsCount: 3,
    adminMarginPercent: 25,
    metadataKey: 'PRO_ABO',
    metadataVal: 'Abo3',
    description: '5 Clips pro Tag (150 Clips/Monat) auf 3 Kanäle (TikTok + Shorts + Reels), KI Face-Tracking, virale Punchlines, Bestseller.',
    channelsDescription: '3 Kanäle: TikTok + Shorts + Instagram Reels',
    resolution: '1080p HDR Color Boost',
    aiFeatures: 'KI Hook & Punchline Score',
  },
  4: {
    tierLevel: 4,
    tierCode: 'abo4',
    name: 'Studio',
    displayName: 'Stufe 4 • Studio',
    productId: 'prod_VI7n98xn71dRNy',
    priceId: 'price_1UHXXnGvVjdBryCgKKWTwzI8',
    monthlyPriceEur: 31.0,
    annualPriceEur: 297.6,
    annualMonthlyEquivalentEur: 24.8,
    clipVolume: 300,
    dailyClips: 10,
    socialChannelsCount: 3,
    adminMarginPercent: 20,
    metadataKey: 'STUDIO_ABO',
    metadataVal: 'Abo4',
    description: '10 Clips pro Tag (300 Clips/Monat), 1080p Fast Master, Multi-Stream Monitoring (Twitch + Kick), Team Google Sheet.',
    channelsDescription: '3 Kanäle: TikTok + Shorts + Reels (Multi-Stream)',
    resolution: '1080p Ultra-Fast Master',
    aiFeatures: 'KI Virality Score & Multi-Monitoring',
  },
  5: {
    tierLevel: 5,
    tierCode: 'abo5',
    name: 'Titan',
    displayName: 'Stufe 5 • Titan',
    productId: 'prod_VI7oQhzHeIqNv8',
    priceId: 'price_1UHXZIGvVjdBryCgSYqJnXcB',
    monthlyPriceEur: 49.0,
    annualPriceEur: 470.4,
    annualMonthlyEquivalentEur: 39.2,
    clipVolume: 600,
    dailyClips: 20,
    socialChannelsCount: 5,
    adminMarginPercent: 15,
    metadataKey: 'TITAN_ABO',
    metadataVal: 'Abo5',
    description: '20 Clips pro Tag (600 Clips/Monat) auf alle 5 Kanäle, 24/7 Vollautonomie, White-Label Bot, Prioritäts-Rendering.',
    channelsDescription: 'Alle 5 Kanäle: TikTok, Shorts, Reels, X, Threads',
    resolution: '2K/4K Pro Master (Sofort &lt; 30s)',
    aiFeatures: 'Multilingual AI Voice-Dubbing & White-Label',
  },
};

/**
 * 0,00 € Dauerhafter Free-Starter Plan für alle Twitch-Streamer
 * 1 Clip pro Tag = 30 Clips / Monat
 * 0 MB Server-Speicher (Google Sheets Logging)
 * 100% kostenfrei, keine Kreditkarte nötig
 */
export const FREE_STARTER_PLAN: ModularSubscriptionConfig = {
  clipVolume: 30,
  socialChannelsCount: 1,
  connectedPlatforms: ['tiktok'],
  renderTier: 1,
  aiSpeechTier: 1,
  videoCropTier: 1,
  monitoringTier: 1,
  publishingTier: 1,
  brandingTier: 1,
  enableAiSubtitles: false,
  enableFaceCrop916: false,
  enableMultiStreamMonitoring: false,
  enableWhiteLabelBot: false,
  billingCycle: 'annual',
  calculatedPriceMonthly: 0,
  calculatedPriceAnnual: 0,
  tierName: 'Dauerhafter Free Starter (1 Clip/Tag = 30 Clips/Mo • 0,00 €)',
  tierLevel: 1,
  description: 'Dauerhaft 0,00 € für jeden Twitch-Streamer: 1 Clip pro Stream-Tag, 1 Social-Kanal (TikTok), 0 MB Speicherbedarf.',
};

/**
 * Option 2: 14-Tage Kostenlose Testphase gebunden an Stufe 2 Basic
 * Aktiviert sich nach 14 Tagen als reguläres 12,00 €/Monat Abo,
 * sofern nicht vorher mit 1 Klick im Dashboard gekündigt wird (Rückfall auf 0 € Free Starter).
 */
export const BASIC_TRIAL_PLAN: ModularSubscriptionConfig = {
  clipVolume: 90,
  socialChannelsCount: 2,
  connectedPlatforms: ['tiktok', 'shorts'],
  renderTier: 2,
  aiSpeechTier: 2,
  videoCropTier: 2,
  monitoringTier: 2,
  publishingTier: 2,
  brandingTier: 2,
  enableAiSubtitles: true,
  enableFaceCrop916: true,
  enableMultiStreamMonitoring: false,
  enableWhiteLabelBot: false,
  billingCycle: 'monthly',
  calculatedPriceMonthly: 12,
  calculatedPriceAnnual: 12,
  tierName: '14-Tage Basic-Abo Testphase (danach 12 €/Mo)',
  tierLevel: 2,
  stripeProductId: STRIPE_OFFICIAL_TIERS[2].productId,
  stripePriceId: STRIPE_OFFICIAL_TIERS[2].priceId,
  stripeMetadataCode: STRIPE_OFFICIAL_TIERS[2].tierCode,
  description: '14 Tage 100% kostenlos testen (3 Clips/Tag = 90 Clips/Mo, TikTok & Shorts, KI-Untertitel). Geht nach 14 Tagen automatisch in das zahlungspflichtige Basic-Abo (12,00 €/Monat) über. Jederzeit vor Ablauf mit 1 Klick kündbar.',
};

/**
 * Offizielle Clip-Pakete (Top-Ups) für flexible Aufstockung ohne Abo-Wechsel
 */
export const CLIP_PACKAGES: ClipPackage[] = [
  {
    id: 'pack_5',
    name: 'Mini Top-Up',
    clips: 5,
    price: '1,50 €',
    priceNum: 1.5,
    pricePerClip: '0,30 € / Clip',
    description: 'Schnelle Aufstockung für ein spontanes Stream-Event oder Turnier.',
    badge: 'Kompakt',
  },
  {
    id: 'pack_10',
    name: 'Pro Volume Booster',
    clips: 10,
    price: '2,80 €',
    priceNum: 2.8,
    pricePerClip: '0,28 € / Clip',
    popular: true,
    description: 'Optimal für zusätzliche Highlight-Clips auf TikTok, Shorts & Instagram Reels.',
    badge: 'Bestseller',
  },
  {
    id: 'pack_25',
    name: 'Season Pack',
    clips: 25,
    price: '5,90 €',
    priceNum: 5.9,
    pricePerClip: '0,23 € / Clip',
    description: 'Für Marathon-Streaming und intensive Content-Wochen.',
    badge: 'Mengen-Vorteil',
  },
  {
    id: 'pack_50',
    name: 'Studio Titan Pack',
    clips: 50,
    price: '9,90 €',
    priceNum: 9.9,
    pricePerClip: '0,20 € / Clip',
    description: 'Maximales Kontingent für Content-Creator und Team-Highlights.',
    badge: 'Bestes Angebot',
  },
];

/**
 * 5 vollständige Preset-Abonnementpläne (Stufe 1 bis Stufe 5)
 * 100% synchron mit den Stripe Live-Produktdefinitionen
 */
export const PRESET_MODULAR_PLANS: ModularSubscriptionConfig[] = [
  {
    clipVolume: 30,
    socialChannelsCount: 1,
    connectedPlatforms: ['tiktok'],
    renderTier: 1,
    aiSpeechTier: 1,
    videoCropTier: 1,
    monitoringTier: 1,
    publishingTier: 1,
    brandingTier: 1,
    enableAiSubtitles: false,
    enableFaceCrop916: false,
    enableMultiStreamMonitoring: false,
    enableWhiteLabelBot: false,
    billingCycle: 'annual',
    calculatedPriceMonthly: STRIPE_OFFICIAL_TIERS[1].monthlyPriceEur,
    calculatedPriceAnnual: STRIPE_OFFICIAL_TIERS[1].annualMonthlyEquivalentEur,
    tierName: STRIPE_OFFICIAL_TIERS[1].displayName,
    tierLevel: 1,
    stripeProductId: STRIPE_OFFICIAL_TIERS[1].productId,
    stripePriceId: STRIPE_OFFICIAL_TIERS[1].priceId,
    stripeMetadataCode: STRIPE_OFFICIAL_TIERS[1].tierCode,
    description: STRIPE_OFFICIAL_TIERS[1].description,
  },
  {
    clipVolume: 90,
    socialChannelsCount: 2,
    connectedPlatforms: ['tiktok', 'shorts'],
    renderTier: 2,
    aiSpeechTier: 2,
    videoCropTier: 2,
    monitoringTier: 2,
    publishingTier: 2,
    brandingTier: 2,
    enableAiSubtitles: true,
    enableFaceCrop916: true,
    enableMultiStreamMonitoring: false,
    enableWhiteLabelBot: false,
    billingCycle: 'annual',
    calculatedPriceMonthly: STRIPE_OFFICIAL_TIERS[2].monthlyPriceEur,
    calculatedPriceAnnual: STRIPE_OFFICIAL_TIERS[2].annualMonthlyEquivalentEur,
    tierName: STRIPE_OFFICIAL_TIERS[2].displayName,
    tierLevel: 2,
    stripeProductId: STRIPE_OFFICIAL_TIERS[2].productId,
    stripePriceId: STRIPE_OFFICIAL_TIERS[2].priceId,
    stripeMetadataCode: STRIPE_OFFICIAL_TIERS[2].tierCode,
    description: STRIPE_OFFICIAL_TIERS[2].description,
  },
  {
    clipVolume: 150,
    socialChannelsCount: 3,
    connectedPlatforms: ['tiktok', 'shorts', 'reels'],
    renderTier: 3,
    aiSpeechTier: 3,
    videoCropTier: 3,
    monitoringTier: 3,
    publishingTier: 3,
    brandingTier: 3,
    enableAiSubtitles: true,
    enableFaceCrop916: true,
    enableMultiStreamMonitoring: true,
    enableWhiteLabelBot: false,
    billingCycle: 'annual',
    calculatedPriceMonthly: STRIPE_OFFICIAL_TIERS[3].monthlyPriceEur,
    calculatedPriceAnnual: STRIPE_OFFICIAL_TIERS[3].annualMonthlyEquivalentEur,
    tierName: STRIPE_OFFICIAL_TIERS[3].displayName,
    tierLevel: 3,
    stripeProductId: STRIPE_OFFICIAL_TIERS[3].productId,
    stripePriceId: STRIPE_OFFICIAL_TIERS[3].priceId,
    stripeMetadataCode: STRIPE_OFFICIAL_TIERS[3].tierCode,
    description: STRIPE_OFFICIAL_TIERS[3].description,
  },
  {
    clipVolume: 300,
    socialChannelsCount: 3,
    connectedPlatforms: ['tiktok', 'shorts', 'reels'],
    renderTier: 4,
    aiSpeechTier: 3,
    videoCropTier: 3,
    monitoringTier: 3,
    publishingTier: 3,
    brandingTier: 3,
    enableAiSubtitles: true,
    enableFaceCrop916: true,
    enableMultiStreamMonitoring: true,
    enableWhiteLabelBot: false,
    billingCycle: 'annual',
    calculatedPriceMonthly: STRIPE_OFFICIAL_TIERS[4].monthlyPriceEur,
    calculatedPriceAnnual: STRIPE_OFFICIAL_TIERS[4].annualMonthlyEquivalentEur,
    tierName: STRIPE_OFFICIAL_TIERS[4].displayName,
    tierLevel: 4,
    stripeProductId: STRIPE_OFFICIAL_TIERS[4].productId,
    stripePriceId: STRIPE_OFFICIAL_TIERS[4].priceId,
    stripeMetadataCode: STRIPE_OFFICIAL_TIERS[4].tierCode,
    description: STRIPE_OFFICIAL_TIERS[4].description,
  },
  {
    clipVolume: 600,
    socialChannelsCount: 5,
    connectedPlatforms: ['tiktok', 'shorts', 'reels', 'x', 'threads'],
    renderTier: 4,
    aiSpeechTier: 4,
    videoCropTier: 4,
    monitoringTier: 4,
    publishingTier: 4,
    brandingTier: 4,
    enableAiSubtitles: true,
    enableFaceCrop916: true,
    enableMultiStreamMonitoring: true,
    enableWhiteLabelBot: true,
    billingCycle: 'annual',
    calculatedPriceMonthly: STRIPE_OFFICIAL_TIERS[5].monthlyPriceEur,
    calculatedPriceAnnual: STRIPE_OFFICIAL_TIERS[5].annualMonthlyEquivalentEur,
    tierName: STRIPE_OFFICIAL_TIERS[5].displayName,
    tierLevel: 5,
    stripeProductId: STRIPE_OFFICIAL_TIERS[5].productId,
    stripePriceId: STRIPE_OFFICIAL_TIERS[5].priceId,
    stripeMetadataCode: STRIPE_OFFICIAL_TIERS[5].tierCode,
    description: STRIPE_OFFICIAL_TIERS[5].description,
  },
];

/**
 * Format currency nicely for German UI display
 */
export function formatEur(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

/**
 * Unified calculation for monthly vs annual display prices
 */
export function getUnifiedPlanPrice(monthlyBase: number, isAnnual: boolean) {
  if (monthlyBase === 0) {
    return {
      display: '0,00 €',
      perMonth: '0,00 €',
      annualTotal: '0,00 €',
      savings: '0,00 €',
    };
  }
  const perMonthNum = isAnnual ? monthlyBase * 0.8 : monthlyBase;
  const annualTotalNum = monthlyBase * 0.8 * 12;
  const savingsNum = monthlyBase * 0.2 * 12;

  return {
    display: `${perMonthNum.toFixed(2).replace('.', ',')} €`,
    perMonth: `${perMonthNum.toFixed(2).replace('.', ',')} €`,
    annualTotal: `${annualTotalNum.toFixed(2).replace('.', ',')} €`,
    savings: `${savingsNum.toFixed(2).replace('.', ',')} €`,
  };
}

/**
 * Lookup Stripe tier by price ID
 */
export function findTierByPriceId(priceId: string): StripeOfficialTier | undefined {
  return Object.values(STRIPE_OFFICIAL_TIERS).find((t) => t.priceId === priceId);
}

/**
 * Lookup Stripe tier by level (1 to 5)
 */
export function findTierByLevel(level: number): StripeOfficialTier {
  const safeLevel = (Math.max(1, Math.min(5, Math.round(level)))) as ProgressiveTierLevel;
  return STRIPE_OFFICIAL_TIERS[safeLevel] || STRIPE_OFFICIAL_TIERS[1];
}
