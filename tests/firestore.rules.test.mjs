import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-quickclick-beta',
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test('an authenticated owner can create a non-privileged profile', async () => {
  const db = testEnv.authenticatedContext('user-safe').firestore();
  await assertSucceeds(setDoc(doc(db, 'users', 'user-safe'), {
    uid: 'user-safe',
    email: 'safe@example.com',
    displayName: 'Safe User',
    role: 'streamer',
    isAdmin: false,
    isTitanVip: false,
    hasActiveSubscription: false,
    plan: 'none',
    clipsLimitTotal: 0,
    apiCallsLimit: 0,
  }));
});

test('a client cannot create an administrator or self-grant an active subscription', async () => {
  const attacks = [
    { role: 'admin' },
    { isAdmin: true },
    { isTitanVip: true },
    { hasActiveSubscription: true },
    { subscribed: true },
    { subscriptionPlan: 'pro' },
    { plan: 'elite' },
    { clipsLimitTotal: 20000 },
    { stripeCustomerId: 'cus_untrusted' },
  ];

  for (let index = 0; index < attacks.length; index += 1) {
    const userId = 'attacker-' + index;
    const db = testEnv.authenticatedContext(userId).firestore();
    await assertFails(setDoc(doc(db, 'users', userId), {
      uid: userId,
      email: userId + '@example.com',
      role: 'streamer',
      isAdmin: false,
      isTitanVip: false,
      hasActiveSubscription: false,
      plan: 'none',
      clipsLimitTotal: 0,
      apiCallsLimit: 0,
      ...attacks[index],
    }));
  }
});

test('a client cannot change protected subscription fields after profile creation', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', 'existing-user'), {
      uid: 'existing-user',
      email: 'existing@example.com',
      role: 'streamer',
      isAdmin: false,
      hasActiveSubscription: false,
      subscriptionStatus: 'inactive',
      subscriptionPlan: 'free',
    });
  });

  const db = testEnv.authenticatedContext('existing-user').firestore();
  await assertFails(updateDoc(doc(db, 'users', 'existing-user'), {
    hasActiveSubscription: true,
    subscriptionStatus: 'active',
    subscriptionPlan: 'pro',
  }));
});

test('users cannot read another user profile or write billing/wallet records', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users', 'owner-one'), {
      uid: 'owner-one',
      email: 'one@example.com',
    });
  });

  const otherDb = testEnv.authenticatedContext('owner-two').firestore();
  await assertFails(getDoc(doc(otherDb, 'users', 'owner-one')));
  await assertFails(setDoc(doc(otherDb, 'users', 'owner-two', 'wallet', 'balance'), {
    balance: 999999,
  }));
  await assertFails(setDoc(doc(otherDb, 'users', 'owner-two', 'invoices', 'fake-invoice'), {
    amountCents: 0,
    status: 'paid',
  }));
});
