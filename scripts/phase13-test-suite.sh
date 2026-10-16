#!/usr/bin/env bash
# ==============================================================================
# QlipZync - System Health & Verification Test Suite Wrapper
# Delegates to canonical scripts/test.sh
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/test.sh" "$@"
