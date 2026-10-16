#!/usr/bin/env bash
# ==============================================================================
# QlipZync / QuickClick - Streamlined Cloud Run Production Deploy Script
# Repository: https://github.com/qlipzync/qlipZync-repo
# Project: qlipzync | Region: europe-west3 | Service: quickclick-app
# ==============================================================================
set -euo pipefail

PROJECT_ID="qlipzync"
REGION="europe-west3"
SERVICE_NAME="quickclick-app"
SERVICE_ACCOUNT="qlipzync-runner@qlipzync.iam.gserviceaccount.com"
FIRESTORE_DB="ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}================================================================="
echo "   QLIPZYNC - STREAMLINED ZERO-STORAGE PRODUCTION DEPLOY         "
echo -e "=================================================================${NC}"

# 1. Frontend Build
echo -e "${YELLOW}>> [1/4] Erstelle Vite Production Build (dist/)...${NC}"
npm run build

# 2. GCP Projekt konfigurieren
echo -e "${YELLOW}>> [2/4] Konfiguriere GCP-Projekt: ${PROJECT_ID}...${NC}"
gcloud config set project "${PROJECT_ID}" --quiet

# 3. Secret Manager Bindings ermitteln
echo -e "${YELLOW}>> [3/4] Binde Secret Manager Variablen ein...${NC}"
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

# 4. Deploy auf Cloud Run mit Scale-to-Zero (--min-instances 0)
echo -e "${YELLOW}>> [4/4] Deploye auf Cloud Run mit --min-instances 0 (0 € Idle Cost)...${NC}"
gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --region "${REGION}" \
  --allow-unauthenticated \
  --service-account "${SERVICE_ACCOUNT}" \
  --port 3000 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production,FIRESTORE_DB=${FIRESTORE_DB}" \
  ${SECRET_FLAG} \
  --quiet

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --project="${PROJECT_ID}" --format="value(status.url)" 2>/dev/null || echo "https://${SERVICE_NAME}-248792984033.${REGION}.run.app")

echo -e "\n${GREEN}================================================================="
echo "   QLIPZYNC ERFOLGREICH DEPLOYT!                                 "
echo -e "=================================================================${NC}"
echo "Live URL:             ${SERVICE_URL}"
echo "Twitch Webhook:       ${SERVICE_URL}/api/webhooks/twitch"
echo "Stripe Webhook:       ${SERVICE_URL}/api/stripe/webhook"
echo "Healthcheck:          ${SERVICE_URL}/health"
echo "Scale-to-Zero:        Aktiviert (--min-instances 0)"
echo "Zero-Storage RAM:     Aktiviert (0 MB Disk-Footprint)"
echo "================================================================="
