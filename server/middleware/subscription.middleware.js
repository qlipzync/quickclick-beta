function requireSubscription(req, res, next) {
  if (!req.user) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Benutzerkontext fehlt."
    });
    return;
  }
  const isSubscribed = Boolean(
    req.user.subscribed || req.user.hasActiveSubscription || req.user.isAdmin
  );
  if (!isSubscribed) {
    res.status(403).json({
      error: "SUBSCRIPTION_REQUIRED",
      message: "Zugriff verweigert. Diese Ressource erfordert ein aktives Abonnement."
    });
    return;
  }
  next();
}
const requireActiveSubscription = requireSubscription;
export {
  requireActiveSubscription,
  requireSubscription
};
