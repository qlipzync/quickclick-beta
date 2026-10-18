import { Router } from "express";
import Stripe from "stripe";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { verifyAuth } from "../middleware/authMiddleware.js";
const subscriptionRouter = Router();
const FIRESTORE_DB_ID = process.env.FIRESTORE_DB || "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91";
const db = getFirestore(FIRESTORE_DB_ID);
let stripeClient = null;
function getStripe() {
  if (!stripeClient && process.env.STRIPE_SECRET_KEY) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}
const processedSubscriptionEvents = /* @__PURE__ */ new Set();
subscriptionRouter.get("/status", verifyAuth, async (req, res) => {
  const uid = req.user.uid;
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    const data = userDoc.data();
    const isSubscribed = Boolean(
      req.user?.subscribed || req.user?.hasActiveSubscription || req.user?.isAdmin || data?.hasActiveSubscription === true && data?.subscriptionStatus === "active"
    );
    const tier = req.user?.subscriptionTier || req.user?.subscriptionPlan || data?.subscriptionPlan || "free";
    res.status(200).json({
      isSubscribed,
      tier,
      currentPeriodEnd: data?.subscriptionCurrentPeriodEnd || null,
      cancelAtPeriodEnd: data?.cancelAtPeriodEnd || false
    });
  } catch (error) {
    console.error("[SubscriptionRoutes] Status error:", error?.message);
    res.status(500).json({ error: "STATUS_FAILED", message: "Abo-Status konnte nicht abgerufen werden." });
  }
});
subscriptionRouter.post("/checkout", verifyAuth, async (req, res) => {
  const uid = req.user.uid;
  const email = req.user.email;
  const { priceId, successUrl, cancelUrl } = req.body || {};
  if (!priceId || !successUrl || !cancelUrl) {
    res.status(400).json({ error: "BAD_REQUEST", message: "priceId, successUrl und cancelUrl erforderlich." });
    return;
  }
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({
      error: "STRIPE_NOT_CONFIGURED",
      message: "Zahlungs-Gateway ist serverseitig nicht konfiguriert (STRIPE_SECRET_KEY fehlt)."
    });
    return;
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      client_reference_id: uid,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: uid }
    });
    res.status(200).json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("[SubscriptionRoutes] Checkout error:", error?.message);
    res.status(500).json({ error: "CHECKOUT_FAILED", message: error?.message || "Checkout-Session konnte nicht erstellt werden." });
  }
});
async function handleStripeWebhook(req, res) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    res.status(503).json({
      error: "STRIPE_WEBHOOK_NOT_CONFIGURED",
      message: "STRIPE_SECRET_KEY oder STRIPE_WEBHOOK_SECRET fehlt serverseitig."
    });
    return;
  }
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).json({ error: "MISSING_STRIPE_SIGNATURE", message: "stripe-signature Header fehlt." });
    return;
  }
  const rawBody = req.rawBody;
  if (!rawBody || !(Buffer.isBuffer(rawBody) || typeof rawBody === "string")) {
    res.status(400).json({ error: "MISSING_RAW_BODY", message: "Raw-Body f\xFCr Signaturpr\xFCfung erforderlich." });
    return;
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[Subscription Webhook Error]:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }
  if (processedSubscriptionEvents.has(event.id)) {
    res.status(200).json({ received: true, idempotent: true });
    return;
  }
  const eventDocRef = db.collection("stripe_webhook_events").doc(event.id);
  try {
    const snap = await eventDocRef.get();
    if (snap.exists) {
      processedSubscriptionEvents.add(event.id);
      res.status(200).json({ received: true, idempotent: true });
      return;
    }
    await eventDocRef.set({
      eventId: event.id,
      type: event.type,
      livemode: Boolean(event.livemode),
      status: "processing",
      receivedAt: FieldValue.serverTimestamp()
    });
    processedSubscriptionEvents.add(event.id);
  } catch (idempErr) {
    console.error("[Subscription Webhook Idempotency Error]:", idempErr.message);
    res.status(500).json({ error: "IDEMPOTENCY_CHECK_FAILED" });
    return;
  }
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const uid = session.client_reference_id || session.metadata?.userId;
        if (uid) {
          await getAuth().setCustomUserClaims(uid, {
            subscribed: true,
            hasActiveSubscription: true,
            subscriptionTier: "pro",
            tier: "pro"
          });
          await db.collection("users").doc(uid).set(
            {
              hasActiveSubscription: true,
              subscriptionStatus: "active",
              subscriptionPlan: "pro",
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              updatedAt: FieldValue.serverTimestamp()
            },
            { merge: true }
          );
          console.log(`[Stripe Webhook] Custom Claims & Firestore updated for User ${uid}: subscribed=true`);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const snapshot = await db.collection("users").where("stripeSubscriptionId", "==", subscription.id).limit(1).get();
        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0];
          const uid = userDoc.id;
          await getAuth().setCustomUserClaims(uid, {
            subscribed: false,
            hasActiveSubscription: false,
            subscriptionTier: "free",
            tier: "free"
          });
          await userDoc.ref.update({
            hasActiveSubscription: false,
            subscriptionStatus: "canceled",
            subscriptionPlan: "free",
            updatedAt: FieldValue.serverTimestamp()
          });
          console.log(`[Stripe Webhook] Subscription canceled for User ${uid}: subscribed=false`);
        }
        break;
      }
    }
    await eventDocRef.set(
      {
        status: "processed",
        processedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    res.status(200).json({ received: true, eventId: event.id });
  } catch (procErr) {
    console.error("[Subscription Webhook Processing Error]:", procErr);
    processedSubscriptionEvents.delete(event.id);
    await eventDocRef.set(
      {
        status: "error",
        error: procErr?.message || "Processing failed"
      },
      { merge: true }
    );
    res.status(500).json({ error: "WEBHOOK_PROCESSING_FAILED" });
  }
}
export {
  handleStripeWebhook,
  subscriptionRouter
};
