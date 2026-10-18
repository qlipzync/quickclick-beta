import app, { startServer } from '../server.js';
import { unifiedAuth } from '../server/middleware/unifiedAuth.middleware.js';
import { requireSubscription } from '../server/middleware/subscription.middleware.js';
import { apiKeyRouter } from '../server/routes/apiKey.routes.js';

export { unifiedAuth, requireSubscription, apiKeyRouter, startServer, app };
export default app;
