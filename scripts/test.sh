#!/usr/bin/env bash
# ==============================================================================
# QlipZync - System Health & Verification Test Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}================================================================="
echo "   QLIPZYNC - SYSTEM HEALTH & VERIFICATION TEST SUITE            "
echo -e "=================================================================${NC}"

echo -e "${YELLOW}>> [1/3] TypeScript Typecheck & Linting...${NC}"
npm run lint
echo -e "   ${GREEN}✔${NC} TypeScript Prüfung erfolgreich (0 Fehler)"

echo -e "${YELLOW}>> [2/3] Vite Applet Compilation & Build Test...${NC}"
npm run build
echo -e "   ${GREEN}✔${NC} Build erfolgreich abgeschlossen (dist/index.html generiert)"

echo -e "${YELLOW}>> [3/3] Express Server Endpoints Test...${NC}"
npm test
echo -e "   ${GREEN}✔${NC} Alle internen Tests erfolgreich bestanden"

echo -e "\n${GREEN}================================================================="
echo "   ALLE SYSTEMTESTS BESTANDEN (100% OPERATIONAL)                 "
echo -e "=================================================================${NC}"
