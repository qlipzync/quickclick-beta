import { Router } from 'express';
import Stripe from 'stripe';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { requireAuth } from '../middleware/authMiddleware.js';

export const stripeRouter = Router();

/**
 * Per-instance rate limiting for authenticated Stripe management endpoints.
 * Uses Express's resolved client IP and bounds the in-memory store to avoid
 * attacker-driven memory growth. This is defense-in-depth; use a shared store
 * if strict limits across multiple Cloud Run instances are required.
 */
const stripeRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function stripeRouteRateLimit(maxRequests: number, windowMs: number) {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const now = Date.now();
    // Use the IP resolved by Express/proxy trust configuration; do not trust
    // arbitrary X-Forwarded-For input directly.
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // req.path may be identical for aliases; including the registered base URL
    // keeps counters route-scoped after Express mounts the router.
    const routePath = req.baseUrl || req.path;
    const key = `${req.method}:${routePath}:${ip}`;
    let bucket = stripeRateLimitBuckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      stripeRateLimitBuckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader('RateLimit-Limit', String(maxRequests));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)));

    if (bucket.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
      return res.status(429).json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen.', retryAfter });
    }

    if (stripeRateLimitBuckets.size > 5000) {
      for (const [bucketKey, value] of stripeRateLimitBuckets) {
        if (value.resetAt <= now) stripeRateLimitBuckets.delete(bucketKey);
      }
    }
    return next();
  };
}

const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || 'ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91';
const db = getFirestore(FIRESTORE_DB_ID);
const stripeEvents = db.collection('_stripeWebhookEvents');

let stripeClient: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export function calculateDynamicClipPrice(clipsInput: number) {
  const clips = Math.max(1, Math.min(20000, Math.floor(Number(clipsInput) || 1)));
  const logFactor = 1 - Math.log(clips) / Math.log(20000);
  const unitPrice = Math.max(0.05, 0.05 + (0.50 - 0.05) * logFactor);
  const totalPrice = Number((clips * unitPrice).toFixed(2));
  const discountPercent = Math.round((1 - unitPrice / 0.50) * 100);
  return {
    clips,
    unitPriceEur: Number(unitPrice.toFixed(4)),
    totalPriceEur: totalPrice,
    totalPriceCents: Math.round(totalPrice * 100),
    discountPercent,
  };
}

export interface StripeWebhookLog {
  id: string;
  type: string;
  createdAt: string;
  livemode: boolean;
  objectId?: string;
  objectType?: string;
  details: string;
  status: 'acknowledged' | 'processed' | 'warning' | 'error';
}

const recentStripeEvents: StripeWebhookLog[] = [];
export function recordStripeEvent(log: StripeWebhookLog) {
  recentStripeEvents.unshift(log);
  if (recentStripeEvents.length > 50) recentStripeEvents.pop();
}

const allowedReturnOrigins = new Set(
  (process.env.STRIPE_RETURN_ORIGINS || process.env.CORS_ALLOWED_ORIGINS || 'https://qlipzync.web.app,https://qlipzync.firebaseapp.com')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

function getSafeReturnUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length > 2048) return fallback;
  try {
    const candidate = new URL(value);
    if (candidate.protocol !== 'https:' || !allowedReturnOrigins.has(candidate.origin)) return fallback;
    return candidate.origin;
  } catch {
    return fallback;
  }
}

function isVerifiedPaidCheckout(session: Stripe.Checkout.Session, expectedCurrency = 'eur'): boolean {
  return session.payment_status === 'paid'
    && session.status === 'complete'
    && session.mode === 'payment'
    && session.currency === expectedCurrency
    && Number.isInteger(Number(session.metadata?.clips))
    && Number(session.metadata?.clips) >= 1
    && Number(session.metadata?.clips) <= 20000
    && Number(session.amount_total) > 0;
}

stripeRouter.get('/products', (_req, res) => {
  return res.json({
    status: 'ok',
    currency: 'EUR',
    pricingModel: 'dynamic_slider',
    slider: {
      minClips: 1,
      maxClips: 20000,
      baseUnitPriceEur: 0.50,
      minUnitPriceEur: 0.05,
      formula: 'logarithmic_tier_discount',
      defaultClips: 100,
    },
  });
});

stripeRouter.post(['/checkout', '/create-checkout-session'], stripeRouteRateLimit(10, 60_000), requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) return res.status(401).json({ error: 'Authentifizierung erforderlich.' });

    const userEmail = req.user?.email;
    const requestedClips = Number(req.body?.clips);
    if (!Number.isInteger(requestedClips) || requestedClips < 1 || requestedClips > 20000) {
      return res.status(400).json({ error: 'Ungültige Clipanzahl. Erlaubt: 1 bis 20.000 Clips.' });
    }

    const priceCalc = calculateDynamicClipPrice(requestedClips);
    const stripe = getStripe();
    if (!stripe) return res.status(503).json({ error: 'Zahlungsanbieter ist nicht konfiguriert.' });

    const configuredBase = process.env.APP_BASE_URL || 'https://qlipzync.web.app';
    const fallback = getSafeReturnUrl(configuredBase, 'https://qlipzync.web.app');
    const returnOrigin = getSafeReturnUrl(req.body?.returnUrl, fallback);

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: userEmail || undefined,
      client_reference_id: userId,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `QuickClick: ${priceCalc.clips.toLocaleString('de-DE')} Clips Paket`,
            description: `Zero-Storage Clip-Verarbeitung (${priceCalc.unitPriceEur.toFixed(3)} € pro Clip, ${priceCalc.discountPercent}% Mengenrabatt)`,
          },
          unit_amount: priceCalc.totalPriceCents,
        },
        quantity: 1,
      }],
      metadata: {
        userId,
        pricingModel: 'dynamic_slider',
        clips: String(priceCalc.clips),
        unitPriceEur: String(priceCalc.unitPriceEur),
        totalPriceEur: String(priceCalc.totalPriceEur),
      },
      success_url: `${returnOrigin}/?session_id={CHECKOUT_SESSION_ID}&payment=success&clips=${priceCalc.clips}`,
      cancel_url: `${returnOrigin}/?payment=cancelled`,
    });

    return res.status(201).json({
      sessionId: session.id,
      url: session.url,
      clips: priceCalc.clips,
      unitPriceEur: priceCalc.unitPriceEur,
      totalPriceEur: priceCalc.totalPriceEur,
    });
  } catch (error) {
    console.error('[Stripe Checkout Error]', error);
    return res.status(500).json({ error: 'Checkout konnte nicht erstellt werden.' });
  }
});

/**
 * Process only cryptographically verified Stripe events.
 * Event claim, wallet credit and invoice creation are one Firestore transaction;
 * duplicate deliveries across restarts/instances cannot credit twice.
 */
stripeRouter.post(['/webhook', '/'], async (req, res) => {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];

  if (!stripe || !webhookSecret || typeof signature !== 'string' || !(req as any).rawBody?.length) {
    return res.status(503).json({ error: 'Stripe Webhook ist nicht vollständig konfiguriert.' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent((req as any).rawBody, signature, webhookSecret);
  } catch (error) {
    console.warn('[Stripe Webhook] Signature verification failed.');
    return res.status(400).json({ error: 'Ungültige Webhook-Signatur.' });
  }

  const eventRef = stripeEvents.doc(event.id);
  const object = event.data.object as Stripe.Checkout.Session;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const existingEvent = await transaction.get(eventRef);
      if (existingEvent.exists) return { duplicate: true, status: 'duplicate' as const };

      if (event.type !== 'checkout.session.completed') {
        transaction.create(eventRef, {
          type: event.type,
          status: 'ignored',
          createdAt: FieldValue.serverTimestamp(),
          livemode: event.livemode,
        });
        return { duplicate: false, status: 'ignored' as const };
      }

      const session = object;
      if (!isVerifiedPaidCheckout(session)) {
        throw new Error('CHECKOUT_NOT_PAID_OR_INVALID');
      }

      const userId = session.metadata?.userId;
      const clips = Number(session.metadata?.clips);
      if (!userId || userId !== session.client_reference_id || userId === 'streamer_guest') {
        throw new Error('CHECKOUT_USER_MISMATCH');
      }

      // Recompute expected amount server-side and do not trust client metadata amounts.
      const pricing = calculateDynamicClipPrice(clips);
      if (session.amount_total !== pricing.totalPriceCents || session.currency !== 'eur') {
        throw new Error('CHECKOUT_AMOUNT_MISMATCH');
      }

      const userRef = db.collection('users').doc(userId);
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) throw new Error('CHECKOUT_USER_NOT_FOUND');

      const invoiceRef = userRef.collection('invoices').doc(`stripe_${session.id}`);
      const invoiceSnapshot = await transaction.get(invoiceRef);
      if (invoiceSnapshot.exists) {
        transaction.create(eventRef, {
          type: event.type,
          status: 'duplicate_invoice',
          createdAt: FieldValue.serverTimestamp(),
          livemode: event.livemode,
        });
        return { duplicate: true, status: 'duplicate' as const };
      }

      transaction.set(userRef, {
        hasActiveSubscription: true,
        subscriptionStatus: 'active',
        subscriptionPlan: 'dynamic',
        clipBalance: FieldValue.increment(clips),
        clipsLimitTotal: FieldValue.increment(clips),
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      transaction.create(invoiceRef, {
        id: invoiceRef.id,
        userId,
        stripeCheckoutSessionId: session.id,
        amountCents: session.amount_total,
        currency: session.currency,
        planName: `${clips.toLocaleString('de-DE')} Clips (Regler-Abrechnung)`,
        status: 'paid',
        createdAt: FieldValue.serverTimestamp(),
      });

      transaction.create(eventRef, {
        type: event.type,
        status: 'processed',
        userId,
        checkoutSessionId: session.id,
        clipCount: clips,
        createdAt: FieldValue.serverTimestamp(),
        livemode: event.livemode,
      });

      return { duplicate: false, status: 'processed' as const };
    });

    if (result.status === 'processed') {
      const session = object;
      const userId = session.metadata!.userId!;
      try {
        const authUser = await getAuth().getUser(userId);
        await getAuth().setCustomUserClaims(userId, {
          ...(authUser.customClaims || {}),
          subscribed: true,
          hasActiveSubscription: true,
          tier: 'dynamic',
        });
      } catch (error) {
        // Firestore credit/invoice is authoritative; claim sync can be retried separately.
        console.error('[Stripe Webhook] Credit committed; auth claim sync failed.');
      }
    }

    recordStripeEvent({
      id: event.id,
      type: event.type,
      createdAt: new Date().toISOString(),
      livemode: event.livemode,
      objectId: object.id,
      objectType: object.object,
      details: result.status,
      status: result.status === 'processed' ? 'processed' : result.status === 'duplicate' ? 'warning' : 'acknowledged',
    });

    return res.status(200).json({ received: true, eventId: event.id, status: result.status });
  } catch (error) {
    console.error('[Stripe Webhook] Event processing failed:', error);
    return res.status(400).json({ error: 'Stripe-Event konnte nicht verarbeitet werden.' });
  }
});

stripeRouter.get(['/webhook/events', '/events'], stripeRouteRateLimit(30, 60_000), requireAuth, async (req, res) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Adminrechte erforderlich.' });
  }
  try {
    const snapshot = await stripeEvents.orderBy('createdAt', 'desc').limit(50).get();
    return res.json({ status: 'ok', events: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
  } catch (error) {
    console.error('[Stripe Webhook] Failed to load event audit.', error);
    return res.status(500).json({ error: 'Webhook-Audit konnte nicht geladen werden.' });
  }
});
