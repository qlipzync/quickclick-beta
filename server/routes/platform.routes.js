import { Router } from "express";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { verifyAuth, requireActiveSubscription as requireSubscription } from "../middleware/authMiddleware.js";
import { encryptToken } from "../services/kmsService.js";
const platformRouter = Router();
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91";
const db = getFirestore(FIRESTORE_DB_ID);
platformRouter.get(
  "/status",
  verifyAuth,
  requireSubscription,
  async (req, res) => {
    try {
      const uid = req.user.uid;
      const integrationsSnapshot = await db.collection("users").doc(uid).collection("integrations").get();
      const platforms = {
        twitch: { connected: false, accountName: null, updatedAt: null },
        youtube: { connected: false, accountName: null, updatedAt: null },
        tiktok: { connected: false, accountName: null, updatedAt: null }
      };
      integrationsSnapshot.forEach((doc) => {
        const id = doc.id;
        const data = doc.data();
        if (platforms[id]) {
          platforms[id] = {
            connected: Boolean(data.connected),
            accountName: data.accountName || null,
            updatedAt: data.updatedAt && typeof data.updatedAt.toDate === "function" ? data.updatedAt.toDate().toISOString() : data.updatedAt ? new Date(data.updatedAt).toISOString() : null
          };
        }
      });
      res.status(200).json({ platforms });
    } catch (error) {
      console.error("[PlatformRoutes] Fehler beim Laden des Status:", error?.message);
      res.status(500).json({ error: "INTERNAL_ERROR", message: "Plattform-Status konnte nicht geladen werden." });
    }
  }
);
platformRouter.post(
  "/callback/twitch",
  verifyAuth,
  requireSubscription,
  async (req, res) => {
    const { code, redirectUri } = req.body || {};
    const uid = req.user.uid;
    if (!code || !redirectUri) {
      res.status(400).json({ error: "BAD_REQUEST", message: "Code und redirectUri erforderlich." });
      return;
    }
    try {
      const clientId = process.env.TWITCH_CLIENT_ID || "afht5r000ofphuq2uh4aljljp0nivv";
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      const tokenParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret || "",
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      });
      const tokenResponse = await fetch("https://id.twitch.tv/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString()
      });
      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error("[Twitch Token Exchange Error]", errText);
        res.status(400).json({ error: "TOKEN_EXCHANGE_FAILED", message: "Twitch Token-Austausch fehlgeschlagen." });
        return;
      }
      const tokenData = await tokenResponse.json();
      const { access_token, refresh_token } = tokenData;
      const userProfileResponse = await fetch("https://api.twitch.tv/helix/users", {
        headers: {
          "Client-ID": clientId,
          Authorization: `Bearer ${access_token}`
        }
      });
      let accountName = "Unbekannter Kanal";
      let twitchUserId = "";
      if (userProfileResponse.ok) {
        const profileData = await userProfileResponse.json();
        const twitchUserData = profileData.data?.[0];
        accountName = twitchUserData?.display_name || accountName;
        twitchUserId = twitchUserData?.id || "";
      }
      const encryptedAccessToken = await encryptToken(access_token);
      const encryptedRefreshToken = refresh_token ? await encryptToken(refresh_token) : null;
      await db.collection("users").doc(uid).collection("integrations").doc("twitch").set({
        connected: true,
        accountName,
        twitchUserId,
        encryptedAccessToken,
        encryptedRefreshToken,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      await db.collection("users").doc(uid).set({
        twitchConnected: true,
        channelName: accountName,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      res.status(200).json({
        success: true,
        platform: "twitch",
        accountName
      });
    } catch (error) {
      console.error("[PlatformRoutes] Twitch OAuth error:", error?.message);
      res.status(500).json({ error: "OAUTH_FAILED", message: "Twitch-Verkn\xFCpfung fehlgeschlagen." });
    }
  }
);
platformRouter.post(
  "/disconnect/:platform",
  verifyAuth,
  requireSubscription,
  async (req, res) => {
    const rawPlatform = req.params.platform;
    const platform = Array.isArray(rawPlatform) ? rawPlatform[0] : rawPlatform;
    const uid = req.user.uid;
    const allowedPlatforms = ["twitch", "youtube", "tiktok"];
    if (!platform || !allowedPlatforms.includes(platform)) {
      res.status(400).json({ error: "INVALID_PLATFORM", message: "Ung\xFCltige Plattform angegeben." });
      return;
    }
    try {
      await db.collection("users").doc(uid).collection("integrations").doc(platform).delete();
      if (platform === "twitch") {
        await db.collection("users").doc(uid).set({
          twitchConnected: false,
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
      res.status(200).json({ success: true, message: `${platform} erfolgreich getrennt.` });
    } catch (error) {
      console.error("[PlatformRoutes] Disconnect error:", error?.message);
      res.status(500).json({ error: "DELETE_FAILED", message: "Trennen der Plattform fehlgeschlagen." });
    }
  }
);
export {
  platformRouter
};
