import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDynamicClipPrice, getStripe } from '../server/routes/stripe.js';

test('dynamic pricing clamps and rounds clip requests deterministically', () => {
  assert.equal(calculateDynamicClipPrice(1).clips, 1);
  assert.equal(calculateDynamicClipPrice(20000).clips, 20000);
  assert.equal(calculateDynamicClipPrice(90000).clips, 20000);
  assert.equal(calculateDynamicClipPrice(0).clips, 1);
  assert.ok(calculateDynamicClipPrice(500).totalPriceCents > 0);
});

test('Stripe webhook handler is present without requiring secrets at module import', () => {
  // Configuration is supplied at runtime; missing keys must not make a webhook payload trusted.
  assert.equal(typeof getStripe, 'function');
});

test('source-level security guard: checkout requires verified identity', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../server/routes/stripe.ts', import.meta.url), 'utf8');
  assert.match(source, /post\(\['\/checkout', '\/create-checkout-session'\], stripeRouteRateLimit\(10, 60_000\), requireAuth/);
  assert.match(source, /const userId = req\.user\?\.uid/);
  assert.doesNotMatch(source, /event = req\.body/);
  assert.match(source, /constructEvent\(\(req as any\)\.rawBody, signature, webhookSecret\)/);
  assert.match(source, /runTransaction\(async \(transaction\)/);
  assert.match(source, /payment_status === 'paid'/);
  assert.match(source, /session\.amount_total !== pricing\.totalPriceCents/);
});

