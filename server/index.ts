import type { Request, Response } from 'express';
import express from 'express';

/**
 * Registers JSON parsing with raw-body capture for signed webhook endpoints.
 * Import this middleware from server.ts so all signature checks see the exact bytes.
 */
export function installRawBodyParser(app: express.Express): void {
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: Request, _res: Response, buf: Buffer) => {
        const path = req.originalUrl || req.url;
        const rawBodyPaths = [
          '/api/stripe/webhook',
          '/api/webhooks/stripe',
          '/api/webhooks/twitch',
          '/api/twitch/webhook',
          '/api/twitch/eventsub',
        ];
        if (rawBodyPaths.some((candidate) => path.startsWith(candidate))) {
          (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
        }
      },
    })
  );
}
