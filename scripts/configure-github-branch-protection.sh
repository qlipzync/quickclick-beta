#!/usr/bin/env bash
# ==============================================================================
# Priorität 3: GitHub Branch-Schutz für 'main' & erforderliche CI Status-Checks
# Repository: qlipzync/quickclick-beta
# Erforderlicher CI-Check aus .github/workflows/ci.yml: "Build, Typecheck & Test"
# ==============================================================================
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-qlipzync/quickclick-beta}"
BRANCH="main"
REQUIRED_CHECK_CONTEXT="Build, Typecheck & Test"

echo "========================================================================"
echo "  PRIORITÄT 3: GITHUB BRANCH-PROTECTION FÜR '${REPO}' (${BRANCH})"
echo "========================================================================"

if ! command -v gh >/dev/null 2>&1; then
  echo "[HINWEIS] GitHub CLI ('gh') nicht installiert. Verwende cURL gegen GitHub REST API..."
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "[ERROR] Bitte GITHUB_TOKEN (mit 'repo' bzw. 'Administration: Read & Write' Berechtigung) setzen."
    exit 1
  fi

  curl -fsSL -X PUT \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${GITHUB_TOKEN}" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${REPO}/branches/${BRANCH}/protection" \
    -d @- <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "${REQUIRED_CHECK_CONTEXT}"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
EOF
else
  echo ">> Konfiguriere Branch-Protection für ${REPO} (${BRANCH}) via GitHub CLI..."
  gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "/repos/${REPO}/branches/${BRANCH}/protection" \
    --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "${REQUIRED_CHECK_CONTEXT}"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
EOF

  echo ">> Verifiziere aktive Branch-Protection-Regeln auf '${BRANCH}'..."
  gh api \
    -H "Accept: application/vnd.github+json" \
    "/repos/${REPO}/branches/${BRANCH}/protection"
fi

echo "========================================================================"
echo "  GITHUB BRANCH-SCHUTZ & STATUS-CHECKS ('${REQUIRED_CHECK_CONTEXT}') AKTIV!"
echo "========================================================================"
