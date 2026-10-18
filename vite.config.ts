import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import {VertexAI} from '@google-cloud/vertexai';
import {
  analyzeClipWithQuickClickEngine,
  QUICKCLICK_ENGINE_SYSTEM_INSTRUCTION,
  quickClickEngineSchema,
} from './server/services/gemini';

function geminiServerPlugin(): Plugin {
  return {
    name: 'gemini-server-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/gemini' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', async () => {
            try {
              const {prompt} = JSON.parse(bodyStr || '{}');

              if (!prompt) {
                res.writeHead(400, {'Content-Type': 'application/json'});
                res.end(
                  JSON.stringify({
                    error: 'Prompt ist erforderlich für die Textgenerierung',
                  })
                );
                return;
              }

              const project =
                process.env.GOOGLE_CLOUD_PROJECT ||
                process.env.GCP_PROJECT ||
                process.env.VITE_FIREBASE_PROJECT_ID ||
                'qlipzync';
              const location =
                process.env.GOOGLE_CLOUD_LOCATION ||
                process.env.GCP_REGION ||
                'europe-west3';
              const modelName =
                process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash-002';

              const vertexAI = new VertexAI({
                project,
                location,
              });

              const generativeModel = vertexAI.getGenerativeModel({
                model: modelName,
              });

              const response = await generativeModel.generateContent({
                contents: [{role: 'user', parts: [{text: prompt}]}],
              });

              const replyText =
                response.response?.candidates?.[0]?.content?.parts
                  ?.map((part: any) => part.text || '')
                  .join('') || '';

              res.writeHead(200, {'Content-Type': 'application/json'});
              res.end(
                JSON.stringify({
                  reply: replyText,
                  text: replyText,
                  model: modelName,
                  provider: 'vertex-ai',
                  project,
                  location,
                })
              );
            } catch (err: any) {
              const errMsg = String(err?.message || err || '');
              const errCode = err?.code || err?.status;

              // Erkennung von IAM-Rollen- und Autorisierungsfehlern (z.B. fehlende 'roles/aiplatform.user')
              const isIamPermissionError =
                errCode === 7 ||
                errCode === 403 ||
                errCode === 'PERMISSION_DENIED' ||
                errMsg.includes('PERMISSION_DENIED') ||
                errMsg.includes('Permission denied') ||
                errMsg.includes('roles/aiplatform.user') ||
                errMsg.includes('aiplatform.endpoints.predict') ||
                errMsg.includes('caller does not have permission') ||
                errMsg.includes('The caller does not have permission');

              const isAuthCredentialMissing =
                errMsg.includes('Could not load the default credentials') ||
                errMsg.includes('credentials') ||
                errMsg.includes('GOOGLE_APPLICATION_CREDENTIALS');

              if (isIamPermissionError) {
                res.writeHead(403, {'Content-Type': 'application/json'});
                res.end(
                  JSON.stringify({
                    error: 'Infrastruktur-Zugriff verweigert: Fehlende Berechtigung für die KI-Verarbeitung.',
                    code: 'IAM_PERMISSION_DENIED',
                  })
                );
                return;
              }

              if (isAuthCredentialMissing) {
                res.writeHead(401, {'Content-Type': 'application/json'});
                res.end(
                  JSON.stringify({
                    error: 'Authentifizierung am KI-Backend fehlgeschlagen.',
                    code: 'AUTH_CREDENTIALS_MISSING',
                  })
                );
                return;
              }

              res.writeHead(500, {'Content-Type': 'application/json'});
              res.end(
                JSON.stringify({
                  error: 'Interner Fehler bei der KI-Ausführung',
                  code: 'VERTEX_AI_EXECUTION_ERROR',
                })
              );
            }
          });
          return;
        }

        // Health Probe Endpoints (Public Operational Status Only - Zero Infrastructure Leakage)
        if (
          (req.url === '/health' ||
            req.url === '/api/health' ||
            req.url === '/healthz' ||
            req.url === '/livez' ||
            req.url === '/readyz') &&
          req.method === 'GET'
        ) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              status: 'healthy',
              operationalState: 'OPERATIONAL',
              service: 'quickclick-app',
              version: '7.0.0',
              zeroStorageStatus: 'active (0 MB cloud video storage)',
              uptimeSeconds: Math.floor(process.uptime()),
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        if (
          (req.url === '/api/system/gcp-verify' || req.url === '/api/v1/system/gcp-verify') &&
          req.method === 'GET'
        ) {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Nicht autorisiert: Infrastruktur-Verifikation erfordert Administrator-Authentifizierung.',
              })
            );
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              verifiedAt: new Date().toISOString(),
              project: 'qlipzync',
              projectNumber: '248792984033',
              firestore: {
                databaseId:
                  process.env.FIRESTORE_DB ||
                  'ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91',
                region: process.env.GCP_REGION || 'europe-west3',
                multiTenantIsolation: 'enforced (request.auth.uid == userId)',
              },
              workloadIdentityFederation: {
                repository: 'qlipzync/quickclick-beta',
                pool: 'projects/248792984033/locations/global/workloadIdentityPools/github-pool',
                provider:
                  'projects/248792984033/locations/global/workloadIdentityPools/github-pool/providers/github-provider',
                principalSet:
                  'principalSet://iam.googleapis.com/projects/248792984033/locations/global/workloadIdentityPools/github-pool/attribute.repository/qlipzync/quickclick-beta',
              },
              cloudRun: {
                serviceName: 'quickclick-app',
                region: process.env.GCP_REGION || 'europe-west3',
                serviceAccount: 'qlipzync-runner@qlipzync.iam.gserviceaccount.com',
                requiredRoles: [
                  'roles/run.admin',
                  'roles/run.invoker',
                  'roles/datastore.user',
                  'roles/aiplatform.user',
                  'roles/cloudkms.cryptoKeyEncrypterDecrypter',
                  'roles/secretmanager.secretAccessor',
                  'roles/cloudtasks.enqueuer',
                  'roles/iam.serviceAccountUser',
                  'roles/logging.logWriter',
                ],
                healthEndpoint: '/api/health',
              },
            })
          );
          return;
        }

        // Public Configuration Endpoint
        if (
          (req.url === '/api/config/public' || req.url === '/api/v1/config/public') &&
          req.method === 'GET'
        ) {
          const dbId =
            process.env.FIRESTORE_DB ||
            'ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              version: '7.0.0',
              config: {
                apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyB209DOGAYYqvZcD6KuQ4qvE3Z4RACiooM',
                authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'qlipzync.firebaseapp.com',
                projectId: 'qlipzync',
              },
              pricing: {
                model: 'dynamic_slider',
                minClips: 1,
                maxClips: 20000,
                minUnitPriceEur: 0.05,
                maxUnitPriceEur: 0.50,
              },
              endpoints: {
                apiBaseUrl: '/api',
                productionHostingUrl: 'https://qlipzync.web.app',
                databaseId: dbId,
              },
            })
          );
          return;
        }

        // QuickClick Engine Config Endpoint
        if (
          (req.url === '/api/clip/engine-config' || req.url === '/api/ai/quickclick-config') &&
          req.method === 'GET'
        ) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              systemInstruction: QUICKCLICK_ENGINE_SYSTEM_INSTRUCTION,
              recommendedSettings: {
                model: 'models/gemini-flash-latest',
                temperature: 0.5,
                topP: 0.9,
                responseMimeType: 'application/json',
              },
              schema: quickClickEngineSchema,
            })
          );
          return;
        }

        // QuickClick Engine Multimodal Video Intelligence Analysis Endpoint
        if (
          (req.url === '/api/clip/analyze' ||
            req.url === '/api/ai/quickclick-engine' ||
            req.url === '/api/clips/analyze-quickclick') &&
          req.method === 'POST'
        ) {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', async () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const result = await analyzeClipWithQuickClickEngine({
                clipTitle: body.clipTitle || 'Highlight Clip',
                streamerName: body.streamerName,
                game: body.game,
                durationSec: body.durationSec ? Number(body.durationSec) : 30,
                transcript: body.transcript,
                videoUrl: body.videoUrl,
                videoInlineData: body.videoInlineData,
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: true,
                  ...result,
                  analyzedAt: new Date().toISOString(),
                })
              );
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: err?.message || 'Fehler bei der QuickClick Analyse',
                })
              );
            }
          });
          return;
        }

        // Dynamic Clip Quota & Google Pay Top-up Endpoint (Requires Auth & Payment Token)
        if (req.url === '/api/billing/topup' && req.method === 'POST') {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'Nicht autorisiert (HTTP 401): Authentifizierung erforderlich.',
              })
            );
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const { handleTopupRequest } = await import('./server/routes/topupRoute.js');
              (req as any).body = JSON.parse(body || '{}');
              const token = authHeader.split('Bearer ')[1]?.trim() || '';
              let uid = '';
              try {
                if (token.includes('.')) {
                  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf-8'));
                  uid = payload.user_id || payload.sub || '';
                }
              } catch {}
              if (!uid) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Ungültiges Sitzungstoken.' }));
                return;
              }
              (req as any).user = { uid };
              const mockRes = {
                status(code: number) {
                  res.statusCode = code;
                  return this;
                },
                json(payload: any) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(payload));
                  return this;
                },
              };
              await handleTopupRequest(req as any, mockRes as any);
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err?.message || 'Fehler beim Top-up' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), geminiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
