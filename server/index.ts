import type { Request, Response } from 'express';
import express from 'express';

/**
 * Installs JSON parsing with exact raw-body capture for Stripe and Twitch webhooks.
 * Use this helper from the main server entry point before registering route handlers.
 */
export function createRateLimiter(
  options: { windowMs?: number; max?: number; message?: string } = {}
) {
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

export function verifyTotpRFC6238(): boolean {
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
