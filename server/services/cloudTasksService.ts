import { CloudTasksClient } from '@google-cloud/tasks';

const PROJECT_ID = process.env.GCP_PROJECT || 'qlipzync';
const REGION = process.env.GCP_REGION || 'europe-west3';
const QUEUE_NAME = process.env.CLOUD_TASKS_QUEUE || 'stream-cooldown-queue';
const SERVICE_URL =
  process.env.APP_BASE_URL || 'https://quickclick-app-248792984033.europe-west3.run.app';
const SERVICE_ACCOUNT_EMAIL =
  process.env.GCP_SERVICE_ACCOUNT || 'ais-gemini-key-087af15395324fc@248792984033.iam.gserviceaccount.com';

let tasksClient: CloudTasksClient | null = null;

function getTasksClient(): CloudTasksClient {
  if (!tasksClient) {
    tasksClient = new CloudTasksClient();
  }
  return tasksClient;
}

export interface StreamCooldownPayload {
  broadcasterId: string;
  broadcasterName: string;
  streamEndedAt: string;
}

/**
 * Enqueues a delayed task to Google Cloud Tasks with exactly 300 seconds (5 minutes) delay.
 * Falls back to an in-memory 300-second timer if running in environments without GCP IAM bindings.
 */
export async function enqueueStreamCooldownTask(
  payload: StreamCooldownPayload,
  fallbackExecutor: (payload: StreamCooldownPayload) => Promise<void>
): Promise<{ success: boolean; mode: 'cloud_tasks' | 'local_timer'; scheduledAt: string }> {
  const delaySeconds = 300; // Exakt 300 Sekunden (5 Minuten)
  const scheduledTimeMs = Date.now() + delaySeconds * 1000;
  const scheduledAt = new Date(scheduledTimeMs).toISOString();

  try {
    const client = getTasksClient();
    const parent = client.queuePath(PROJECT_ID, REGION, QUEUE_NAME);

    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url: `${SERVICE_URL}/api/twitch/cooldown-task`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        oidcToken: {
          serviceAccountEmail: SERVICE_ACCOUNT_EMAIL,
          audience: SERVICE_URL,
        },
      },
      scheduleTime: {
        seconds: Math.floor(scheduledTimeMs / 1000),
      },
    };

    console.log(
      `⏳ [Cloud Tasks Cooldown] Erstelle Task für ${payload.broadcasterName} (${payload.broadcasterId}) mit exakt 300s (5 Min) Verzögerung...`
    );

    const [response] = await client.createTask({ parent, task });
    console.log(`✅ [Cloud Tasks Cooldown] Task ${response.name} erfolgreich eingeplant für ${scheduledAt}.`);

    return {
      success: true,
      mode: 'cloud_tasks',
      scheduledAt,
    };
  } catch (err: any) {
    console.warn(
      `⚠️ [Cloud Tasks Fallback] Cloud Tasks nicht direkt erreichbar (${err.message || 'Queue unconfigured'}). Starte server-seitigen 300s (5 Min) Präzisionstimer als Fallback.`
    );

    // Guaranteed in-memory fallback for local dev / sandbox environments
    setTimeout(() => {
      console.log(`⏱️ [Cooldown Timer Expiry] 300 Sekunden für ${payload.broadcasterName} abgelaufen. Führe Offline-Verarbeitung aus.`);
      fallbackExecutor(payload).catch((execErr) => {
        console.error('[Cooldown Execution Error]', execErr);
      });
    }, delaySeconds * 1000);

    return {
      success: true,
      mode: 'local_timer',
      scheduledAt,
    };
  }
}
