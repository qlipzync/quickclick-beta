import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'qlipzync',
  });
}

const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || 'qlipzync-prod';
const db = getFirestore(FIRESTORE_DB_ID);

export const BOOTSTRAPPED_ADMIN_EMAIL = 'robert.f.telekom@gmail.com';
export const TITAN_LIFETIME_EMAILS: string[] = [];

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role: 'streamer' | 'admin';
  isAdmin: boolean;
  isTitanVip: boolean;
  hasActiveSubscription: boolean;
  subscribed?: boolean;
  subscriptionTier?: string;
  subscriptionPlan: 'free' | 'creator' | 'pro' | 'elite' | 'titan';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      rawBody?: Buffer;
    }
  }
}

export function isMasterAdmin(email?: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
}

export function isTitanLifetime(email?: string): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return TITAN_LIFETIME_EMAILS.some((vip) => vip.toLowerCase() === cleanEmail);
}

/**
 * Stellt sicher, dass das Titan-Abo für VIPs in Firestore hinterlegt ist
 */
export async function syncVipAndAdminStatus(uid: string, email?: string): Promise<{
  isAdmin: boolean;
  isTitanVip: boolean;
  hasActiveSubscription: boolean;
  subscriptionPlan: 'free' | 'creator' | 'pro' | 'elite' | 'titan';
}> {
  const admin = isMasterAdmin(email);
  const titan = isTitanLifetime(email);

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();

  if (admin) {
    await userRef.set(
      {
        uid,
        email: email?.toLowerCase(),
        role: 'admin',
        isAdmin: true,
        hasActiveSubscription: true,
        subscriptionPlan: 'titan',
        subscriptionTierLevel: 5,
        subscriptionStatus: 'active',
        billingCycle: 'lifetime',
        clipBalance: 9999,
        clipsLimitTotal: 9999,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { isAdmin: true, isTitanVip: true, hasActiveSubscription: true, subscriptionPlan: 'titan' };
  }

  if (titan) {
    await userRef.set(
      {
        uid,
        email: email?.toLowerCase(),
        role: 'streamer',
        isAdmin: false,
        isTitanVip: true,
        hasActiveSubscription: true,
        subscriptionPlan: 'titan',
        subscriptionTierLevel: 5,
        subscriptionStatus: 'active',
        billingCycle: 'lifetime',
        clipBalance: 600,
        clipsLimitTotal: 600,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { isAdmin: false, isTitanVip: true, hasActiveSubscription: true, subscriptionPlan: 'titan' };
  }

  const existingData = snap.data();
  // Standardmäßig Null-Zugriff nach Registrierung bis aktives Abonnement serverseitig verifiziert ist
  const hasActiveSub = Boolean(existingData?.hasActiveSubscription === true && existingData?.subscriptionStatus === 'active');
  return {
    isAdmin: false,
    isTitanVip: false,
    hasActiveSubscription: hasActiveSub,
    subscriptionPlan: existingData?.subscriptionPlan || 'free',
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // 1. Check for Third-Party Client API-Key (X-API-Key: qc_live_...)
  const apiKeyHeader = (req.headers['x-api-key'] || req.headers['x-api-token']) as string | undefined;
  if (apiKeyHeader && typeof apiKeyHeader === 'string' && apiKeyHeader.trim().startsWith('qc_live_')) {
    try {
      const cleanKey = apiKeyHeader.trim();
      const keyHash = crypto.createHash('sha256').update(cleanKey).digest('hex');

      const keyQuery = await db
        .collectionGroup('apiKeys')
        .where('keyHash', '==', keyHash)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (keyQuery.empty) {
        res.status(401).json({
          success: false,
          error: 'Nicht autorisiert (HTTP 401): Ungültiger oder widerrufener API-Schlüssel (X-API-Key).',
        });
        return;
      }

      const keyDoc = keyQuery.docs[0];
      const keyData = keyDoc.data();
      const uid = keyData.userId;

      // Update lastUsedAt asynchronously in volatile background
      keyDoc.ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {});

      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.data();
      const email = userData?.email || '';
      const status = await syncVipAndAdminStatus(uid, email);

      const hasActiveSubscription = status.isAdmin || status.hasActiveSubscription || userData?.hasActiveSubscription === true;

      req.user = {
        uid,
        email,
        role: status.isAdmin ? 'admin' : 'streamer',
        isAdmin: status.isAdmin,
        isTitanVip: status.isTitanVip,
        hasActiveSubscription,
        subscribed: hasActiveSubscription,
        subscriptionPlan: status.subscriptionPlan,
      };

      return next();
    } catch (err: any) {
      console.error('[AuthMiddleware] API Key verification error:', err.message);
      res.status(401).json({ success: false, error: 'API-Schlüssel Validierung fehlgeschlagen.' });
      return;
    }
  }

  // 2. Standard Firebase Auth Bearer Token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Nicht autorisiert (HTTP 401): Gültiges Bearer-Token oder X-API-Key fehlt.' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken, true);
    const email = decodedToken.email || '';
    const status = await syncVipAndAdminStatus(decodedToken.uid, email);

    // Priorisiere serverseitige Custom Claims (subscribed: true)
    const isSubscribedFromClaims = decodedToken.subscribed === true || decodedToken.hasActiveSubscription === true;
    const hasActiveSubscription = status.isAdmin || isSubscribedFromClaims || status.hasActiveSubscription;

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: status.isAdmin ? 'admin' : 'streamer',
      isAdmin: status.isAdmin,
      isTitanVip: status.isTitanVip,
      hasActiveSubscription,
      subscriptionPlan: (decodedToken.tier as any) || status.subscriptionPlan,
    };
    next();
  } catch (error: any) {
    console.error('[AuthMiddleware] Ungültiges Token:', error.message);
    res.status(401).json({ success: false, error: 'Token ungültig oder abgelaufen.' });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const checkAdmin = () => {
    if (!req.user?.isAdmin) {
      res.status(403).json({ success: false, error: 'Zugriff verweigert (HTTP 403): Adminrechte erforderlich.' });
      return;
    }
    next();
  };

  if (!req.user) {
    await requireAuth(req, res, checkAdmin);
  } else {
    checkAdmin();
  }
}

/**
 * Gatekeeper (Subscription Gate):
 * Blockiert unautorisierte Anfragen strikt mit HTTP 403 Forbidden,
 * falls der authentifizierte Benutzer kein aktives Abonnement besitzt.
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  const checkSubscription = () => {
    if (!req.user?.hasActiveSubscription && !req.user?.isAdmin) {
      res.status(403).json({
        success: false,
        error: 'Zugriff verweigert (HTTP 403 Forbidden): Kein aktives Abonnement gefunden. Systemfunktionen sind gesperrt, bis ein verifiziertes Abonnement vorliegt.',
        code: 'SUBSCRIPTION_REQUIRED',
      });
      return;
    }
    next();
  };

  if (!req.user) {
    await requireAuth(req, res, checkSubscription);
  } else {
    checkSubscription();
  }
}

export const verifyAuth = requireAuth;