import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  getDocFromServer,
  collection,
  addDoc,
  getDocs,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  FIREBASE_PUBLIC_CONFIG,
  GCP_PROJECT_METADATA,
  FIRESTORE_DATABASE_TOPOLOGY,
} from '../config/quickclick-config';
import { StreamerUser } from '../types/pipeline';

// Nutze Umgebungsvariablen für maximale Sicherheit mit robusten Fallbacks
const effectiveApiKey =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_FIREBASE_API_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_API_KEY) ||
  firebaseConfig.apiKey ||
  FIREBASE_PUBLIC_CONFIG.apiKey;

const effectiveAppId =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_FIREBASE_APP_ID) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_APP_ID) ||
  firebaseConfig.appId ||
  FIREBASE_PUBLIC_CONFIG.appId;

const effectiveConfig = {
  apiKey: effectiveApiKey,
  authDomain: firebaseConfig.authDomain || 'qlipzync.firebaseapp.com',
  projectId: firebaseConfig.projectId || 'qlipzync',
  storageBucket: firebaseConfig.storageBucket || 'qlipzync.firebasestorage.app',
  messagingSenderId: firebaseConfig.messagingSenderId || '248792984033',
  appId: effectiveAppId,
  ...(firebaseConfig.measurementId ? { measurementId: firebaseConfig.measurementId } : {}),
};

// 1. Firebase App initialisieren
export const app = getApps().length === 0 ? initializeApp(effectiveConfig) : getApp();

// 2. Das optimale 2-Datenbanken-Setup (qlipzync-prod & (default)):
// - qlipzync-prod: Konsolidierte SaaS-Produktionsumgebung (Nutzer, Rechnungen, Clips & KI-Metadaten)
// - (default): Entwicklung, Staging & Sandbox mit No-Cost Free Tier
export const databases = {
  // Kern-Produktion für alle SaaS-Live-Nutzer, Rechnungen & KI-Metadaten (europe-west1)
  prod: getFirestore(app, FIRESTORE_DATABASE_TOPOLOGY.prod.id),

  // Entwicklung, Staging & Testdaten (Greift auf die Standarddatenbank zu mit No-Cost Free Tier)
  dev: getFirestore(app),

  // Nahtlose Kompatibilitäts-Aliase: Verweisen direkt auf die konsolidierte qlipzync-prod Instanz
  get aiStudio(): Firestore {
    return this.prod;
  },
  get autonomous(): Firestore {
    return this.prod;
  },
};

export type DbContext = 'prod' | 'dev' | 'aiStudio' | 'autonomous';

/**
 * Helper, um die Datenbank dynamisch je nach Modul oder Umgebung abzurufen
 */
export function getDbInstance(context: DbContext = 'prod'): Firestore {
  return databases[context];
}

export interface MultiDbFirestore extends Firestore {
  prod: Firestore;
  dev: Firestore;
  aiStudio: Firestore;
  autonomous: Firestore;
}

/**
 * Konsolidierte Firestore-Instanz:
 * Bietet sowohl den typisierten Zugriff (db.prod, db.dev) als auch
 * direkte Kompatibilität mit Standard-Firestore-Aufrufen wie doc(db, 'users', id),
 * die transparent auf die zentrale Produktions-DB qlipzync-prod zugreifen.
 */
export const db: MultiDbFirestore = new Proxy(databases.prod as unknown as MultiDbFirestore, {
  get(target, prop, receiver) {
    if (typeof prop === 'string' && prop in databases) {
      return (databases as Record<string, unknown>)[prop];
    }
    return Reflect.get(target, prop, receiver);
  },
});

export const auth = getAuth(app);

// --- Modul-spezifische Helper-Funktionen (In qlipzync-prod konsolidiert) ---

/**
 * Beispiel A: Nutzer rechnet ein Abo ab -> Speichern in qlipzync-prod
 */
export async function createInvoice(userId: string, invoiceData: Record<string, unknown>) {
  const invoiceRef = collection(db.prod, `users/${userId}/invoices`);
  return await addDoc(invoiceRef, {
    ...invoiceData,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Beispiel B: KI-Studio-Modul generiert Clip-Tags -> Speichern in qlipzync-prod
 * Durch die Konsolidierung können Security Rules direkt per get() prüfen, ob der User ein Abo hat!
 */
export async function saveClipMetadata(clipId: string, tags: Record<string, unknown>) {
  const aiRef = collection(db.prod, `clips/${clipId}/ai_metadata`);
  return await addDoc(aiRef, {
    ...tags,
    generatedAt: new Date().toISOString(),
  });
}

/**
 * Beispiel C: Autonome Agenten-Aktionen -> Speichern in qlipzync-prod
 */
export async function logAutonomousAction(botId: string, actionData: Record<string, unknown>) {
  const botRef = collection(db.prod, `bots/${botId}/logs`);
  return await addDoc(botRef, {
    ...actionData,
    timestamp: new Date().toISOString(),
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Non-blocking Firestore initialization check
(async function testConnection() {
  try {
    await getDocFromServer(doc(databases.prod, 'test', 'connection'));
  } catch (_ignored) {
    try {
      await getDocFromServer(doc(databases.dev, 'test', 'connection'));
    } catch (_e) {
      // Graceful offline/local mode ready
    }
  }
})();

export async function syncUserToFirestore(user: StreamerUser): Promise<void> {
  if (!user.id) return;

  const isVerifiedMasterAdmin =
    (auth.currentUser?.email || '').trim().toLowerCase() === 'robert.f.telekom@gmail.com';

  const serverManagedFields = [
    'role',
    'isAdmin',
    'isTitanVip',
    'hasActiveSubscription',
    'subscriptionPlan',
    'subscriptionStatus',
    'adminOverrideActive',
    'clipsLimitTotal',
    'apiCallsLimit',
    'apiCallsUsedCount',
    'clipsUsedCount',
    'clipBalance',
    'dailyClipCount',
    'subscriptionTierLevel',
    'billingCycle',
    'stripeCustomerId',
    'stripeSubscriptionId',
  ];

  try {
    const prodUserRef = doc(db.prod, 'users', user.id);
    const existingUser = await getDoc(prodUserRef);
    const safePayload: Record<string, unknown> = {
      ...user,
      updatedAt: new Date().toISOString(),
    };

    if (!isVerifiedMasterAdmin) {
      // Never let client-side state overwrite server-authoritative billing/RBAC values.
      for (const field of serverManagedFields) {
        delete safePayload[field];
      }

      // A new profile starts inactive with zero quotas; webhooks/backend grant entitlements.
      if (!existingUser.exists()) {
        Object.assign(safePayload, {
          role: 'streamer',
          isAdmin: false,
          isTitanVip: false,
          hasActiveSubscription: false,
          subscriptionPlan: 'free',
          subscriptionStatus: 'inactive',
          adminOverrideActive: false,
          clipsLimitTotal: 0,
          apiCallsLimit: 0,
          apiCallsUsedCount: 0,
          clipsUsedCount: 0,
          clipBalance: 0,
          dailyClipCount: 0,
          subscriptionTierLevel: 0,
          plan: 'none',
        });
      }
    }

    await setDoc(prodUserRef, safePayload, { merge: true });
  } catch (error) {
    console.debug('syncUserToFirestore (prod) notice:', error);
    try {
      // Sandbox fallback for local development/staging only.
      const devUserRef = doc(db.dev, 'users', user.id);
      await setDoc(devUserRef, {
        id: user.id,
        name: user.name,
        displayName: user.displayName,
        channelName: user.channelName,
        email: user.email,
        avatarUrl: user.avatarUrl,
        settings: user.settings || {},
        updatedAt: new Date().toISOString(),
        role: 'streamer',
        isAdmin: false,
        isTitanVip: false,
        hasActiveSubscription: false,
        subscriptionPlan: 'free',
        subscriptionStatus: 'inactive',
        clipsLimitTotal: 0,
        apiCallsLimit: 0,
        clipBalance: 0,
        dailyClipCount: 0,
      }, { merge: true });
    } catch (fallbackError) {
      console.warn('syncUserToFirestore fallback failed:', fallbackError);
    }
  }
}

export function subscribeToUserDocument(userId: string, callback: (data: Partial<StreamerUser> | null) => void) {
  const userRef = doc(db.prod, 'users', userId);
  return onSnapshot(
    userRef,
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as Partial<StreamerUser>);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.debug('subscribeToUserDocument (prod) notice, fallback to dev:', error);
      const devRef = doc(db.dev, 'users', userId);
      return onSnapshot(
        devRef,
        (devSnap) => {
          if (devSnap.exists()) {
            callback(devSnap.data() as Partial<StreamerUser>);
          } else {
            callback(null);
          }
        },
        () => callback(null)
      );
    }
  );
}

export async function loadUserFromFirestore(userId: string): Promise<StreamerUser | null> {
  try {
    const prodRef = doc(db.prod, 'users', userId);
    const prodSnap = await getDoc(prodRef);
    if (prodSnap.exists()) {
      return prodSnap.data() as StreamerUser;
    }
    const devRef = doc(db.dev, 'users', userId);
    const devSnap = await getDoc(devRef);
    if (devSnap.exists()) {
      return devSnap.data() as StreamerUser;
    }
    return null;
  } catch (error) {
    console.warn('loadUserFromFirestore error:', error);
    return null;
  }
}

export async function logOutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Sign out error:', err);
  }
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}


