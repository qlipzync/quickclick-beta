#!/usr/bin/env bash
# ==============================================================================
# QlipZync / QuickClick - Vollautomatisches GCP & Cloud Run Production Deployment
# Projekt: qlipzync (248792984033) | Region: europe-west3 (Frankfurt, EU)
# Firestore DB: ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91
# WIF Repository: qlipzync/quickclick-beta
# ==============================================================================
set -euo pipefail

PROJECT_ID="qlipzync"
PROJECT_NUMBER="248792984033"
REGION="europe-west3"
SERVICE_NAME="quickclick-app"
SERVICE_ACCOUNT_NAME="qlipzync-runner"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
FIRESTORE_DB="ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91"
WIF_POOL="github-pool"
WIF_PROVIDER="github-provider"
WIF_REPO="qlipzync/quickclick-beta"

echo "================================================================="
echo "   QLIPZYNC - GCP PRODUCTION DEPLOYMENT & VERIFIZIERUNG          "
echo "   Projekt:      ${PROJECT_ID} (${PROJECT_NUMBER})               "
echo "   Region:       ${REGION} (Frankfurt, EU)                       "
echo "   Firestore DB: ${FIRESTORE_DB}                                 "
echo "   WIF Repo:     ${WIF_REPO}                                     "
echo "================================================================="

# 1. Aktives GCP Projekt setzen
echo ">> [1/7] Setze GCP-Projekt auf ${PROJECT_ID}..."
gcloud config set project "${PROJECT_ID}" --quiet

# 2. Benötigte Google Cloud APIs aktivieren
echo ">> [2/7] Aktiviere Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  aiplatform.googleapis.com \
  cloudkms.googleapis.com \
  cloudtasks.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com --quiet

# 3. Tatsächliche Firestore-Datenbank-ID und Region prüfen
echo ">> [3/7] Verifiziere Firestore-Datenbank (${FIRESTORE_DB}) und Region (${REGION})..."
gcloud firestore databases describe --database="${FIRESTORE_DB}" --project="${PROJECT_ID}" \
  --format="table(name,locationId,type)"

# 4. Dediziertes Service-Account prüfen & IAM-Rollen verifizieren/zuweisen
echo ">> [4/7] Prüfe Cloud-Run-Servicekonto (${SERVICE_ACCOUNT}) & IAM-Berechtigungen..."
if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --display-name="QlipZync Zero-Storage Production Runner" \
    --project="${PROJECT_ID}"
fi

for ROLE in \
  "roles/run.admin" \
  "roles/run.invoker" \
  "roles/datastore.user" \
  "roles/aiplatform.user" \
  "roles/cloudkms.cryptoKeyEncrypterDecrypter" \
  "roles/secretmanager.secretAccessor" \
  "roles/cloudtasks.enqueuer" \
  "roles/iam.serviceAccountUser" \
  "roles/logging.logWriter"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="${ROLE}" \
    --condition=None \
    --quiet >/dev/null
done

# 5. Workload Identity Federation für qlipzync/quickclick-beta verifizieren & binden
echo ">> [5/7] Überprüfe Workload Identity Federation für ${WIF_REPO}..."
gcloud iam service-accounts add-iam-policy-binding "${SERVICE_ACCOUNT}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${WIF_REPO}" \
  --quiet >/dev/null

# 6. Secret Manager Secrets auslesen und dynamisch verknüpfen
echo ">> [6/7] Prüfe Secret Manager Secrets & starte Cloud Run Deployment..."
SECRETS_TO_ATTACH=""
for SEC in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET TWITCH_CLIENT_SECRET TWITCH_EVENTSUB_SECRET GEMINI_API_KEY; do
  if gcloud secrets describe "${SEC}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    if [ -n "$SECRETS_TO_ATTACH" ]; then
      SECRETS_TO_ATTACH="${SECRETS_TO_ATTACH},${SEC}=${SEC}:latest"
    else
      SECRETS_TO_ATTACH="${SEC}=${SEC}:latest"
    fi
  fi
done

SECRET_FLAG=""
if [ -n "$SECRETS_TO_ATTACH" ]; then
  SECRET_FLAG="--set-secrets=${SECRETS_TO_ATTACH}"
fi

npm run build

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "${SERVICE_ACCOUNT}" \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,FIRESTORE_DB=${FIRESTORE_DB},GCP_PROJECT=${PROJECT_ID},GCP_REGION=${REGION}" \
  ${SECRET_FLAG} \
  --quiet

# 7. Tatsächlichen Cloud-Run-Service und Health-Endpunkt prüfen
echo ">> [7/7] Verifiziere Cloud-Run-Service (${SERVICE_NAME}) & Health-Endpunkt..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)")
HEALTH_JSON=$(curl -fsS "${SERVICE_URL}/api/health")
echo "${HEALTH_JSON}" | grep -q '"status":"healthy"'

echo "================================================================="
echo "   QLIPZYNC ERFOLGREICH DEPLOYT UND VERIFIZIERT!                 "
echo "   Cloud Run URL:     ${SERVICE_URL}                             "
echo "   Health-Endpunkt:   ${SERVICE_URL}/api/health (OK)             "
echo "   Firestore DB:      ${FIRESTORE_DB} (${REGION})                "
echo "   WIF Repository:    ${WIF_REPO}                                "
echo "================================================================="
