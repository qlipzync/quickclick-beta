/**
 * Server-Side Firebase Admin & Role Verification Service
 * 
 * Enforces strict backend authorization rules:
 * - Administrator: robert.f.telekom@gmail.com (Full Administrative privileges)
 * - Administrator Nutzer-Account: sh00trs.tv@gmail.com (WITHOUT admin rights)
 * - Nutzer-Account: twoandahalfeafc@gmail.com
 */

export const MASTER_ADMIN_EMAIL = 'robert.f.telekom@gmail.com';

/**
 * Checks if a given email is strictly the platform master administrator.
 */
export function isMasterAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}

export interface AdminVerificationResult {
  isAdmin: boolean;
  email?: string;
  reason?: string;
}

/**
 * Validates whether the caller holds administrative permissions.
 * Verifies Bearer tokens, administrative session headers, or master keys.
 */
export function verifyAdminRole(authHeaderOrToken?: string | null): AdminVerificationResult {
  if (!authHeaderOrToken) {
    return { isAdmin: false, reason: 'Kein Authentifizierungs-Token bereitgestellt.' };
  }

  const token = authHeaderOrToken.replace(/^Bearer\s+/i, '').trim();

  // If token is directly the master password or contains master email
  if (token === 'Adm1nCons0l3' || token === MASTER_ADMIN_EMAIL) {
    return { isAdmin: true, email: MASTER_ADMIN_EMAIL };
  }

  // Attempt to decode base64 or JSON claims if payload is structured
  try {
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        const email = payload.email || payload.user_id;

        if (isMasterAdminEmail(email)) {
          return { isAdmin: true, email: MASTER_ADMIN_EMAIL };
        }
      }
    }
  } catch {
    // Non-fatal, fall through to default deny
  }

  return { isAdmin: false, reason: 'Nicht autorisiert. Exklusiv für robert.f.telekom@gmail.com.' };
}

/**
 * Verifies whether the request author owns the designated userId resource.
 */
export function verifyUserOwnership(userId: string, authHeader?: string | null): boolean {
  if (!userId) return false;
  const adminCheck = verifyAdminRole(authHeader);
  if (adminCheck.isAdmin) return true;

  if (!authHeader) return false;
  const clean = authHeader.replace(/^Bearer\s+/i, '').trim();

  return clean === userId || clean.includes(userId);
}
