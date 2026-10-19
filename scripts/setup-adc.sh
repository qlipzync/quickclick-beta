#!/usr/bin/env bash
# ==============================================================================
# Google Cloud Model API, Gemini & QlipZync Infrastructure: ADC Setup Script
# Basierend auf: https://storage.googleapis.com/cloud-samples-data/adc/setup_adc.sh
# Vorkonfiguriert für Projekt: qlipzync (248792984033) | Region: europe-west3
# ==============================================================================
set -euo pipefail

DEFAULT_PROJECT_ID="${GCP_PROJECT:-qlipzync}"
DEFAULT_GEMINI_MODEL="gemini-2.5-flash"
readonly DEFAULT_GEMINI_MODEL

echo "================================================================"
echo "   Google Cloud Model API & QlipZync: ADC Setup & Verification"
echo "================================================================"

if ! command -v curl >/dev/null 2>&1; then
  echo "Fehler: 'curl' wird benötigt, um dieses Skript auszuführen."
  exit 1
fi

# --- Step 1: Locate or Install gcloud CLI ---
echo ""
echo "--- Step 1: Locating gcloud CLI ---"
GCLOUD_NEWLY_INSTALLED=false
GCLOUD_BIN=""

if command -v gcloud >/dev/null 2>&1; then
  GCLOUD_BIN="$(command -v gcloud)"
  echo "gcloud CLI gefunden im PATH: $GCLOUD_BIN"
elif [[ -x "$HOME/google-cloud-sdk/bin/gcloud" ]]; then
  GCLOUD_BIN="$HOME/google-cloud-sdk/bin/gcloud"
  echo "gcloud CLI gefunden unter: $GCLOUD_BIN"
elif [[ "${INSTALL_GCLOUD_SDK:-false}" == "true" ]]; then
  echo "gcloud CLI nicht gefunden. Lade Google Cloud SDK Installer herunter..."
  TMP_INSTALL="$(mktemp "${TMPDIR:-/tmp}/gcloud_install.XXXXXX")"
  trap 'rm -f "$TMP_INSTALL"' EXIT
  if ! curl -sSL https://sdk.cloud.google.com -o "$TMP_INSTALL"; then
    echo "Fehler beim Herunterladen des Google Cloud SDK Installers."
    exit 1
  fi
  bash "$TMP_INSTALL" --disable-prompts --install-dir="$HOME" || true
  rm -f "$TMP_INSTALL"
  trap - EXIT
  if [[ -x "$HOME/google-cloud-sdk/bin/gcloud" ]]; then
    GCLOUD_BIN="$HOME/google-cloud-sdk/bin/gcloud"
    GCLOUD_NEWLY_INSTALLED=true
    PATH="$HOME/google-cloud-sdk/bin:$PATH"
    export PATH
    echo "gcloud CLI installiert unter: $GCLOUD_BIN"
  fi
else
  echo "Hinweis: gcloud CLI ist in dieser Container-Umgebung nicht vorinstalliert (nutze Metadata Server / ADC Fallback oder setze INSTALL_GCLOUD_SDK=true)."
fi

if [[ -n "$GCLOUD_BIN" && -d "$(dirname "$GCLOUD_BIN")" ]]; then
  GCLOUD_DIR="$(dirname "$GCLOUD_BIN")"
  PATH="$GCLOUD_DIR:$PATH"
  export PATH
fi

# --- Step 2: Project Configuration ---
echo ""
echo "--- Step 2: Project Setup ---"
PROJECT_ID="$DEFAULT_PROJECT_ID"
if [[ -t 0 && -z "${GCP_PROJECT:-}" ]]; then
  read -r -p "Project ID [${DEFAULT_PROJECT_ID}]: " INPUT_PROJECT_ID || true
  INPUT_PROJECT_ID="$(echo "${INPUT_PROJECT_ID:-}" | tr -d '\"'\'' ')"
  if [[ -n "$INPUT_PROJECT_ID" ]]; then
    PROJECT_ID="$INPUT_PROJECT_ID"
  fi
fi
echo "Verwende Google Cloud Project ID: $PROJECT_ID"

# --- Step 3: Authenticate Application Default Credentials (ADC) ---
echo ""
echo "--- Step 3: Authenticating Application Default Credentials (ADC) ---"
ACCESS_TOKEN=""

if [[ -n "$GCLOUD_BIN" ]]; then
  ACCESS_TOKEN=$("$GCLOUD_BIN" auth application-default print-access-token 2>/dev/null || true)
  if [[ -z "$ACCESS_TOKEN" && -t 0 ]]; then
    echo "Autorisiere Google Cloud Account für Application Default Credentials..."
    if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" && "$(uname -s)" != "Darwin" ]]; then
      "$GCLOUD_BIN" auth application-default login --no-launch-browser
    else
      "$GCLOUD_BIN" auth application-default login
    fi
    ACCESS_TOKEN=$("$GCLOUD_BIN" auth application-default print-access-token 2>/dev/null || true)
  fi
fi

# Fallback auf GCP Metadata Server (Cloud Run / GCE / AI Studio Sandbox)
if [[ -z "$ACCESS_TOKEN" ]]; then
  ACCESS_TOKEN=$(curl -s -m 2 -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
    | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4 || true)
  if [[ -n "$ACCESS_TOKEN" ]]; then
    SA_EMAIL=$(curl -s -m 2 -H "Metadata-Flavor: Google" \
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email" || true)
    echo "ADC-Token über GCP Metadata Server bezogen (Service Account: ${SA_EMAIL:-default})."
  fi
fi

if [[ -z "$ACCESS_TOKEN" ]]; then
  echo "Kein aktives ADC-Token gefunden. Bitte führe in einer interaktiven Shell aus:"
  echo "  gcloud auth application-default login --no-launch-browser"
  exit 1
fi

# --- Step 4: Finalizing Project & Quota Configuration ---
echo ""
echo "--- Step 4: Finalizing Project & Quota Configuration ---"
if [[ -n "$GCLOUD_BIN" ]]; then
  "$GCLOUD_BIN" config set project "$PROJECT_ID" 2>/dev/null || true
  "$GCLOUD_BIN" auth application-default set-quota-project "$PROJECT_ID" 2>/dev/null || true
fi
echo "Quota-Projekt konfiguriert: $PROJECT_ID"

# --- Step 5: Check & Enable Required APIs ---
echo ""
echo "--- Step 5: Ensuring Agent Platform / Model API is Enabled ---"
CHECK_RESP=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Goog-User-Project: $PROJECT_ID" \
  "https://serviceusage.googleapis.com/v1/projects/$PROJECT_ID/services/aiplatform.googleapis.com" || true)
CHECK_BODY=$(echo "$CHECK_RESP" | sed -e '$d')
CHECK_STATUS=$(echo "$CHECK_RESP" | tail -n 1 | sed -e 's/HTTP_STATUS://')

if [[ "$CHECK_STATUS" == "200" ]] && echo "$CHECK_BODY" | grep -iq '"state":\s*"ENABLED"'; then
  echo "'aiplatform.googleapis.com' ist auf Projekt '$PROJECT_ID' aktiviert."
else
  echo "Status der Service Usage API-Abfrage für '$PROJECT_ID': HTTP $CHECK_STATUS"
  echo "Hinweis: Falls du in einer isolierten Sandbox läufst, hat das Sandbox-Servicekonto keinen direkten IAM-Zugriff auf '$PROJECT_ID' (roles/serviceusage.serviceUsageConsumer)."
fi

# --- Step 6: Verify ADC Access & Run Infrastructure Verification ---
echo ""
echo "--- Step 6: Running QlipZync GCP & WIF Verification ---"
if [[ -f "./scripts/verify-gcp-and-wif.sh" ]]; then
  bash ./scripts/verify-gcp-and-wif.sh
fi
