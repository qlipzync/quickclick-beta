export const FIREBASE_PUBLIC_CONFIG = {
  apiKey: "AIzaSyB209DOGAYYqvZcD6KuQ4qvE3Z4RACiooM",
  authDomain: "qlipzync.firebaseapp.com",
  projectId: "qlipzync",
  storageBucket: "qlipzync.firebasestorage.app",
  messagingSenderId: "248792984033",
  appId: "1:248792984033:web:3c55dbd341eb24f6300aa0",
  measurementId: "G-X5B6GPCF8H"
} as const;

export const GCP_PROJECT_METADATA = {
  projectName: "quickclick",
  projectId: "qlipzync",
  organization: "QlipZync",
  publicName: "QlipZync",
  supportEmail: "robert.f.telekom@gmail.com",
  defaultRegion: "europe-west3",
  databaseId: "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91",
  fcmSenderId: "248792984033"
} as const;

export const AI_STUDIO_LIVE_ENDPOINTS = {
  productionHostingUrl: "https://qlipzync.web.app",
  firebaseAppDomain: "https://qlipzync.firebaseapp.com",
  apiBaseUrl: "/api",
  twitchEventSubCallbackUrl: "/api/webhooks/twitch",
  databaseId: "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91"
} as const;

export const EXTENDED_PIPELINE_CONFIG = {
  streamInfoIntervalMinutes: 10,
  reminderDelayMinutes: 15,
  offlineCooldownMinutes: 5,
  zeroStorageRamOnly: true,
  omniPostingPlatforms: ["tiktok", "youtube_shorts", "instagram_reels", "twitter_x"],
  googleSheetsLogColumns: [
    "timestamp",
    "channelName",
    "eventType",
    "streamTitle",
    "viewerCount",
    "liveInviteUrl",
    "reminderPostUrl",
    "farewellStatus",
    "tiktokUrl",
    "youtubeShortsUrl",
    "instagramReelsUrl",
    "twitterUrl",
    "discordBotStatus",
    "telegramBotStatus",
    "processingStatus"
  ]
} as const;

export const QUOTA_TIERS = {
  free: { dailyLimit: 1, margin: "40%", monthlyClips: 15 },
  creator: { dailyLimit: 5, margin: "30%", monthlyClips: 30 },
  pro: { dailyLimit: 10, margin: "20%", monthlyClips: 150 },
  elite: { dailyLimit: 20, margin: "15%", monthlyClips: 600 }
} as const;

export const FIRESTORE_DATABASE_TOPOLOGY = {
  prod: {
    id: "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91",
    region: "europe-west1",
    purpose: "SaaS-Produktionsumgebung (Konsolidiert)",
    description: "Alle Live-Nutzerdaten, Rechnungen, Kanalkonfigurationen, bearbeitete Clips & KI-Modul-Metadaten. Ermöglicht nahtlose get() Security Rules ohne Cross-Database-Grenzen."
  },
  dev: {
    id: "(default)",
    region: "europe-west1",
    purpose: "Entwicklung, Staging & Sandbox",
    description: "Sandbox-Umgebung für lokales Testen, CI/CD-Pipelines und Staging mit täglichem No-Cost Free Tier."
  },
  // Kompatibilitäts-Aliase: Leiten auf die konsolidierte Produktions-DB weiter
  aiStudio: {
    id: "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91",
    region: "europe-west1",
    purpose: "KI-Metadaten (In ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91 konsolidiert)",
    description: "Konsolidiert in ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91 für atomare Transaktionen und direkte Sicherheitsregel-Prüfungen."
  },
  autonomous: {
    id: "ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91",
    region: "europe-west1",
    purpose: "Autonome Agenten & Bots (In ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91 konsolidiert)",
    description: "Konsolidiert in ai-studio-quickclick-003fd948-cf64-489f-9030-863f460c6c91 für zentrale Auditierung und nahtlose Quota-Validierung."
  }
} as const;


