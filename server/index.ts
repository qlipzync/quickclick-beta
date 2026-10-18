  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res, buf) => {
        if (!req.originalUrl) return;

        // Capture rawBody for known webhook endpoints and aliases so signature verification can use the exact request bytes.
        const rawBodyPaths = [
          '/api/stripe/webhook',
          '/api/webhooks/stripe',
          '/api/webhooks/twitch',
          '/api/twitch/webhook',
          '/api/twitch/eventsub',
        ];

        for (const p of rawBodyPaths) {
          if (req.originalUrl.startsWith(p)) {
            req.rawBody = buf;
            break;
          }
        }
      },
    })
  );
