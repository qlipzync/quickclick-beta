#!/usr/bin/env bash
# ==============================================================================
# QlipZync - Production Deploy & Setup Wrapper
# Delegates to canonical scripts/deploy.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/deploy.sh" "$@"
