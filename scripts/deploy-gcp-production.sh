#!/usr/bin/env bash
# ==============================================================================
# QlipZync - Google Cloud Platform Production Setup & Deployment Script
# Projekt: qlipzync | Region: europe-west3 | Service: quickclick-app
# ==============================================================================
set -euo pipefail

PROJECT_ID="qlipzync"
REGION="europe-west3"
SERVICE_NAME="quickclick-app"
SERVICE_ACCOUNT="qlipzync-runner@qlipzync.iam.gserviceaccount.com"
FIRESTORE_DB="ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91"

echo ">> [1/6] Konfiguriere GCP-Projektumgebung..."
gcloud config set project "${PROJECT_ID}" --quiet

echo ">> [2/6] Aktiviere erforderliche Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudtasks.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  youtube.googleapis.com \
  --quiet

echo ">> [3/6] Prüfe IAM-Rollen für ${SERVICE_ACCOUNT}..."
ROLES=(
  "roles/run.admin"
  "roles/run.invoker"
  "roles/datastore.user"
  "roles/secretmanager.secretAccessor"
  "roles/cloudtasks.enqueuer"
  "roles/logging.logWriter"
)

for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="${ROLE}" \
    --condition=None --quiet >/dev/null
  echo "   ✔ IAM-Rolle aktiv: ${ROLE}"
done

echo ">> [4/6] Initialisiere Cloud Tasks Cooldown-Queue (300s Puffer)..."
gcloud tasks queues create clip-cooldown-queue \
  --location="${REGION}" \
  --max-attempts=5 \
  --min-backoff=10s \
  --max-backoff=300s \
  --project="${PROJECT_ID}" 2>/dev/null || echo "   ✔ Queue 'clip-cooldown-queue' bereits aktiv."

echo ">> [5/6] Ermittle Secrets aus GCP Secret Manager..."
SECRETS_LIST=""
for SEC in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET TWITCH_CLIENT_SECRET TWITCH_WEBHOOK_SECRET GEMINI_API_KEY SESSION_SECRET EMAIL_ACTION_SECRET; do
  if gcloud secrets describe "${SEC}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    SECRETS_LIST="${SECRETS_LIST:+$SECRETS_LIST,}${SEC}=${SEC}:latest"
    echo "   ✔ Secret gebunden: ${SEC}"
  fi
done

SECRET_FLAG=""
if [ -n "${SECRETS_LIST}" ]; then
  SECRET_FLAG="--set-secrets=${SECRETS_LIST}"
fi

echo ">> [6/6] Baue und deploye Produktions-Container auf Google Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --allow-unauthenticated \
  --service-account "${SERVICE_ACCOUNT}" \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,GCP_PROJECT=${PROJECT_ID},GCP_REGION=${REGION},FIRESTORE_DB=${FIRESTORE_DB}" \
  ${SECRET_FLAG} \
  --quiet

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)")

echo "================================================================="
echo "   CLOUDRUN PRODUKTIONS-DEPLOYMENT ERFOLGREICH BEENDET!         "
echo "   Live-URL:     ${SERVICE_URL}"
echo "   Healthcheck:  ${SERVICE_URL}/api/health"
echo "================================================================="
