import crypto from "crypto";
const KMS_CONFIG = {
  projectId: "qlipzync",
  locationId: "europe-west3",
  keyRingId: "saas-user-credentials",
  cryptoKeyId: "byok-encryption-key",
  serviceAccount: "sa-twitch-pipeline@qlipzync.iam.gserviceaccount.com",
  resourceName: "projects/qlipzync/locations/europe-west3/keyRings/saas-user-credentials/cryptoKeys/byok-encryption-key"
};
const LOCAL_FALLBACK_SALT = "qlipzync-byok-europe-west3-keyring-saas-user-credentials";
function getDerivedMasterKey() {
  const masterSecret = process.env.SESSION_SECRET || process.env.KMS_FALLBACK_SECRET || "qlipzync-saas-kms-secure-master-2026";
  return crypto.scryptSync(masterSecret, LOCAL_FALLBACK_SALT, 32);
}
async function encryptSecret(plaintext) {
  if (!plaintext) {
    throw new Error("Plaintext secret cannot be empty");
  }
  const iv = crypto.randomBytes(12);
  const key = getDerivedMasterKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    kmsKeyResource: KMS_CONFIG.resourceName,
    algorithm: "AES-256-GCM",
    encryptedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function decryptSecret(payload) {
  if (!payload || !payload.ciphertext || !payload.iv || !payload.tag) {
    throw new Error("Invalid encrypted secret payload");
  }
  const key = getDerivedMasterKey();
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(payload.ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
async function encryptToken(plaintext) {
  const payload = await encryptSecret(plaintext);
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}
async function decryptToken(ciphertextBase64) {
  const jsonStr = Buffer.from(ciphertextBase64, "base64").toString("utf8");
  const payload = JSON.parse(jsonStr);
  return decryptSecret(payload);
}
var kmsService_default = {
  KMS_CONFIG,
  encryptSecret,
  decryptSecret,
  encryptToken,
  decryptToken
};
export {
  KMS_CONFIG,
  decryptSecret,
  decryptToken,
  kmsService_default as default,
  encryptSecret,
  encryptToken
};
