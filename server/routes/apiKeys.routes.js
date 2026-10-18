import { Router } from "express";
import crypto from "crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { verifyAuth, requireActiveSubscription as requireSubscription } from "../middleware/authMiddleware.js";
const apiKeysRouter = Router();
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91";
const db = getFirestore(FIRESTORE_DB_ID);
apiKeysRouter.get(
  "/",
  verifyAuth,
  requireSubscription,
  async (req, res) => {
    try {
      const uid = req.user.uid;
      const snapshot = await db.collection("users").doc(uid).collection("apiKeys").where("status", "==", "active").get();
      const keys = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        keys.push({
          id: doc.id,
          name: data.name || "Unbenannter Client",
          keyPrefix: data.keyPrefix || "qc_live_****",
          createdAt: data.createdAt && typeof data.createdAt.toDate === "function" ? data.createdAt.toDate().toISOString() : data.createdAt ? new Date(data.createdAt).toISOString() : null,
          lastUsedAt: data.lastUsedAt && typeof data.lastUsedAt.toDate === "function" ? data.lastUsedAt.toDate().toISOString() : data.lastUsedAt ? new Date(data.lastUsedAt).toISOString() : null
        });
      });
      keys.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      res.status(200).json({ success: true, keys });
    } catch (error) {
      console.error("[ApiKeysRoutes] Fehler beim Abrufen der Schl\xFCssel:", error?.message);
      res.status(500).json({ success: false, error: "API-Schl\xFCssel konnten nicht geladen werden." });
    }
  }
);
apiKeysRouter.post(
  "/",
  verifyAuth,
  requireSubscription,
  async (req, res) => {
    const { name } = req.body || {};
    const uid = req.user.uid;
    const keyName = (typeof name === "string" ? name.trim() : "") || "Drittanbieter Client";
    try {
      const randomHex = crypto.randomBytes(24).toString("hex");
      const fullPlaintextKey = `qc_live_${randomHex}`;
      const keyPrefix = `qc_live_${randomHex.slice(0, 4)}...${randomHex.slice(-4)}`;
      const keyHash = crypto.createHash("sha256").update(fullPlaintextKey).digest("hex");
      const keyId = `key_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      await db.collection("users").doc(uid).collection("apiKeys").doc(keyId).set({
        id: keyId,
        userId: uid,
        name: keyName,
        keyPrefix,
        keyHash,
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
        lastUsedAt: null
      });
      res.status(201).json({
        success: true,
        id: keyId,
        key: fullPlaintextKey,
        name: keyName,
        keyPrefix,
        message: "API-Schl\xFCssel erfolgreich generiert. Bitte speichere ihn jetzt sicher ab, er wird nie wieder angezeigt!"
      });
    } catch (error) {
      console.error("[ApiKeysRoutes] Fehler beim Erstellen des Schl\xFCssels:", error?.message);
      res.status(500).json({ success: false, error: "API-Schl\xFCssel konnte nicht erstellt werden." });
    }
  }
);
apiKeysRouter.delete(
  "/:keyId",
  verifyAuth,
  requireSubscription,
  async (req, res) => {
    const rawKeyId = req.params.keyId;
    const keyId = Array.isArray(rawKeyId) ? rawKeyId[0] : rawKeyId;
    const uid = req.user.uid;
    if (!keyId) {
      res.status(400).json({ success: false, error: "keyId ist erforderlich." });
      return;
    }
    try {
      const keyRef = db.collection("users").doc(uid).collection("apiKeys").doc(keyId);
      const doc = await keyRef.get();
      if (!doc.exists) {
        res.status(404).json({ success: false, error: "API-Schl\xFCssel nicht gefunden." });
        return;
      }
      await keyRef.update({
        status: "revoked",
        revokedAt: FieldValue.serverTimestamp()
      });
      res.status(200).json({ success: true, message: "API-Schl\xFCssel wurde erfolgreich widerrufen." });
    } catch (error) {
      console.error("[ApiKeysRoutes] Fehler beim Widerrufen:", error?.message);
      res.status(500).json({ success: false, error: "Widerrufen des API-Schl\xFCssels fehlgeschlagen." });
    }
  }
);
export {
  apiKeysRouter
};
