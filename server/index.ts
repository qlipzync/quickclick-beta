import type { Request, Response } from 'express';
import express from 'express';

/**
 * Installs JSON parsing with exact raw-body capture for Stripe and Twitch webhooks.
 * Use this helper from the main server entry point before registering route handlers.
 */
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
