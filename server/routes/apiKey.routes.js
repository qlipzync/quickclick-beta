import { Router } from "express";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { unifiedAuth } from "../middleware/unifiedAuth.middleware.js";
import { requireSubscription } from "../middleware/subscription.middleware.js";
import { generateSecureApiKey } from "../utils/apiKey.util.js";
const apiKeyRouter = Router();
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91";
const db = getFirestore(FIRESTORE_DB_ID);
apiKeyRouter.get(
  "/",
  unifiedAuth,
  requireSubscription,
  async (req, res) => {
    try {
      const uid = req.user.uid;
      const snapshot = await db.collection("api_keys").where("userId", "==", uid).where("revoked", "==", false).get();
      const keys = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        keys.push({
          id: doc.id,
          name: data.name || "API Client",
          keyPrefix: data.keyPrefix || "qc_live_****",
          createdAt: data.createdAt && typeof data.createdAt.toDate === "function" ? data.createdAt.toDate().toISOString() : data.createdAt ? new Date(data.createdAt).toISOString() : null,
          lastUsedAt: data.lastUsedAt && typeof data.lastUsedAt.toDate === "function" ? data.lastUsedAt.toDate().toISOString() : data.lastUsedAt ? new Date(data.lastUsedAt).toISOString() : null
        });
      });
      if (keys.length === 0) {
        const userSubSnapshot = await db.collection("users").doc(uid).collection("apiKeys").where("status", "==", "active").get();
        userSubSnapshot.forEach((doc) => {
          const data = doc.data();
          keys.push({
            id: doc.id,
            name: data.name || "API Client",
            keyPrefix: data.keyPrefix || "qc_live_****",
            createdAt: data.createdAt && typeof data.createdAt.toDate === "function" ? data.createdAt.toDate().toISOString() : data.createdAt ? new Date(data.createdAt).toISOString() : null,
            lastUsedAt: data.lastUsedAt && typeof data.lastUsedAt.toDate === "function" ? data.lastUsedAt.toDate().toISOString() : data.lastUsedAt ? new Date(data.lastUsedAt).toISOString() : null
          });
        });
      }
      keys.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      res.status(200).json({ success: true, keys });
    } catch (error) {
      console.error("[ApiKeyRoutes] Fehler beim Laden der Schl\xFCssel:", error?.message);
      res.status(500).json({ error: "FETCH_FAILED", message: "API-Schl\xFCssel konnten nicht geladen werden." });
    }
  }
);
apiKeyRouter.post(
  "/",
  unifiedAuth,
  requireSubscription,
  async (req, res) => {
    const { name } = req.body || {};
    const uid = req.user.uid;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      res.status(400).json({ error: "BAD_REQUEST", message: "Ein Bezeichner (Name) ist erforderlich." });
      return;
    }
    try {
      const countSnapshot = await db.collection("api_keys").where("userId", "==", uid).where("revoked", "==", false).get();
      if (countSnapshot.size >= 5) {
        res.status(400).json({
          error: "LIMIT_REACHED",
          message: "Maximal 5 aktive API-Schl\xFCssel gleichzeitig erlaubt."
        });
        return;
      }
      const { rawKey, hashedKey, keyPrefix } = generateSecureApiKey();
      const newKeyDoc = await db.collection("api_keys").add({
        userId: uid,
        name: name.trim(),
        hashedKey,
        keyPrefix,
        revoked: false,
        createdAt: FieldValue.serverTimestamp(),
        lastUsedAt: null
      });
      await db.collection("users").doc(uid).collection("apiKeys").doc(newKeyDoc.id).set({
        id: newKeyDoc.id,
        userId: uid,
        name: name.trim(),
        keyPrefix,
        keyHash: hashedKey,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        lastUsedAt: null
      }).catch(() => {
      });
      res.status(201).json({
        success: true,
        id: newKeyDoc.id,
        name: name.trim(),
        keyPrefix,
        rawKey,
        key: rawKey,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        message: "API-Schl\xFCssel erfolgreich generiert. Bitte speichere ihn jetzt sicher ab, er wird nie wieder angezeigt!"
      });
    } catch (error) {
      console.error("[ApiKeyRoutes] Fehler beim Erstellen des Schl\xFCssels:", error?.message);
      res.status(500).json({ error: "CREATION_FAILED", message: "API-Schl\xFCssel konnte nicht erstellt werden." });
    }
  }
);
apiKeyRouter.delete(
  "/:keyId",
  unifiedAuth,
  requireSubscription,
  async (req, res) => {
    const rawKeyId = req.params.keyId;
    const keyId = Array.isArray(rawKeyId) ? rawKeyId[0] : rawKeyId;
    const uid = req.user.uid;
    if (!keyId) {
      res.status(400).json({ error: "BAD_REQUEST", message: "Schl\xFCssel-ID erforderlich." });
      return;
    }
    try {
      const keyRef = db.collection("api_keys").doc(keyId);
      const keyDoc = await keyRef.get();
      if (keyDoc.exists) {
        if (keyDoc.data()?.userId !== uid) {
          res.status(404).json({ error: "NOT_FOUND", message: "Schl\xFCssel nicht gefunden." });
          return;
        }
        await keyRef.update({
          revoked: true,
          revokedAt: FieldValue.serverTimestamp()
        });
      }
      const userKeyRef = db.collection("users").doc(uid).collection("apiKeys").doc(keyId);
      const userKeyDoc = await userKeyRef.get();
      if (userKeyDoc.exists) {
        await userKeyRef.update({
          status: "revoked",
          revokedAt: FieldValue.serverTimestamp()
        });
      }
      res.status(200).json({ success: true, message: "API-Schl\xFCssel erfolgreich widerrufen." });
    } catch (error) {
      console.error("[ApiKeyRoutes] Fehler beim Widerrufen:", error?.message);
      res.status(500).json({ error: "REVOCATION_FAILED", message: "Widerruf fehlgeschlagen." });
    }
  }
);
const apiKeysRouter = apiKeyRouter;
export {
  apiKeyRouter,
  apiKeysRouter
};
