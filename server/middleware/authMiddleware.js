import crypto from "crypto";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
if (!getApps().length) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "qlipzync"
  });
}
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "qlipzync-prod";
const db = getFirestore(FIRESTORE_DB_ID);
const BOOTSTRAPPED_ADMIN_EMAIL = "robert.f.telekom@gmail.com";
const TITAN_LIFETIME_EMAILS = [];
function isMasterAdmin(email) {
  if (!email) return false;
  return email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase();
}
function isTitanLifetime(email) {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return TITAN_LIFETIME_EMAILS.some((vip) => vip.toLowerCase() === cleanEmail);
}
async function syncVipAndAdminStatus(uid, email) {
  const admin = isMasterAdmin(email);
  const titan = isTitanLifetime(email);
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  if (admin) {
    await userRef.set(
      {
        uid,
        email: email?.toLowerCase(),
        role: "admin",
        isAdmin: true,
        hasActiveSubscription: true,
        subscriptionPlan: "titan",
        subscriptionTierLevel: 5,
        subscriptionStatus: "active",
        billingCycle: "lifetime",
        clipBalance: 9999,
        clipsLimitTotal: 9999,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return { isAdmin: true, isTitanVip: true, hasActiveSubscription: true, subscriptionPlan: "titan" };
  }
  if (titan) {
    await userRef.set(
      {
        uid,
        email: email?.toLowerCase(),
        role: "streamer",
        isAdmin: false,
        isTitanVip: true,
        hasActiveSubscription: true,
        subscriptionPlan: "titan",
        subscriptionTierLevel: 5,
        subscriptionStatus: "active",
        billingCycle: "lifetime",
        clipBalance: 600,
        clipsLimitTotal: 600,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return { isAdmin: false, isTitanVip: true, hasActiveSubscription: true, subscriptionPlan: "titan" };
  }
  const existingData = snap.data();
  const hasActiveSub = Boolean(existingData?.hasActiveSubscription === true && existingData?.subscriptionStatus === "active");
  return {
    isAdmin: false,
    isTitanVip: false,
    hasActiveSubscription: hasActiveSub,
    subscriptionPlan: existingData?.subscriptionPlan || "free"
  };
}
async function requireAuth(req, res, next) {
  const apiKeyHeader = req.headers["x-api-key"] || req.headers["x-api-token"];
  if (apiKeyHeader && typeof apiKeyHeader === "string" && apiKeyHeader.trim().startsWith("qc_live_")) {
    try {
      const cleanKey = apiKeyHeader.trim();
      const keyHash = crypto.createHash("sha256").update(cleanKey).digest("hex");
      const keyQuery = await db.collectionGroup("apiKeys").where("keyHash", "==", keyHash).where("status", "==", "active").limit(1).get();
      if (keyQuery.empty) {
        res.status(401).json({
          success: false,
          error: "Nicht autorisiert (HTTP 401): Ung\xFCltiger oder widerrufener API-Schl\xFCssel (X-API-Key)."
        });
        return;
      }
      const keyDoc = keyQuery.docs[0];
      const keyData = keyDoc.data();
      const uid = keyData.userId;
      keyDoc.ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {
      });
      const userDoc = await db.collection("users").doc(uid).get();
      const userData = userDoc.data();
      const email = userData?.email || "";
      const status = await syncVipAndAdminStatus(uid, email);
      const hasActiveSubscription = status.isAdmin || status.hasActiveSubscription || userData?.hasActiveSubscription === true;
      req.user = {
        uid,
        email,
        role: status.isAdmin ? "admin" : "streamer",
        isAdmin: status.isAdmin,
        isTitanVip: status.isTitanVip,
        hasActiveSubscription,
        subscribed: hasActiveSubscription,
        subscriptionPlan: status.subscriptionPlan
      };
      return next();
    } catch (err) {
      console.error("[AuthMiddleware] API Key verification error:", err.message);
      res.status(401).json({ success: false, error: "API-Schl\xFCssel Validierung fehlgeschlagen." });
      return;
    }
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "Nicht autorisiert (HTTP 401): G\xFCltiges Bearer-Token oder X-API-Key fehlt." });
    return;
  }
  const idToken = authHeader.split("Bearer ")[1].trim();
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken, true);
    const email = decodedToken.email || "";
    const status = await syncVipAndAdminStatus(decodedToken.uid, email);
    const isSubscribedFromClaims = decodedToken.subscribed === true || decodedToken.hasActiveSubscription === true;
    const hasActiveSubscription = status.isAdmin || isSubscribedFromClaims || status.hasActiveSubscription;
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: status.isAdmin ? "admin" : "streamer",
      isAdmin: status.isAdmin,
      isTitanVip: status.isTitanVip,
      hasActiveSubscription,
      subscriptionPlan: decodedToken.tier || status.subscriptionPlan
    };
    next();
  } catch (error) {
    console.error("[AuthMiddleware] Ung\xFCltiges Token:", error.message);
    res.status(401).json({ success: false, error: "Token ung\xFCltig oder abgelaufen." });
  }
}
async function requireAdmin(req, res, next) {
  const checkAdmin = () => {
    if (!req.user?.isAdmin) {
      res.status(403).json({ success: false, error: "Zugriff verweigert (HTTP 403): Adminrechte erforderlich." });
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
async function requireActiveSubscription(req, res, next) {
  const checkSubscription = () => {
    if (!req.user?.hasActiveSubscription && !req.user?.isAdmin) {
      res.status(403).json({
        success: false,
        error: "Zugriff verweigert (HTTP 403 Forbidden): Kein aktives Abonnement gefunden. Systemfunktionen sind gesperrt, bis ein verifiziertes Abonnement vorliegt.",
        code: "SUBSCRIPTION_REQUIRED"
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
const verifyAuth = requireAuth;
export {
  BOOTSTRAPPED_ADMIN_EMAIL,
  TITAN_LIFETIME_EMAILS,
  isMasterAdmin,
  isTitanLifetime,
  requireActiveSubscription,
  requireAdmin,
  requireAuth,
  syncVipAndAdminStatus,
  verifyAuth
};
