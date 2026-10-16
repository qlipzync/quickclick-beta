import { Router } from 'express';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { verifyAuth } from '../middleware/authMiddleware.js';

export const subscriptionRouter = Router();

const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || 'qlipzync-prod';
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

// 3. Stripe Webhook: Setzt serverseitig das Custom Claim via Firebase Admin SDK
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: 'Stripe nicht konfiguriert' });
    return;
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    const rawBody = (req as any).rawBody || req.body;
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
  } catch (err: any) {
    console.error('[Subscription Webhook Error]:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.client_reference_id || session.metadata?.userId;

        if (uid) {
          // Custom Claim setzen -> Berechtigt sofort alle Routen mit requireSubscription
          await getAuth().setCustomUserClaims(uid, {
            subscribed: true,
            hasActiveSubscription: true,
            subscriptionTier: 'pro',
            tier: 'pro',
          });

          await db.collection('users').doc(uid).set(
            {
              hasActiveSubscription: true,
              subscriptionStatus: 'active',
              subscriptionPlan: 'pro',
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          console.log(`[Stripe Webhook] Custom Claims & Firestore updated for User ${uid}: subscribed=true`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const snapshot = await db
          .collection('users')
          .where('stripeSubscriptionId', '==', subscription.id)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          const uid = userDoc.id;

          // Custom Claim entziehen
          await getAuth().setCustomUserClaims(uid, {
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
          console.log(`[Stripe Webhook] Subscription canceled for User ${uid}: subscribed=false`);
        }
        break;
      }
    }

    res.status(200).json({ received: true });
  } catch (procErr: any) {
    console.error('[Subscription Webhook Processing Error]:', procErr);
    res.status(500).json({ error: 'WEBHOOK_PROCESSING_FAILED' });
  }
}
