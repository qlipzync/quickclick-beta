# QlipZync (QuickClick) - Autonomous Zero-Storage SaaS Platform v7.0.0

Autonome, hochgradig skalierbare Cloud- und Creator-SaaS-Plattform mit **Zero-Storage RAM-Doktrin (0 MB persistenter Disk-Footprint)**, strikter 3-Schichten-Sicherheitsarchitektur, konsolidiertem 2-Datenbanken-Setup und automatisierter Omni-Channel-Distribution.

---

## 🏛️ Entkoppelte 3-Schichten-Architektur (3-Tier)

```
[ Client / Browser ]
        │  (HTTPS + JWT Token)
        ▼
[ Tier 1: Frontend ] ──> React 19 SPA (Vite / Firebase Hosting / CDN)
        │                • Zustandslos, reiner Client-Code
        │                • Keine exponierten Backend-Interna oder Admin-SDKs
        │                • OAuth-Status rein boolesch (z. B. twitchConnected: true)
        ▼
[ Tier 2: Secure API Gateway ] ──> Cloud Run (Node.js / Express auf Port 3000)
        │                          • Gatekeeper: Prüft Firebase ID-Token & Custom Claims (subscribed: true)
        │                          • HTTP 403 Forbidden bei fehlendem/inaktivem Abonnement
        │                          • Stripe Webhook: Setzt admin.auth().setCustomUserClaims(uid)
        │
        ├─► [ Firestore: ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91 / Cloud KMS ]
        │   • Row-Level Security (request.auth.uid == resource.data.userId)
        │   • Serverseitig KMS-verschlüsselte OAuth-Tokens (Twitch, YouTube, TikTok)
        │
        ▼ (Asynchron via Cloud Tasks / EventSub / PipelineManager)
[ Tier 3: Processing Worker ] ──> Zero-Storage Processing Engine
                                   • Twitch Helix & EventSub Ingestion
                                   • Multimodale Inferenz (Google AI Studio / Gemini 2.5 Flash)
                                   • Flüchtige RAM-Transkodierung (/dev/shm, 0 MB Disk)
                                   • Omni-Posting (TikTok, YouTube Shorts, Instagram Reels, X)
```

---

## 🗄️ Konsolidiertes 2-Datenbanken-Setup

| Instanz | ID | Region | Zweck & Vorteile |
|---|---|---|---|
| **Produktion (SaaS & KI)** | `ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91` | `europe-west1` | **Zentrale SaaS-Kern-DB:** Nutzerprofile, Abonnements, Rechnungen, Kanalkonfigurationen, bearbeitete Clips und KI-Metadaten. **Vorteil:** Ermöglicht nahtlose `get()`- und `exists()`-Sicherheitsregeln ohne Cross-Database-Barrieren. |
| **Entwicklung & Sandbox** | `(default)` | `europe-west1` | **Sandbox & CI/CD:** Lokales Testen, Staging und Prototyping mit täglichem No-Cost Free Tier (50k Read, 20k Write). |

---

## 🛡️ Nicht verhandelbare Sicherheitsleitlinien

1. **Strikte Backend- und Infrastruktur-Isolation:**
   - Endbenutzer agieren ausschließlich im Client.
   - Keine Exponierung von GCP-Infrastruktur, Cloud Run Service-URLs, Service Accounts oder privaten Repositories.
   - Alle Aufrufe laufen standardisiert über geschützte `/api/*`-Routen.
2. **Rollen- und Abonnement-Steuerung (RBAC & Subscription Gate):**
   - Neue Benutzer erhalten nach der Registrierung (`onUserCreate`) standardmäßig Null-Zugriff (`subscriptionStatus: 'inactive'`, 0 Kontingente).
   - Middleware-Prüfung bei jedem geschützten Endpunkt:
     1. Authentifizierung via Firebase Auth / JWT Bearer Token.
     2. Verifizierung des Custom Claims `subscribed: true` oder DB-Abonnement-Status.
     3. Bei fehlendem aktivem Status: Strikte Abweisung mit **HTTP 403 Forbidden**.
3. **Tenant-Isolation und Row-Level Security (RLS):**
   - Zugriff ausschließlich auf Ressourcen der eigenen verifizierten Identität (`request.auth.uid == resource.data.userId`).
   - Cross-User-Zugriffe sind auf Datenbankebene unmöglich.
4. **Token-Schutz & Schlüsselverwaltung:**
   - OAuth-Tokens von Drittanbietern werden serverseitig via Google Cloud KMS verschlüsselt in Firestore gespeichert.
   - Der Client erhält ausschließlich Status-Flags (`twitchConnected: true`), niemals die tatsächlichen Tokens.

---

## 🌟 Erweiterte 7-Stufen-Pipeline

1. **Stufe 1: Live-Einladungslink-Verteiler (`stream.online`)** – Unmittelbare Benachrichtigung auf Discord, Telegram, X.
2. **Stufe 2: 10-Minuten-Intervall Metriken** – Live-Viewer-Counts und Spielstatus an Community-Bots.
3. **Stufe 3: 15-Minuten-Reminder** – Automatisches Reichweiten-Follow-up.
4. **Stufe 4: Stream-Ende Verabschiedung (`stream.offline`)** – Automatischer Abschieds-Broadcast.
5. **Stufe 5: 300s Cooldown & RAM-Verarbeitung** – VOD-Pufferung und Smart 9:16 Video-Cropping in `/dev/shm`.
6. **Stufe 6: Omni-Posting Distribution** – Automatisierter Upload zu TikTok, YouTube Shorts, Reels und X.
7. **Stufe 7: Google Sheets Audit Trail** – Zero-Storage Protokollierung in Google Sheets (API v4).

---

## 🚀 Lokale Entwicklung & Start

```bash
# 1. Abhängigkeiten installieren
npm ci --legacy-peer-deps

# 2. Entwicklungsserver starten (Vite Port 3000)
npm run dev

# 3. Produktions-Build erstellen
npm run build

# 4. Anwendungstests ausführen
npm test

# 5. Full-Stack Server starten
npm run start
```



## Production-readiness status

The production entry point is `server.ts`, bundled to `dist/server.cjs` by `npm run build`.
`server/index.ts` remains as a compatibility implementation until its route coverage has been compared; it is not removed as part of this hardening pass.

CI validates the lockfile with `npm ci`, typechecks the code, runs application tests, builds the frontend and production server bundle, and builds the production container. Cloud Run deployment is manual and is permitted only from `main` after these checks pass. The GitHub Actions Workload Identity Federation binding and the live Firestore database ID/location must still be verified against Google Cloud before deployment.
