import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAuth, requireActiveSubscription as requireSubscription } from '../middleware/authMiddleware.js';

export const apiKeysRouter = Router();

const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || 'qlipzync-prod';
const db = getFirestore(FIRESTORE_DB_ID);

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

// 1. Liste aller aktiven API-Schlüssel des angemeldeten Benutzers
apiKeysRouter.get(
  '/',
  verifyAuth,
  requireSubscription,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const uid = req.user!.uid;
      const snapshot = await db
        .collection('users')
        .doc(uid)
        .collection('apiKeys')
        .where('status', '==', 'active')
        .get();

      const keys: ApiKeyRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        keys.push({
          id: doc.id,
          name: data.name || 'Unbenannter Client',
          keyPrefix: data.keyPrefix || 'qc_live_****',
          createdAt: data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : (data.createdAt ? new Date(data.createdAt).toISOString() : null),
          lastUsedAt: data.lastUsedAt && typeof data.lastUsedAt.toDate === 'function'
            ? data.lastUsedAt.toDate().toISOString()
            : (data.lastUsedAt ? new Date(data.lastUsedAt).toISOString() : null),
        });
      });

      // Nach Erstellungsdatum sortieren (neueste zuerst)
      keys.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      res.status(200).json({ success: true, keys });
    } catch (error: any) {
      console.error('[ApiKeysRoutes] Fehler beim Abrufen der Schlüssel:', error?.message);
      res.status(500).json({ success: false, error: 'API-Schlüssel konnten nicht geladen werden.' });
    }
  }
);

// 2. Neuen API-Schlüssel generieren (Klartext-Token wird nur EINMALIG zurückgegeben)
apiKeysRouter.post(
  '/',
  verifyAuth,
  requireSubscription,
  async (req: Request, res: Response): Promise<void> => {
    const { name } = req.body || {};
    const uid = req.user!.uid;

    const keyName = (typeof name === 'string' ? name.trim() : '') || 'Drittanbieter Client';

    try {
      // 1. Sicheres Token generieren
      const randomHex = crypto.randomBytes(24).toString('hex');
      const fullPlaintextKey = `qc_live_${randomHex}`;
      const keyPrefix = `qc_live_${randomHex.slice(0, 4)}...${randomHex.slice(-4)}`;
      const keyHash = crypto.createHash('sha256').update(fullPlaintextKey).digest('hex');

      const keyId = `key_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // 2. Hash in Firestore persistieren (niemals den Klartext!)
      await db
        .collection('users')
        .doc(uid)
        .collection('apiKeys')
        .doc(keyId)
        .set({
          id: keyId,
          userId: uid,
          name: keyName,
          keyPrefix,
          keyHash,
          status: 'active',
          createdAt: FieldValue.serverTimestamp(),
          lastUsedAt: null,
        });

      // 3. Klartext-Token einmalig an den Client übergeben
      res.status(201).json({
        success: true,
        id: keyId,
        key: fullPlaintextKey,
        name: keyName,
        keyPrefix,
        message: 'API-Schlüssel erfolgreich generiert. Bitte speichere ihn jetzt sicher ab, er wird nie wieder angezeigt!',
      });
    } catch (error: any) {
      console.error('[ApiKeysRoutes] Fehler beim Erstellen des Schlüssels:', error?.message);
      res.status(500).json({ success: false, error: 'API-Schlüssel konnte nicht erstellt werden.' });
    }
  }
);

// 3. API-Schlüssel widerrufen (Revoke)
apiKeysRouter.delete(
  '/:keyId',
  verifyAuth,
  requireSubscription,
  async (req: Request, res: Response): Promise<void> => {
    const rawKeyId = req.params.keyId;
    const keyId = Array.isArray(rawKeyId) ? rawKeyId[0] : rawKeyId;
    const uid = req.user!.uid;

    if (!keyId) {
      res.status(400).json({ success: false, error: 'keyId ist erforderlich.' });
      return;
    }

    try {
      const keyRef = db.collection('users').doc(uid).collection('apiKeys').doc(keyId);
      const doc = await keyRef.get();

      if (!doc.exists) {
        res.status(404).json({ success: false, error: 'API-Schlüssel nicht gefunden.' });
        return;
      }

      await keyRef.update({
        status: 'revoked',
        revokedAt: FieldValue.serverTimestamp(),
      });

      res.status(200).json({ success: true, message: 'API-Schlüssel wurde erfolgreich widerrufen.' });
    } catch (error: any) {
      console.error('[ApiKeysRoutes] Fehler beim Widerrufen:', error?.message);
      res.status(500).json({ success: false, error: 'Widerrufen des API-Schlüssels fehlgeschlagen.' });
    }
  }
);
