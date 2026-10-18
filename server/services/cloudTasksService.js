import { CloudTasksClient } from "@google-cloud/tasks";
const PROJECT_ID = process.env.GCP_PROJECT || "qlipzync";
const REGION = process.env.GCP_REGION || "europe-west3";
const QUEUE_NAME = process.env.CLOUD_TASKS_QUEUE || "stream-cooldown-queue";
const SERVICE_URL = process.env.APP_BASE_URL || "https://quickclick-app-248792984033.europe-west3.run.app";
const SERVICE_ACCOUNT_EMAIL = process.env.GCP_SERVICE_ACCOUNT || "ais-gemini-key-087af15395324fc@248792984033.iam.gserviceaccount.com";
let tasksClient = null;
function getTasksClient() {
  if (!tasksClient) {
    tasksClient = new CloudTasksClient();
  }
  return tasksClient;
}
async function enqueueStreamCooldownTask(payload, fallbackExecutor) {
  const delaySeconds = 300;
  const scheduledTimeMs = Date.now() + delaySeconds * 1e3;
  const scheduledAt = new Date(scheduledTimeMs).toISOString();
  try {
    const client = getTasksClient();
    const parent = client.queuePath(PROJECT_ID, REGION, QUEUE_NAME);
    const task = {
      httpRequest: {
        httpMethod: "POST",
        url: `${SERVICE_URL}/api/twitch/cooldown-task`,
        headers: {
          "Content-Type": "application/json"
        },
        body: Buffer.from(JSON.stringify(payload)).toString("base64"),
        oidcToken: {
          serviceAccountEmail: SERVICE_ACCOUNT_EMAIL,
          audience: SERVICE_URL
        }
      },
      scheduleTime: {
        seconds: Math.floor(scheduledTimeMs / 1e3)
      }
    };
    console.log(
      `\u23F3 [Cloud Tasks Cooldown] Erstelle Task f\xFCr ${payload.broadcasterName} (${payload.broadcasterId}) mit exakt 300s (5 Min) Verz\xF6gerung...`
    );
    const [response] = await client.createTask({ parent, task });
    console.log(`\u2705 [Cloud Tasks Cooldown] Task ${response.name} erfolgreich eingeplant f\xFCr ${scheduledAt}.`);
    return {
      success: true,
      mode: "cloud_tasks",
      scheduledAt
    };
  } catch (err) {
    console.warn(
      `\u26A0\uFE0F [Cloud Tasks Fallback] Cloud Tasks nicht direkt erreichbar (${err.message || "Queue unconfigured"}). Starte server-seitigen 300s (5 Min) Pr\xE4zisionstimer als Fallback.`
    );
    setTimeout(() => {
      console.log(`\u23F1\uFE0F [Cooldown Timer Expiry] 300 Sekunden f\xFCr ${payload.broadcasterName} abgelaufen. F\xFChre Offline-Verarbeitung aus.`);
      fallbackExecutor(payload).catch((execErr) => {
        console.error("[Cooldown Execution Error]", execErr);
      });
    }, delaySeconds * 1e3);
    return {
      success: true,
      mode: "local_timer",
      scheduledAt
    };
  }
}
export {
  enqueueStreamCooldownTask
};
