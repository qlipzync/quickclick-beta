import { Router } from "express";
import Stripe from "stripe";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
const stripeRouter = Router();
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "qlipzync-prod";
const db = getFirestore(FIRESTORE_DB_ID);
let stripeClient = null;
function getStripe() {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}
function calculateDynamicClipPrice(clipsInput) {
  const clips = Math.max(1, Math.min(2e4, Math.floor(Number(clipsInput) || 1)));
  const logFactor = 1 - Math.log(clips) / Math.log(2e4);
  const unitPrice = Math.max(0.05, 0.05 + (0.5 - 0.05) * logFactor);
  const totalPrice = Number((clips * unitPrice).toFixed(2));
  const discountPercent = Math.round((1 - unitPrice / 0.5) * 100);
  return {
    clips,
    unitPriceEur: Number(unitPrice.toFixed(4)),
    totalPriceEur: totalPrice,
    totalPriceCents: Math.round(totalPrice * 100),
    discountPercent
  };
}
const recentStripeEvents = [];
const processedWebhookIds = /* @__PURE__ */ new Set();
function recordStripeEvent(log) {
  recentStripeEvents.unshift(log);
  if (recentStripeEvents.length > 50) {
    recentStripeEvents.pop();
  }
}
stripeRouter.get("/products", (_req, res) => {
  return res.json({
    status: "ok",
    currency: "EUR",
    pricingModel: "dynamic_slider",
    slider: {
      minClips: 1,
      maxClips: 2e4,
      baseUnitPriceEur: 0.5,
      minUnitPriceEur: 0.05,
      formula: "logarithmic_tier_discount",
      defaultClips: 100
    }
  });
});
stripeRouter.post(["/checkout", "/create-checkout-session"], async (req, res) => {
  try {
    const { userId, userEmail, clips, returnUrl } = req.body;
    const requestedClips = Number(clips);
    if (isNaN(requestedClips) || requestedClips < 1 || requestedClips > 2e4) {
      return res.status(400).json({
        error: "Ung\xFCltige Clipanzahl \xFCbermittelt. Erlaubt: 1 bis 20.000 Clips."
      });
    }
    const priceCalc = calculateDynamicClipPrice(requestedClips);
    const stripe = getStripe();
    if (!stripe) {
      return res.status(500).json({
        error: "STRIPE_SECRET_KEY ist nicht konfiguriert."
      });
    }
    const appBaseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: userEmail || void 0,
      client_reference_id: userId || "streamer_guest",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `QuickClick: ${priceCalc.clips.toLocaleString("de-DE")} Clips Paket`,
              description: `Autonome Zero-Storage Clip-Verarbeitung (${priceCalc.unitPriceEur.toFixed(3)} \u20AC pro Clip mit ${priceCalc.discountPercent}% Mengenrabatt)`
            },
            unit_amount: priceCalc.totalPriceCents
          },
          quantity: 1
        }
      ],
      metadata: {
        userId: userId || "streamer_guest",
        userEmail: userEmail || "",
        pricingModel: "dynamic_slider",
        clips: String(priceCalc.clips),
        unitPriceEur: String(priceCalc.unitPriceEur),
        totalPriceEur: String(priceCalc.totalPriceEur)
      },
      success_url: `${returnUrl || appBaseUrl}/?session_id={CHECKOUT_SESSION_ID}&payment=success&clips=${priceCalc.clips}`,
      cancel_url: `${returnUrl || appBaseUrl}/?payment=cancelled`
    });
    return res.json({
      sessionId: session.id,
      url: session.url,
      clips: priceCalc.clips,
      unitPriceEur: priceCalc.unitPriceEur,
      totalPriceEur: priceCalc.totalPriceEur
    });
  } catch (err) {
    console.error("[Stripe Checkout Error]", err);
    return res.status(500).json({ error: err.message || "Fehler beim Erstellen der Checkout-Session" });
  }
});
stripeRouter.post(["/webhook", "/"], async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();
  let event;
  if (stripe && webhookSecret && sig && req.rawBody) {
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("Stripe Webhook Signaturpr\xFCfung fehlgeschlagen:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    event = req.body;
  }
  if (!event?.type) {
    return res.status(400).json({ error: "Kein g\xFCltiges Event \xFCbermittelt" });
  }
  const { type, id: eventId } = event;
  const dataObj = event.data?.object || {};
  if (eventId && processedWebhookIds.has(`stripe_${eventId}`)) {
    return res.status(200).json({ received: true, note: "Duplicate event ignored" });
  }
  processedWebhookIds.add(`stripe_${eventId}`);
  let logDetails = `Event '${type}' empfangen`;
  let logStatus = "acknowledged";
  if (type === "checkout.session.completed") {
    const userId = dataObj.metadata?.userId;
    const addedClips = Number(dataObj.metadata?.clips || 0);
    if (userId && userId !== "streamer_guest" && addedClips > 0) {
      const userRef = db.collection("users").doc(userId);
      await userRef.set(
        {
          hasActiveSubscription: true,
          subscriptionStatus: "active",
          subscriptionPlan: "dynamic",
          clipBalance: FieldValue.increment(addedClips),
          clipsLimitTotal: FieldValue.increment(addedClips),
          stripeCustomerId: dataObj.customer || void 0,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      try {
        await getAuth().setCustomUserClaims(userId, {
          subscribed: true,
          hasActiveSubscription: true,
          tier: "dynamic"
        });
      } catch (claimsErr) {
        console.warn("[Stripe Webhook Claims Error]", claimsErr.message);
      }
      const invoiceId = `inv_${dataObj.id || Date.now()}`;
      await userRef.collection("invoices").doc(invoiceId).set({
        id: invoiceId,
        userId,
        stripeInvoiceId: dataObj.id,
        amountCents: dataObj.amount_total || 0,
        currency: dataObj.currency || "eur",
        planName: `${addedClips.toLocaleString("de-DE")} Clips (Regler-Abrechnung)`,
        status: "paid",
        createdAt: FieldValue.serverTimestamp()
      });
      logDetails = `${addedClips} Clips erfolgreich f\xFCr UID ${userId} gutgeschrieben.`;
      logStatus = "processed";
    }
  }
  recordStripeEvent({
    id: eventId || `evt_${Date.now()}`,
    type,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    livemode: Boolean(event.livemode),
    details: logDetails,
    status: logStatus
  });
  return res.status(200).json({ received: true, eventId, status: logStatus });
});
stripeRouter.get(["/webhook/events", "/events"], (_req, res) => {
  res.json({
    status: "ok",
    totalCount: recentStripeEvents.length,
    events: recentStripeEvents
  });
});
export {
  calculateDynamicClipPrice,
  getStripe,
  recordStripeEvent,
  stripeRouter
};
