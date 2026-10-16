import { Router } from 'express';
import Stripe from 'stripe';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export const stripeRouter = Router();

const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || 'qlipzync-prod';
const db = getFirestore(FIRESTORE_DB_ID);

let stripeClient: Stripe | null = null;
export function getStripe(): Stripe | null {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

// Dynamische Preisformel für den Regler (1 bis 20.000 Clips)
export function calculateDynamicClipPrice(clipsInput: number) {
  const clips = Math.max(1, Math.min(20000, Math.floor(Number(clipsInput) || 1)));
  // Logarithmische Preisskalierung: 0,50 € (1 Clip) bis 0,05 € (20.000 Clips)
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
const processedWebhookIds = new Set<string>();

export function recordStripeEvent(log: StripeWebhookLog) {
  recentStripeEvents.unshift(log);
  if (recentStripeEvents.length > 50) {
    recentStripeEvents.pop();
  }
}

// -------------------------------------------------------------------------
// GET /api/stripe/products - Liefert ausschließlich die Schieberegler-Konfiguration
// -------------------------------------------------------------------------
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

// -------------------------------------------------------------------------
// POST /api/stripe/checkout - Erstellt Stripe Checkout Session basierend auf Clipanzahl
// -------------------------------------------------------------------------
stripeRouter.post(['/checkout', '/create-checkout-session'], async (req, res) => {
  try {
    const { userId, userEmail, clips, returnUrl } = req.body;

    const requestedClips = Number(clips);
    if (isNaN(requestedClips) || requestedClips < 1 || requestedClips > 20000) {
      return res.status(400).json({
        error: 'Ungültige Clipanzahl übermittelt. Erlaubt: 1 bis 20.000 Clips.',
      });
    }

    const priceCalc = calculateDynamicClipPrice(requestedClips);
    const stripe = getStripe();

    if (!stripe) {
      return res.status(500).json({
        error: 'STRIPE_SECRET_KEY ist nicht konfiguriert.',
      });
    }

    const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: userEmail || undefined,
      client_reference_id: userId || 'streamer_guest',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `QuickClick: ${priceCalc.clips.toLocaleString('de-DE')} Clips Paket`,
              description: `Autonome Zero-Storage Clip-Verarbeitung (${priceCalc.unitPriceEur.toFixed(3)} € pro Clip mit ${priceCalc.discountPercent}% Mengenrabatt)`,
            },
            unit_amount: priceCalc.totalPriceCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId || 'streamer_guest',
        userEmail: userEmail || '',
        pricingModel: 'dynamic_slider',
        clips: String(priceCalc.clips),
        unitPriceEur: String(priceCalc.unitPriceEur),
        totalPriceEur: String(priceCalc.totalPriceEur),
      },
      success_url: `${returnUrl || appBaseUrl}/?session_id={CHECKOUT_SESSION_ID}&payment=success&clips=${priceCalc.clips}`,
      cancel_url: `${returnUrl || appBaseUrl}/?payment=cancelled`,
    });

    return res.json({
      sessionId: session.id,
      url: session.url,
      clips: priceCalc.clips,
      unitPriceEur: priceCalc.unitPriceEur,
      totalPriceEur: priceCalc.totalPriceEur,
    });
  } catch (err: any) {
    console.error('[Stripe Checkout Error]', err);
    return res.status(500).json({ error: err.message || 'Fehler beim Erstellen der Checkout-Session' });
  }
});

// -------------------------------------------------------------------------
// POST /api/stripe/webhook - Schreibt gekaufte Clips direkt ins Nutzerkonto
// -------------------------------------------------------------------------
stripeRouter.post(['/webhook', '/'], async (req: any, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();
  let event: any;

  if (stripe && webhookSecret && sig && req.rawBody) {
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error('Stripe Webhook Signaturprüfung fehlgeschlagen:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    event = req.body;
  }

  if (!event?.type) {
    return res.status(400).json({ error: 'Kein gültiges Event übermittelt' });
  }

  const { type, id: eventId } = event;
  const dataObj = event.data?.object || {};

  if (eventId && processedWebhookIds.has(`stripe_${eventId}`)) {
    return res.status(200).json({ received: true, note: 'Duplicate event ignored' });
  }
  processedWebhookIds.add(`stripe_${eventId}`);

  let logDetails = `Event '${type}' empfangen`;
  let logStatus: 'acknowledged' | 'processed' = 'acknowledged';

  if (type === 'checkout.session.completed') {
    const userId = dataObj.metadata?.userId;
    const addedClips = Number(dataObj.metadata?.clips || 0);

    if (userId && userId !== 'streamer_guest' && addedClips > 0) {
      const userRef = db.collection('users').doc(userId);

      await userRef.set(
        {
          hasActiveSubscription: true,
          subscriptionStatus: 'active',
          subscriptionPlan: 'dynamic',
          clipBalance: FieldValue.increment(addedClips),
          clipsLimitTotal: FieldValue.increment(addedClips),
          stripeCustomerId: dataObj.customer || undefined,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      try {
        await getAuth().setCustomUserClaims(userId, {
          subscribed: true,
          hasActiveSubscription: true,
          tier: 'dynamic',
        });
      } catch (claimsErr: any) {
        console.warn('[Stripe Webhook Claims Error]', claimsErr.message);
      }

      const invoiceId = `inv_${dataObj.id || Date.now()}`;
      await userRef.collection('invoices').doc(invoiceId).set({
        id: invoiceId,
        userId,
        stripeInvoiceId: dataObj.id,
        amountCents: dataObj.amount_total || 0,
        currency: dataObj.currency || 'eur',
        planName: `${addedClips.toLocaleString('de-DE')} Clips (Regler-Abrechnung)`,
        status: 'paid',
        createdAt: FieldValue.serverTimestamp(),
      });

      logDetails = `${addedClips} Clips erfolgreich für UID ${userId} gutgeschrieben.`;
      logStatus = 'processed';
    }
  }

  recordStripeEvent({
    id: eventId || `evt_${Date.now()}`,
    type,
    createdAt: new Date().toISOString(),
    livemode: Boolean(event.livemode),
    details: logDetails,
    status: logStatus,
  });

  return res.status(200).json({ received: true, eventId, status: logStatus });
});

stripeRouter.get(['/webhook/events', '/events'], (_req, res) => {
  res.json({
    status: 'ok',
    totalCount: recentStripeEvents.length,
    events: recentStripeEvents,
  });
});
