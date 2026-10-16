import React from 'react';
import { Tv, FileSpreadsheet, Share2, Bot, Database, Server, Cpu, Sparkles, CheckCircle2 } from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';
import { FIRESTORE_DATABASE_TOPOLOGY } from '../../config/quickclick-config';
import { DashboardIntegrations } from './DashboardIntegrations';
import { ApiKeyManagement } from './ApiKeyManagement';

interface LiveIntegrationsDashboardProps {
  user: StreamerUser;
  onUpdateUser?: (updated: StreamerUser) => void;
}

export const LiveIntegrationsDashboard: React.FC<LiveIntegrationsDashboardProps> = ({
  user,
}) => {
  const integrations = [
    {
      name: 'Twitch Helix & EventSub',
      desc: 'Live-Status, Stream-Info & Video-Clips',
      connected: Boolean(user.channelName),
      account: user.channelName ? `twitch.tv/${user.channelName}` : 'Nicht verknüpft',
      icon: Tv,
      color: 'text-[#9146FF]',
    },
    {
      name: 'Google Sheets & Drive',
      desc: 'Zero-Storage Cloud-Protokollierung',
      connected: Boolean(user.googleSheetId),
      account: user.googleSheetId ? `Tabelle ID: ${user.googleSheetId}` : 'Nicht verknüpft',
      icon: FileSpreadsheet,
      color: 'text-emerald-400',
    },
    {
      name: 'TikTok Video API',
      desc: 'Automatischer 9:16 Video Upload',
      connected: true,
      account: 'Verknüpft via OAuth 2.0',
      icon: Share2,
      color: 'text-cyan-400',
    },
    {
      name: 'YouTube Shorts',
      desc: 'YouTube Data API v3 Upload',
      connected: true,
      account: 'Verknüpft via Google Workspace',
      icon: Share2,
      color: 'text-red-400',
    },
    {
      name: 'Discord & Telegram Bot',
      desc: 'Community Benachrichtigungen & Live-Feed',
      connected: true,
      account: 'Webhook Aktiv',
      icon: Bot,
      color: 'text-indigo-400',
    },
  ];

  const dbList = [
    {
      key: 'prod',
      ...FIRESTORE_DATABASE_TOPOLOGY.prod,
      badge: 'PRODUKTION (SaaS & KI)',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      icon: Server,
    },
    {
      key: 'dev',
      ...FIRESTORE_DATABASE_TOPOLOGY.dev,
      badge: 'ENTWICKLUNG & STAGING',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      icon: Database,
    },
  ];

  return (
    <div className="space-y-6">
      {/* 2-Database Firestore Architecture Section */}
      <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#140833]/90 via-[#0c0522]/95 to-[#09041a] p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-purple-500/20 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-purple-400" />
              <h3 className="text-base font-bold text-white font-display">
                Konsolidierte 2-Datenbanken-Architektur
              </h3>
            </div>
            <p className="text-xs text-purple-200/70 mt-1">
              Volle Firestore-Skalierbarkeit ohne künstliche Fragmentierung. Optimiert für Security Rules & Kosten.
            </p>
          </div>
          <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 border border-purple-500/40 text-purple-300">
            db.prod (qlipzync-prod) | db.dev ((default))
          </span>
        </div>

        {/* 2 Primary Databases */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dbList.map((dbItem) => {
            const Icon = dbItem.icon;
            return (
              <div
                key={dbItem.key}
                className="rounded-xl border border-purple-500/30 bg-black/50 p-5 space-y-3 hover:border-purple-500/50 transition relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-purple-900/50 border border-purple-500/30 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-purple-300" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{dbItem.purpose}</h4>
                      <span className="text-[10px] font-mono text-purple-300/70">
                        Region: {dbItem.region}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${dbItem.badgeColor}`}>
                    {dbItem.badge}
                  </span>
                </div>
                <p className="text-[11px] text-purple-200/80 leading-relaxed">
                  {dbItem.description}
                </p>
                <div className="flex items-center justify-between text-[11px] font-mono text-purple-300/70 bg-purple-950/40 rounded-lg px-3 py-1.5 border border-purple-500/20">
                  <span className="text-zinc-400">Instanz-ID:</span>
                  <span className="text-purple-200 font-semibold truncate ml-2 max-w-[220px]" title={dbItem.id}>
                    {dbItem.id}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Architectural Advantages Callout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-3 space-y-1">
            <h5 className="text-[11px] font-bold text-purple-200 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              1. Nahtlose Security Rules
            </h5>
            <p className="text-[10px] text-purple-200/70 leading-normal">
              Keine Cross-Database-Limits: <code className="text-purple-300">get()</code> & <code className="text-purple-300">exists()</code> prüfen Nutzer-Abonnements für KI-Clips direkt im Regelsatz.
            </p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-3 space-y-1">
            <h5 className="text-[11px] font-bold text-purple-200 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-purple-400 shrink-0" />
              2. Minimierte Komplexität
            </h5>
            <p className="text-[10px] text-purple-200/70 leading-normal">
              1 zentrales Set an Regeln, einheitliche Indizes und konsolidierte Backup-Pipelines statt 4-fachem Synchronisationsaufwand.
            </p>
          </div>
          <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-3 space-y-1">
            <h5 className="text-[11px] font-bold text-purple-200 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              3. Kostenoptimierung
            </h5>
            <p className="text-[10px] text-purple-200/70 leading-normal">
              Das tägliche No-Cost Free Tier (50k Read, 20k Write) gilt exklusiv für <code className="text-cyan-300">(default)</code> und spart Staging-Kosten.
            </p>
          </div>
        </div>
      </div>


      {/* KMS-Encrypted Zero-Token Platform Controls (Twitch, YouTube, TikTok) */}
      <DashboardIntegrations />

      {/* Personal Access API Keys Management (X-API-Key for OBS, Make.com, Python & cURL) */}
      <ApiKeyManagement />

      {/* Connected Accounts & Platform Overview */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-6">
        <div>
          <h3 className="text-base font-bold text-white font-display">
            Verknüpfte Konten & Endpunkte (Architektur-Übersicht)
          </h3>
          <p className="text-xs text-zinc-400">
            Verwalte alle Plattform-Verbindungen für das autonome Omni-Posting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    <Icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-white">{item.name}</h4>
                    <p className="text-[11px] text-zinc-400">{item.desc}</p>
                    <span className="text-[10px] font-mono text-zinc-500 block">{item.account}</span>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                    item.connected
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {item.connected ? 'Aktiv' : 'Getrennt'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

