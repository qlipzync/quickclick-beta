import type { Request, Response, NextFunction } from 'express';

export function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Benutzerkontext fehlt.',
    });
    return;
  }

  // Strikte Prüfung auf serverseitig gesetztes Custom Claim / aktives Abonnement
  const isSubscribed = Boolean(
    req.user.subscribed ||
    req.user.hasActiveSubscription ||
    req.user.isAdmin
  );

  if (!isSubscribed) {
    res.status(403).json({
      error: 'SUBSCRIPTION_REQUIRED',
      message: 'Zugriff verweigert. Diese Ressource erfordert ein aktives Abonnement.',
    });
    return;
  }

  next();
}

export const requireActiveSubscription = requireSubscription;
