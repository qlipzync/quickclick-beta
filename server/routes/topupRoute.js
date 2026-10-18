import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { calculateDynamicClipPrice } from "./stripe.js";
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91";
const db = getFirestore(FIRESTORE_DB_ID);
async function handleTopupRequest(req, res) {
  const userId = req.user?.uid;
  if (!userId) {
    return res.status(401).json({ error: "Nicht autorisiert (HTTP 401): Authentifizierung erforderlich." });
  }
  const { addedClips, paymentToken } = req.body || {};
  const clips = Math.floor(Number(addedClips));
  if (isNaN(clips) || clips < 1 || clips > 2e4) {
    return res.status(400).json({ error: "Ung\xFCltige Clipanzahl. Erlaubt: 1 bis 20.000 Clips." });
  }
  const pricing = calculateDynamicClipPrice(clips);
  if (!paymentToken || pricing.totalPriceEur <= 0) {
    return res.status(402).json({ error: "Google Pay Autorisierung fehlgeschlagen (Payment Token erforderlich)." });
  }
  const userRef = db.collection("users").doc(userId);
  await userRef.set(
    {
      hasActiveSubscription: true,
      subscriptionStatus: "active",
      clipBalance: FieldValue.increment(pricing.clips),
      clipsLimitTotal: FieldValue.increment(pricing.clips),
      updatedAt: Timestamp.now()
    },
    { merge: true }
  );
  const updatedSnap = await userRef.get();
  const updatedData = updatedSnap.data();
  const clipsRemaining = Number(updatedData?.clipBalance ?? updatedData?.clipsLimitTotal ?? pricing.clips);
  return res.status(200).json({
    success: true,
    userId,
    addedClips: pricing.clips,
    unitPriceEur: pricing.unitPriceEur,
    chargedEur: pricing.totalPriceEur,
    discountPercent: pricing.discountPercent,
    clipsRemaining,
    paidAt: (/* @__PURE__ */ new Date()).toISOString()
  });
}
export {
  handleTopupRequest
};
