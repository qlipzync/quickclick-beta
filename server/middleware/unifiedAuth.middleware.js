import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { hashApiKey, API_KEY_PREFIX } from "../utils/apiKey.util.js";
if (!getApps().length) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "qlipzync"
  });
}
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91";
const db = getFirestore(FIRESTORE_DB_ID);
const BOOTSTRAPPED_ADMIN_EMAIL = "robert.f.telekom@gmail.com";
async function unifiedAuth(req, res, next) {
  const apiKeyHeader = req.headers["x-api-key"] || req.headers["x-api-token"];
  const authHeader = req.headers.authorization;
  let candidateKey = null;
  if (apiKeyHeader) {
    candidateKey = apiKeyHeader.trim();
  } else if (authHeader?.startsWith("Bearer ")) {
    const tokenPart = authHeader.split("Bearer ")[1].trim();
    if (tokenPart.startsWith(API_KEY_PREFIX)) {
      candidateKey = tokenPart;
    }
  }
  if (candidateKey) {
    if (!candidateKey.startsWith(API_KEY_PREFIX)) {
      res.status(401).json({
        error: "INVALID_API_KEY_FORMAT",
        message: "Der angegebene API-Schl\xFCssel besitzt ein ung\xFCltiges Format (erwartet: qc_live_...)."
      });
      return;
    }
    try {
      const hashedKey = hashApiKey(candidateKey);
      let keyDoc = null;
      let userId = null;
      const rootKeyQuery = await db.collection("api_keys").where("hashedKey", "==", hashedKey).where("revoked", "==", false).limit(1).get();
      if (!rootKeyQuery.empty) {
        keyDoc = rootKeyQuery.docs[0];
        userId = keyDoc.data().userId;
      } else {
        const groupQuery = await db.collectionGroup("apiKeys").where("keyHash", "==", hashedKey).where("status", "==", "active").limit(1).get();
        if (!groupQuery.empty) {
          keyDoc = groupQuery.docs[0];
          userId = keyDoc.data().userId;
        }
      }
      if (!keyDoc || !userId) {
        res.status(401).json({
          error: "INVALID_API_KEY",
          message: "API-Schl\xFCssel ist ung\xFCltig oder wurde widerrufen."
        });
        return;
      }
      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        res.status(401).json({
          error: "USER_NOT_FOUND",
          message: "Zugeh\xF6riges Benutzerkonto existiert nicht mehr."
        });
        return;
      }
      const userData = userDoc.data();
      const email = (userData?.email || "").trim().toLowerCase();
      const isAdmin = email === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() || userData?.role === "admin" || userData?.isAdmin === true;
      const isSubscribed = isAdmin || userData?.subscriptionStatus === "active" || userData?.hasActiveSubscription === true;
      if (!isSubscribed) {
        res.status(403).json({
          error: "SUBSCRIPTION_REQUIRED",
          message: "Der API-Zugriff erfordert ein aktives QuickClick-Abonnement."
        });
        return;
      }
      keyDoc.ref.update({
        lastUsedAt: FieldValue.serverTimestamp()
      }).catch(() => {
      });
      req.user = {
        uid: userId,
        email: userData?.email || "",
        role: isAdmin ? "admin" : userData?.role || "streamer",
        isAdmin,
        isTitanVip: Boolean(userData?.isTitanVip),
        hasActiveSubscription: true,
        subscribed: true,
        subscriptionTier: userData?.subscriptionTier || userData?.subscriptionPlan || "pro",
        subscriptionPlan: userData?.subscriptionPlan || "pro"
      };
      next();
      return;
    } catch (error) {
      console.error("[UnifiedAuth] Fehler bei der API-Key-Validierung:", error?.message);
      res.status(500).json({
        error: "AUTH_GATEWAY_ERROR",
        message: "Fehler bei der API-Key-Validierung."
      });
      return;
    }
  }
  if (authHeader?.startsWith("Bearer ")) {
    const idToken = authHeader.split("Bearer ")[1].trim();
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken, true);
      const uid = decodedToken.uid;
      const email = (decodedToken.email || "").trim().toLowerCase();
      const isAdmin = email === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase() || decodedToken.role === "admin" || decodedToken.isAdmin === true;
      let hasActiveSubscription = isAdmin || decodedToken.subscribed === true || decodedToken.hasActiveSubscription === true;
      if (!hasActiveSubscription) {
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          hasActiveSubscription = userData?.subscriptionStatus === "active" || userData?.hasActiveSubscription === true;
        }
      }
      req.user = {
        uid,
        email: decodedToken.email || "",
        role: isAdmin ? "admin" : "streamer",
        isAdmin,
        isTitanVip: Boolean(decodedToken.isTitanVip),
        hasActiveSubscription,
        subscribed: hasActiveSubscription,
        subscriptionTier: decodedToken.tier || "pro",
        subscriptionPlan: decodedToken.tier || "pro"
      };
      next();
      return;
    } catch (error) {
      console.error("[UnifiedAuth] Ung\xFCltiges Token:", error?.message);
      res.status(401).json({
        error: "INVALID_TOKEN",
        message: "Das Sitzungstoken ist ung\xFCltig oder abgelaufen."
      });
      return;
    }
  }
  res.status(401).json({
    error: "MISSING_CREDENTIALS",
    message: "Weder X-API-Key noch Authorization Bearer Token vorhanden."
  });
}
export {
  BOOTSTRAPPED_ADMIN_EMAIL,
  unifiedAuth
};
