#!/usr/bin/env bash
# Deploy only the already-reviewed Firebase configuration and Firestore rules.
# This script intentionally does not rewrite firebase.json or firestore.rules.
set -euo pipefail

PROJECT_ID="qlipzync"
FIRESTORE_DB="ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91"

command -v firebase >/dev/null 2>&1 || {
  echo "ERROR: Firebase CLI is required (npm install -g firebase-tools)." >&2
  exit 1
}
command -v node >/dev/null 2>&1 || {
  echo "ERROR: Node.js is required to validate firebase.json." >&2
  exit 1
}

if [[ ! -f firebase.json || ! -f firestore.rules ]]; then
  echo "ERROR: Run this script from the repository root; firebase.json/firestore.rules missing." >&2
  exit 1
fi

CONFIGURED_DB="$(node -e "process.stdout.write(require('./firebase.json').firestore?.database || '')")"
if [[ "$CONFIGURED_DB" != "$FIRESTORE_DB" ]]; then
  echo "ERROR: firebase.json targets '$CONFIGURED_DB', expected '$FIRESTORE_DB'. No deployment performed." >&2
  exit 1
fi

echo "Deploying reviewed Firestore rules and Hosting configuration to ${PROJECT_ID}."
echo "Firestore database: ${FIRESTORE_DB}"
firebase deploy --only firestore:rules,hosting --project "$PROJECT_ID" --non-interactive
echo "Firebase deployment command completed."
