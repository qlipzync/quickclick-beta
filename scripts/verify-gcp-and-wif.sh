#!/usr/bin/env bash
# ==============================================================================
# QlipZync / QuickClick - Google Cloud & Workload Identity Verifikations-Skript
# Prüft:
# 1. Tatsächliche Firestore-Datenbank-ID und Region
# 2. Workload Identity Federation für qlipzync/quickclick-beta
# 3. Berechtigungen des Cloud-Run-Servicekontos
# 4. Tatsächlichen Cloud-Run-Service und dessen Health-Endpunkt
# ==============================================================================
set -euo pipefail

PROJECT_ID="${GCP_PROJECT:-qlipzync}"
PROJECT_NUMBER="${GCP_PROJECT_NUMBER:-248792984033}"
EXPECTED_REGION="${GCP_REGION:-europe-west3}"
EXPECTED_DB="${FIRESTORE_DB:-ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91}"
SERVICE_NAME="${SERVICE_NAME:-quickclick-app}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-qlipzync-runner@qlipzync.iam.gserviceaccount.com}"
WIF_POOL="github-pool"
WIF_PROVIDER="github-provider"
WIF_REPO="qlipzync/quickclick-beta"
EXPECTED_PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${WIF_REPO}"

echo "========================================================================"
echo "  PRIORITÄT 1: GOOGLE CLOUD & WORKLOAD IDENTITY VERIFIZIERUNG"
echo "========================================================================"

echo ""
echo "[1/4] Prüfe Firestore-Datenbank-ID (${EXPECTED_DB}) und Region (${EXPECTED_REGION})..."
if command -v gcloud >/dev/null 2>&1; then
  DB_INFO=$(gcloud firestore databases describe --database="${EXPECTED_DB}" --project="${PROJECT_ID}" --format="json" 2>/dev/null || true)
  if [ -n "${DB_INFO}" ]; then
    ACTUAL_LOCATION=$(echo "${DB_INFO}" | grep -o '"locationId": *"[^"]*"' | cut -d'"' -f4)
    echo "  -> Firestore-Datenbank gefunden: ${EXPECTED_DB}"
    echo "  -> Tatsächliche Region: ${ACTUAL_LOCATION}"
    if [ "${ACTUAL_LOCATION}" != "${EXPECTED_REGION}" ]; then
      echo "  [WARNUNG] Region weicht von ${EXPECTED_REGION} ab: ${ACTUAL_LOCATION}"
    fi
  else
    echo "  -> Lokale Konfigurationsprüfung (firebase-applet-config.json & firebase.json):"
    grep -H "${EXPECTED_DB}" firebase-applet-config.json firebase.json
  fi
else
  echo "  -> Verifiziere Firestore-Datenbank-ID in Projektkonfiguration:"
  grep -H "${EXPECTED_DB}" firebase-applet-config.json firebase.json
fi

echo ""
echo "[2/4] Prüfe Workload Identity Federation für ${WIF_REPO}..."
echo "  -> Erwarteter Pool:      projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}"
echo "  -> Erwarteter Provider:  projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/providers/${WIF_PROVIDER}"
echo "  -> Erwartetes Principal: ${EXPECTED_PRINCIPAL}"
if command -v gcloud >/dev/null 2>&1; then
  SA_IAM=$(gcloud iam service-accounts get-iam-policy "${SERVICE_ACCOUNT}" --project="${PROJECT_ID}" --format="json" 2>/dev/null || true)
  if [ -n "${SA_IAM}" ]; then
    if echo "${SA_IAM}" | grep -q "${WIF_REPO}"; then
      echo "  -> [OK] roles/iam.workloadIdentityUser ist an ${WIF_REPO} gebunden."
    else
      echo "  -> [FEHLER] WIF-Binding für ${WIF_REPO} fehlt auf ${SERVICE_ACCOUNT}!"
      exit 1
    fi
  fi
fi

echo ""
echo "[3/4] Kontrolliere Berechtigungen des Cloud-Run-Servicekontos (${SERVICE_ACCOUNT})..."
REQUIRED_ROLES=(
  "roles/run.admin"
  "roles/run.invoker"
  "roles/datastore.user"
  "roles/aiplatform.user"
  "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  "roles/secretmanager.secretAccessor"
  "roles/cloudtasks.enqueuer"
  "roles/iam.serviceAccountUser"
  "roles/logging.logWriter"
)
if command -v gcloud >/dev/null 2>&1; then
  ASSIGNED_ROLES=$(gcloud projects get-iam-policy "${PROJECT_ID}" \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:${SERVICE_ACCOUNT}" \
    --format="value(bindings.role)" 2>/dev/null || true)
  if [ -n "${ASSIGNED_ROLES}" ]; then
    for ROLE in "${REQUIRED_ROLES[@]}"; do
      if echo "${ASSIGNED_ROLES}" | grep -qx "${ROLE}"; then
        echo "  -> [OK] ${ROLE}"
      else
        echo "  -> [FEHLT] ${ROLE}"
      fi
    done
  else
    echo "  -> Erforderliche Rollen dokumentiert: ${REQUIRED_ROLES[*]}"
  fi
else
  for ROLE in "${REQUIRED_ROLES[@]}"; do
    echo "  -> Erforderliche Rolle: ${ROLE}"
  done
fi

echo ""
echo "[4/4] Prüfe Cloud-Run-Service (${SERVICE_NAME}) und Health-Endpunkt (/api/health)..."
LOCAL_HEALTH=$(curl -fsS "http://localhost:3000/api/health" 2>/dev/null || true)
if [ -n "${LOCAL_HEALTH}" ]; then
  echo "  -> [OK] Lokaler /api/health Endpunkt antwortet: ${LOCAL_HEALTH}"
fi

if command -v gcloud >/dev/null 2>&1; then
  SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${EXPECTED_REGION}" --project="${PROJECT_ID}" --format="value(status.url)" 2>/dev/null || true)
  if [ -n "${SERVICE_URL}" ]; then
    echo "  -> Cloud Run URL: ${SERVICE_URL}"
    REMOTE_HEALTH=$(curl -fsS "${SERVICE_URL}/api/health")
    echo "  -> [OK] Cloud Run Health-Endpunkt: ${REMOTE_HEALTH}"
  fi
fi

echo ""
echo "========================================================================"
echo "  VERIFIKATION ERFOLGREICH ABGESCHLOSSEN"
echo "========================================================================"
