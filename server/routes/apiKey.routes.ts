import { Router } from 'express';
import type { Request, Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { unifiedAuth } from '../middleware/unifiedAuth.middleware.js';
import { requireSubscription } from '../middleware/subscription.middleware.js';
import { generateSecureApiKey } from '../utils/apiKey.util.js';

export const apiKeyRouter = Router();

const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || 'ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91';
const db = getFirestore(FIRESTORE_DB_ID);

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

// 1. Liste aller Schlüssel des Users (ohne Secrets)
apiKeyRouter.get(
  '/',
  unifiedAuth,
  requireSubscription,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const uid = req.user!.uid;

      // 1. Abfrage aus api_keys root collection
      const snapshot = await db
        .collection('api_keys')
        .where('userId', '==', uid)
        .where('revoked', '==', false)
        .get();

      const keys: ApiKeyItem[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        keys.push({
          id: doc.id,
          name: data.name || 'API Client',
          keyPrefix: data.keyPrefix || 'qc_live_****',
          createdAt: data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : (data.createdAt ? new Date(data.createdAt).toISOString() : null),
          lastUsedAt: data.lastUsedAt && typeof data.lastUsedAt.toDate === 'function'
            ? data.lastUsedAt.toDate().toISOString()
            : (data.lastUsedAt ? new Date(data.lastUsedAt).toISOString() : null),
        });
      });

      // 2. Fallback: Suche in users/{uid}/apiKeys falls dort noch Schlüssel liegen
      if (keys.length === 0) {
        const userSubSnapshot = await db
          .collection('users')
          .doc(uid)
          .collection('apiKeys')
          .where('status', '==', 'active')
          .get();

        userSubSnapshot.forEach((doc) => {
          const data = doc.data();
          keys.push({
            id: doc.id,
            name: data.name || 'API Client',
            keyPrefix: data.keyPrefix || 'qc_live_****',
            createdAt: data.createdAt && typeof data.createdAt.toDate === 'function'
              ? data.createdAt.toDate().toISOString()
              : (data.createdAt ? new Date(data.createdAt).toISOString() : null),
            lastUsedAt: data.lastUsedAt && typeof data.lastUsedAt.toDate === 'function'
              ? data.lastUsedAt.toDate().toISOString()
              : (data.lastUsedAt ? new Date(data.lastUsedAt).toISOString() : null),
          });
        });
      }

      keys.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      res.status(200).json({ success: true, keys });
    } catch (error: any) {
      console.error('[ApiKeyRoutes] Fehler beim Laden der Schlüssel:', error?.message);
      res.status(500).json({ error: 'FETCH_FAILED', message: 'API-Schlüssel konnten nicht geladen werden.' });
    }
  }
);

// 2. Neuen API-Key generieren (Klartext wird NUR HIER zurückgegeben)
apiKeyRouter.post(
  '/',
  unifiedAuth,
  requireSubscription,
  async (req: Request, res: Response): Promise<void> => {
    const { name } = req.body || {};
    const uid = req.user!.uid;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Ein Bezeichner (Name) ist erforderlich.' });
      return;
    }

    try {
      // Limit pro User prüfen (max. 5 aktive Keys)
      const countSnapshot = await db
        .collection('api_keys')
        .where('userId', '==', uid)
        .where('revoked', '==', false)
        .get();

      if (countSnapshot.size >= 5) {
        res.status(400).json({
          error: 'LIMIT_REACHED',
          message: 'Maximal 5 aktive API-Schlüssel gleichzeitig erlaubt.',
        });
        return;
      }

      const { rawKey, hashedKey, keyPrefix } = generateSecureApiKey();

      const newKeyDoc = await db.collection('api_keys').add({
        userId: uid,
        name: name.trim(),
        hashedKey,
        keyPrefix,
        revoked: false,
        createdAt: FieldValue.serverTimestamp(),
        lastUsedAt: null,
      });

      // Synchronisation in users/{uid}/apiKeys
      await db
        .collection('users')
        .doc(uid)
        .collection('apiKeys')
        .doc(newKeyDoc.id)
        .set({
          id: newKeyDoc.id,
          userId: uid,
          name: name.trim(),
          keyPrefix,
          keyHash: hashedKey,
          status: 'active',
          createdAt: FieldValue.serverTimestamp(),
          lastUsedAt: null,
        })
        .catch(() => {});

      // rawKey wird exakt einmalig an das Frontend übergeben
      res.status(201).json({
        success: true,
        id: newKeyDoc.id,
        name: name.trim(),
        keyPrefix,
        rawKey,
        key: rawKey,
        createdAt: new Date().toISOString(),
        message: 'API-Schlüssel erfolgreich generiert. Bitte speichere ihn jetzt sicher ab, er wird nie wieder angezeigt!',
      });
    } catch (error: any) {
      console.error('[ApiKeyRoutes] Fehler beim Erstellen des Schlüssels:', error?.message);
      res.status(500).json({ error: 'CREATION_FAILED', message: 'API-Schlüssel konnte nicht erstellt werden.' });
    }
  }
);

// 3. API-Key widerrufen (Soft Delete)
apiKeyRouter.delete(
  '/:keyId',
  unifiedAuth,
  requireSubscription,
  async (req: Request, res: Response): Promise<void> => {
    const rawKeyId = req.params.keyId;
    const keyId = Array.isArray(rawKeyId) ? rawKeyId[0] : rawKeyId;
    const uid = req.user!.uid;

    if (!keyId) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Schlüssel-ID erforderlich.' });
      return;
    }

    try {
      const keyRef = db.collection('api_keys').doc(keyId);
      const keyDoc = await keyRef.get();

      if (keyDoc.exists) {
        if (keyDoc.data()?.userId !== uid) {
          res.status(404).json({ error: 'NOT_FOUND', message: 'Schlüssel nicht gefunden.' });
          return;
        }

        await keyRef.update({
          revoked: true,
          revokedAt: FieldValue.serverTimestamp(),
        });
      }

      // Auch in users/{uid}/apiKeys widerrufen
      const userKeyRef = db.collection('users').doc(uid).collection('apiKeys').doc(keyId);
      const userKeyDoc = await userKeyRef.get();
      if (userKeyDoc.exists) {
        await userKeyRef.update({
          status: 'revoked',
          revokedAt: FieldValue.serverTimestamp(),
        });
      }

      res.status(200).json({ success: true, message: 'API-Schlüssel erfolgreich widerrufen.' });
    } catch (error: any) {
      console.error('[ApiKeyRoutes] Fehler beim Widerrufen:', error?.message);
      res.status(500).json({ error: 'REVOCATION_FAILED', message: 'Widerruf fehlgeschlagen.' });
    }
  }
);

export const apiKeysRouter = apiKeyRouter;
