const MIN_CLIPS = 1;
const MAX_CLIPS = 2e4;
const BASE_PRICE = 0.5;
const MIN_PRICE = 0.05;
function calculateVerifiedTier(clipsCount) {
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
    isValid: true
  };
}
export {
  BASE_PRICE,
  MAX_CLIPS,
  MIN_CLIPS,
  MIN_PRICE,
  calculateVerifiedTier
};
