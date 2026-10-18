import type { Request, Response } from 'express';
import express from 'express';
import crypto from 'node:crypto';

/**
 * Installs JSON parsing with exact raw-body capture for Stripe and Twitch webhooks.
 * Use this helper from the main server entry point before registering route handlers.
 */
export function createRateLimiter(
  maxOrOptions: number | { windowMs?: number; max?: number; message?: string } = 60,
  positionalWindowMs = 60_000
) {
  const options = typeof maxOrOptions === 'number'
    ? { max: maxOrOptions, windowMs: positionalWindowMs }
    : maxOrOptions;
  const windowMs = Math.max(1_000, options.windowMs ?? 60_000);
  const max = Math.max(1, options.max ?? 60);
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: (error?: unknown) => void) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) {
      res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
      res.status(429).json({ error: options.message || 'Too many requests' });
      return;
    }
    // Opportunistically prune expired buckets to avoid unbounded growth.
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    next();
  };
}

export function verifyTotpRFC6238(code: string, secret: string, window = 1): boolean {
  if (!/^\d{6}$/.test(code) || !secret) return false;

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = secret.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const char of normalized) {
    const value = alphabet.indexOf(char);
    if (value < 0) return false;
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const key = Buffer.from(bytes);
  if (key.length === 0) return false;

  const counter = Math.floor(Date.now() / 1000 / 30);
  const safeWindow = Math.max(0, Math.min(10, Math.trunc(window)));
  const supplied = Buffer.from(code);
  for (let delta = -safeWindow; delta <= safeWindow; delta += 1) {
    const value = counter + delta;
    if (value < 0) continue;
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(value));
    const digest = crypto.createHmac('sha1', key).update(message).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    const expected = Buffer.from(String(binary % 1_000_000).padStart(6, '0'));
    if (supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected)) return true;
  }
  return false;
}

export function sanitizeForSpreadsheet(value: unknown): string {
  const text = value == null ? '' : String(value);
  // Neutralize spreadsheet formulas when untrusted input is exported to Sheets/CSV.
  return /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text;
}

export function installRawBodyParser(app: express.Express): void {
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: Request, _res: Response, buf: Buffer) => {
        const requestPath = req.originalUrl || req.url;
        const rawBodyPaths = [
          '/api/stripe/webhook',
          '/api/webhooks/stripe',
          '/api/webhooks/twitch',
          '/api/twitch/webhook',
          '/api/twitch/eventsub',
        ];
        if (rawBodyPaths.some((candidate) => requestPath.startsWith(candidate))) {
          (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
        }
      },
    })
  );
}
