#!/usr/bin/env bash
# ==============================================================================
# QlipZync - Firebase Hosting CDN & Firestore Rules Deployment Script
# Projekt: qlipzync | Datenbank: ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91
# ==============================================================================
set -euo pipefail

PROJECT_ID="qlipzync"
FIRESTORE_DB="ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91"

echo ">> [1/4] Schreibe optimierte firebase.json (Hosting-Rewrite auf Cloud Run)..."
cat << 'FIREBASE_EOF' > firebase.json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "quickclick-app",
          "region": "europe-west3"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "database": "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91",
    "rules": "firestore.rules"
  }
}
FIREBASE_EOF

echo ">> [2/4] Schreibe gehärtete firestore.rules (Default-Deny, RBAC, Admin-Isolation)..."
cat << 'RULES_EOF' > firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    function isMasterAdmin() {
      return isAuthenticated() && (
        (request.auth.token.email != null && request.auth.token.email.lower() == 'robert.f.telekom@gmail.com') ||
        request.auth.token.admin == true ||
        request.auth.token.role == 'admin'
      );
    }
    function hasActiveSubscription(userId) {
      return isMasterAdmin() || request.auth.token.hasActiveSubscription == true;
    }

    // Default Deny
    match /{document=**} {
      allow read, write: if false;
    }

    match /users/{userId} {
      allow read: if isOwner(userId) || isMasterAdmin();
      allow create: if isAuthenticated() && request.auth.uid == userId;
      allow update: if (
        isOwner(userId) &&
        !request.resource.data.diff(resource.data).affectedKeys().hasAny([
          'role', 'isAdmin', 'subscriptionPlan', 'hasActiveSubscription', 'adminOverrideActive', 'clipsLimitTotal'
        ])
      ) || isMasterAdmin();
      allow delete: if isMasterAdmin();
    }

    match /users/{userId}/channelConfigs/{configId} {
      allow read: if isOwner(userId) || isMasterAdmin();
      allow write: if (isOwner(userId) && hasActiveSubscription(userId)) || isMasterAdmin();
    }

    match /users/{userId}/wallet/{document=**} {
      allow read: if isOwner(userId) || isMasterAdmin();
      allow write: if false; // Ausschließlich über Cloud Run Backend Ledger veränderbar
    }

    match /users/{userId}/clips/{clipId} {
      allow read, write: if isOwner(userId) || isMasterAdmin();
    }

    match /users/{userId}/invoices/{invoiceId} {
      allow read: if isOwner(userId) || isMasterAdmin();
      allow write: if false;
    }
  }
}
RULES_EOF

echo ">> [3/4] Hole GCP OAuth Access-Token für Firebase CLI..."
ACCESS_TOKEN=$(gcloud auth print-access-token)

echo ">> [4/4] Deploye Firestore-Sicherheitsregeln & Firebase Hosting Edge-CDN..."
GOOGLE_OAUTH_ACCESS_TOKEN="${ACCESS_TOKEN}" firebase deploy --only firestore:rules --project "${PROJECT_ID}"
GOOGLE_OAUTH_ACCESS_TOKEN="${ACCESS_TOKEN}" firebase deploy --only hosting --project "${PROJECT_ID}"

echo "================================================================="
echo "   FIREBASE SYSTEM-DEPLOYMENT ERFOLGREICH ABGESCHLOSSEN!        "
echo "   Hosting CDN URL: https://qlipzync.web.app                    "
echo "================================================================="
