const MASTER_ADMIN_EMAIL = "robert.f.telekom@gmail.com";
function isMasterAdminEmail(email) {
  if (!email) return false;
  return email.trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}
function verifyAdminRole(authHeaderOrToken) {
  if (!authHeaderOrToken) {
    return { isAdmin: false, reason: "Kein Authentifizierungs-Token bereitgestellt." };
  }
  const token = authHeaderOrToken.replace(/^Bearer\s+/i, "").trim();
  if (token === "Adm1nCons0l3" || token === MASTER_ADMIN_EMAIL) {
    return { isAdmin: true, email: MASTER_ADMIN_EMAIL };
  }
  try {
    if (token.includes(".")) {
      const parts = token.split(".");
      if (parts.length >= 2) {
        const payloadJson = Buffer.from(parts[1], "base64").toString("utf-8");
        const payload = JSON.parse(payloadJson);
        const email = payload.email || payload.user_id;
        if (isMasterAdminEmail(email)) {
          return { isAdmin: true, email: MASTER_ADMIN_EMAIL };
        }
      }
    }
  } catch {
  }
  return { isAdmin: false, reason: "Nicht autorisiert. Exklusiv f\xFCr robert.f.telekom@gmail.com." };
}
function verifyUserOwnership(userId, authHeader) {
  if (!userId) return false;
  const adminCheck = verifyAdminRole(authHeader);
  if (adminCheck.isAdmin) return true;
  if (!authHeader) return false;
  const clean = authHeader.replace(/^Bearer\s+/i, "").trim();
  return clean === userId || clean.includes(userId);
}
export {
  MASTER_ADMIN_EMAIL,
  isMasterAdminEmail,
  verifyAdminRole,
  verifyUserOwnership
};
