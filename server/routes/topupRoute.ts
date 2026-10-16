import { Request, Response } from 'express';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { calculateDynamicClipPrice } from './stripe.js';

const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || 'qlipzync-prod';
const db = getFirestore(FIRESTORE_DB_ID);

export async function handleTopupRequest(req: Request, res: Response) {
  const { userId, addedClips } = req.body || {};
  const clips = Math.floor(Number(addedClips));

  if (isNaN(clips) || clips < 1 || clips > 20000) {
    return res.status(400).json({ error: 'Ungültige Clipanzahl. Erlaubt: 1 bis 20.000 Clips.' });
  }

  const pricing = calculateDynamicClipPrice(clips);

  if (userId) {
    await db.collection('users').doc(userId).set({
      hasActiveSubscription: true,
      clipBalance: FieldValue.increment(pricing.clips),
      clipsLimitTotal: FieldValue.increment(pricing.clips),
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }

  return res.status(200).json({
    success: true,
    userId,
    addedClips: pricing.clips,
    unitPriceEur: pricing.unitPriceEur,
    chargedEur: pricing.totalPriceEur,
    discountPercent: pricing.discountPercent,
  });
}
