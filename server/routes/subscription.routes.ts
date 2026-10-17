import { Router } from 'express';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { verifyAuth } from '../middleware/authMiddleware.js';

export const subscriptionRouter = Router();

const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || 'ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91';
const db = getFirestore(FIRESTORE_DB_ID);

let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

// 1. Subscription-Status für UI prüfen
subscriptionRouter.get('/status', verifyAuth, async (req: Request, res: Response): Promise<void> => {
  const uid = req.user!.uid;

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const data = userDoc.data();

    const isSubscribed = Boolean(
      req.user?.subscribed ||
      req.user?.hasActiveSubscription ||
      req.user?.isAdmin ||
      (data?.hasActiveSubscription === true && data?.subscriptionStatus === 'active')
    );

    const tier = req.user?.subscriptionTier || req.user?.subscriptionPlan || data?.subscriptionPlan || 'free';

    res.status(200).json({
      isSubscribed,
      tier,
      currentPeriodEnd: data?.subscriptionCurrentPeriodEnd || null,
      cancelAtPeriodEnd: data?.cancelAtPeriodEnd || false,
    });
  } catch (error: any) {
    console.error('[SubscriptionRoutes] Status error:', error?.message);
    res.status(500).json({ error: 'STATUS_FAILED', message: 'Abo-Status konnte nicht abgerufen werden.' });
  }
});

// 2. Stripe Checkout Session erstellen
subscriptionRouter.post('/checkout', verifyAuth, async (req: Request, res: Response): Promise<void> => {
  const uid = req.user!.uid;
  const email = req.user!.email;
  const { priceId, successUrl, cancelUrl } = req.body || {};

  if (!priceId || !successUrl || !cancelUrl) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'priceId, successUrl und cancelUrl erforderlich.' });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    // Falls kein Stripe Secret Key konfiguriert ist, saubere Rückmeldung
    res.status(503).json({
      error: 'STRIPE_NOT_CONFIGURED',
      message: 'Zahlungs-Gateway ist serverseitig nicht konfiguriert (STRIPE_SECRET_KEY fehlt).',
    });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      client_reference_id: uid,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: uid },
    });

    res.status(200).json({ checkoutUrl: session.url });
  } catch (error: any) {
    console.error('[SubscriptionRoutes] Checkout error:', error?.message);
    res.status(500).json({ error: 'CHECKOUT_FAILED', message: error?.message || 'Checkout-Session konnte nicht erstellt werden.' });
  }
});

// 3. Stripe subscription webhook. Raw bytes and a valid signature are mandatory.
const subscriptionWebhookEvents = db.collection('_stripeSubscriptionWebhookEvents');

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!stripe || !webhookSecret || typeof signature !== 'string' || !Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    res.status(503).json({ error: 'STRIPE_WEBHOOK_NOT_CONFIGURED' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    res.status(400).json({ error: 'INVALID_STRIPE_SIGNATURE' });
    return;
  }

  const eventRef = subscriptionWebhookEvents.doc(event.id);
  try {
    const claim = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(eventRef);
      if (snapshot.exists && snapshot.data()?.status === 'processed') return 'duplicate' as const;
      if (snapshot.exists && snapshot.data()?.status === 'processing') return 'processing' as const;
      transaction.set(eventRef, {
        type: event.type,
        status: 'processing',
        attempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
        livemode: event.livemode,
      }, { merge: true });
      return 'claimed' as const;
    });

    if (claim === 'duplicate') {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }
    if (claim === 'processing') {
      res.status(409).json({ error: 'STRIPE_EVENT_PROCESSING' });
      return;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          if (
            session.mode !== 'subscription' ||
            session.status !== 'complete' ||
            !['paid', 'no_payment_required'].includes(session.payment_status)
          ) {
            throw new Error('SUBSCRIPTION_CHECKOUT_NOT_PAID');
          }

          const uid = session.client_reference_id;
          if (!uid || !session.metadata?.userId || session.metadata.userId !== uid) {
            throw new Error('SUBSCRIPTION_CHECKOUT_USER_MISMATCH');
          }

          await getAuth().setCustomUserClaims(uid, {
            subscribed: true,
            hasActiveSubscription: true,
            subscriptionTier: 'pro',
            tier: 'pro',
          });

          await db.collection('users').doc(uid).set({
            hasActiveSubscription: true,
            subscriptionStatus: 'active',
            subscriptionPlan: 'pro',
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
            stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const snapshot = await db.collection('users')
            .where('stripeSubscriptionId', '==', subscription.id)
            .limit(1)
            .get();

          if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const uid = userDoc.id;
            const authUser = await getAuth().getUser(uid);
            await getAuth().setCustomUserClaims(uid, {
              ...(authUser.customClaims || {}),
              subscribed: false,
              hasActiveSubscription: false,
              subscriptionTier: 'free',
              tier: 'free',
            });
            await userDoc.ref.update({
              hasActiveSubscription: false,
              subscriptionStatus: 'canceled',
              subscriptionPlan: 'free',
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
          break;
        }

        default:
          // Acknowledge irrelevant, but validly signed events without side effects.
          break;
      }

      await eventRef.set({
        type: event.type,
        status: 'processed',
        processedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      res.status(200).json({ received: true });
    } catch (processingError) {
      await eventRef.set({
        status: 'error',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      console.error('[Subscription Webhook Processing Error]', processingError);
      res.status(500).json({ error: 'WEBHOOK_PROCESSING_FAILED' });
    }
  } catch (error) {
    console.error('[Subscription Webhook Idempotency Error]', error);
    res.status(500).json({ error: 'WEBHOOK_PROCESSING_FAILED' });
  }
}
