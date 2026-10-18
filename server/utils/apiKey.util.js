import crypto from "crypto";
const API_KEY_PREFIX = "qc_live_";
function generateSecureApiKey() {
  const entropy = crypto.randomBytes(32).toString("hex");
  const rawKey = `${API_KEY_PREFIX}${entropy}`;
  const hashedKey = hashApiKey(rawKey);
  const keyPrefix = `${rawKey.slice(0, 16)}...`;
  return {
    rawKey,
    hashedKey,
    keyPrefix
  };
}
function hashApiKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey, "utf8").digest("hex");
}
export {
  API_KEY_PREFIX,
  generateSecureApiKey,
  hashApiKey
};
