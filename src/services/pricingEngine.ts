/**
 * QuickClick / QlipZync Dynamic Pricing Engine
 *
 * Implements logarithmic volume pricing with transparent tiers:
 * - MIN_CLIPS: 1 Clip (Base price: 0.50 € / Clip)
 * - MAX_CLIPS: 20,000 Clips (Minimum price: 0.05 € / Clip)
 * - Logarithmic scaling formula:
 *   logFactor = 1 - Math.log(clips) / Math.log(MAX_CLIPS)
 *   unitPrice = Math.max(MIN_PRICE, MIN_PRICE + (BASE_PRICE - MIN_PRICE) * logFactor)
 *   totalPrice = clips * unitPrice
 *   discountPercent = Math.round((1 - unitPrice / BASE_PRICE) * 100)
 */

export const MIN_CLIPS = 1;
export const MAX_CLIPS = 20000;
export const BASE_PRICE = 0.50; // 0,50 € bei 1 Clip
export const MIN_PRICE = 0.05;  // 0,05 € bei 20.000 Clips

export interface VerifiedTier {
  clips: number;
  unitPriceEur: number;
  monthlyTotalEur: number;
  discountPercent: number;
  isValid: boolean;
}

export function calculateVerifiedTier(clipsCount: number): VerifiedTier | null {
  const clips = Math.floor(Number(clipsCount));
  if (isNaN(clips) || clips < MIN_CLIPS || clips > MAX_CLIPS) {
    return null;
  }

  const logFactor = 1 - Math.log(clips) / Math.log(MAX_CLIPS);
  const unitPrice = Math.max(MIN_PRICE, MIN_PRICE + (BASE_PRICE - MIN_PRICE) * logFactor);
  const totalPrice = clips * unitPrice;
  const discount = Math.round((1 - unitPrice / BASE_PRICE) * 100);

  return {
    clips,
    unitPriceEur: Number(unitPrice.toFixed(4)),
    monthlyTotalEur: Number(totalPrice.toFixed(2)),
    discountPercent: discount,
    isValid: true,
  };
}

export interface PricingDetails {
  clips: number;
  unitPriceEur: number;
  totalPriceEur: number;
  discountPercent: number;
  isValid: boolean;
}
