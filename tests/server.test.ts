import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import app from '../server.ts';

const canonicalDatabaseId = 'ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91';
const server = app.listen(0, '127.0.0.1');
let baseUrl = '';

test.before(async () => {
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address() as AddressInfo;
  baseUrl = 'http://127.0.0.1:' + address.port;
});

test.after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

test('health endpoint reports a healthy v7 service', async () => {
  const response = await fetch(baseUrl + '/health');
  assert.equal(response.status, 200);
  const payload = await response.json() as { status?: string; version?: string };
  assert.equal(payload.status, 'healthy');
  assert.equal(payload.version, '7.0.0');
});

test('public configuration advertises the canonical Firestore database ID', async () => {
  const response = await fetch(baseUrl + '/config/public');
  assert.equal(response.status, 200);
  const payload = await response.json() as { endpoints?: { databaseId?: string } };
  assert.equal(payload.endpoints?.databaseId, canonicalDatabaseId);
});

test('Gemini endpoint rejects unauthenticated requests before inference', async () => {
  const response = await fetch(baseUrl + '/api/gemini', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: 'health check only' }),
  });
  assert.equal(response.status, 401);
});

test('billing top-up rejects unauthenticated requests', async () => {
  const response = await fetch(baseUrl + '/api/billing/topup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ addedClips: 1, paymentToken: 'test-token' }),
  });
  assert.equal(response.status, 401);
});
