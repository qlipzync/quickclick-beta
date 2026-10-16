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
                    error: `IAM-Rollenüberprüfung fehlgeschlagen: Dem Service Account fehlt die Berechtigung 'roles/aiplatform.user' auf Projekt '${process.env.GOOGLE_CLOUD_PROJECT || 'qlipzync'}'.`,
                    code: 'IAM_ROLE_VERIFICATION_FAILED',
                    requiredRole: 'roles/aiplatform.user',
                    project: process.env.GOOGLE_CLOUD_PROJECT || 'qlipzync',
                    location: process.env.GOOGLE_CLOUD_LOCATION || 'europe-west3',
                    details: errMsg,
                    resolution:
                      'Weise dem Cloud-Run-Laufzeitkonto die IAM-Rolle roles/aiplatform.user zu (gcloud projects add-iam-policy-binding).',
                  })
                );
                return;
              }

              if (isAuthCredentialMissing) {
                res.writeHead(401, {'Content-Type': 'application/json'});
                res.end(
                  JSON.stringify({
                    error:
                      'Google Cloud Authentifizierung: Keine Anmeldedaten gefunden (Application Default Credentials fehlen).',
                    code: 'GCP_AUTH_CREDENTIALS_MISSING',
                    details: errMsg,
                  })
                );
                return;
              }

              res.writeHead(500, {'Content-Type': 'application/json'});
              res.end(
                JSON.stringify({
                  error: errMsg || 'Interner Fehler bei Vertex AI Ausführung',
                  code: 'VERTEX_AI_EXECUTION_ERROR',
                })
              );
            }
          });
          return;
        }

        // Public Configuration Endpoint
        if (
          (req.url === '/api/config/public' || req.url === '/api/v1/config/public') &&
          req.method === 'GET'
        ) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              version: '7.0.0',
              config: {
                apiKey: process.env.VITE_FIREBASE_API_KEY || '',
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
                clipTitle: body.clipTitle || 'Insane 1v4 Final Ring Clutch! 🔥',
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

        // Dynamic Clip Quota & Google Pay Top-up Endpoint (1 - 20.000 Clips)
        if (req.url === '/api/billing/topup' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const addedClips = Math.floor(Number(parsed.addedClips)) || 100;
              const userId = parsed.userId || 'usr_94821a';

              if (addedClips < 1 || addedClips > 20000) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Ungültige Clipanzahl. Erlaubt: 1 bis 20.000 Clips.' }));
                return;
              }

              const logFactor = 1 - Math.log(addedClips) / Math.log(20000);
              const unitPrice = Math.max(0.05, 0.05 + (0.50 - 0.05) * logFactor);
              const totalPrice = addedClips * unitPrice;
              const discount = Math.round((1 - unitPrice / 0.50) * 100);

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  success: true,
                  userId,
                  addedClips,
                  unitPriceEur: Number(unitPrice.toFixed(4)),
                  chargedEur: Number(totalPrice.toFixed(2)),
                  discountPercent: discount,
                  clipsRemaining: 534 + addedClips,
                  paidAt: new Date().toISOString(),
                })
              );
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
