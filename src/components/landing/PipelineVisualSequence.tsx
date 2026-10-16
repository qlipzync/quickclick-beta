import React from 'react';
import { Tv, Radio, Clock, Sparkles, Film, Share2, FileSpreadsheet } from 'lucide-react';

export const PipelineVisualSequence: React.FC = () => {
  const stages = [
    { num: 1, title: 'Twitch EventSub', desc: '0s Latenz Go-Live Webhook', icon: Tv, iconColor: 'text-purple-400', badgeColor: 'border-purple-500/40 text-purple-300 bg-purple-950/70' },
    { num: 2, title: 'Discord & Telegram', desc: 'Auto Live-Feed & Invites', icon: Radio, iconColor: 'text-indigo-400', badgeColor: 'border-indigo-500/40 text-indigo-300 bg-indigo-950/70' },
    { num: 3, title: '15m Reminder', desc: 'Automatischer Folge-Post', icon: Clock, iconColor: 'text-violet-400', badgeColor: 'border-violet-500/40 text-violet-300 bg-violet-950/70' },
    { num: 4, title: 'Farewell Outro', desc: 'Offline-Bedankung & Stats', icon: Sparkles, iconColor: 'text-fuchsia-400', badgeColor: 'border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-950/70' },
    { num: 5, title: '5m Cooldown & RAM', desc: 'Zero-Storage /dev/shm', icon: Film, iconColor: 'text-purple-300', badgeColor: 'border-purple-500/40 text-purple-200 bg-purple-950/70' },
    { num: 6, title: 'Omni-Posting', desc: 'TikTok, Shorts, Reels', icon: Share2, iconColor: 'text-fuchsia-400', badgeColor: 'border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-950/70' },
    { num: 7, title: 'Google Sheets', desc: 'Drive Logging (0 MB Disk)', icon: FileSpreadsheet, iconColor: 'text-purple-400', badgeColor: 'border-purple-500/40 text-purple-300 bg-purple-950/70' },
  ];

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#13082f] via-[#0c0520] to-[#080417] p-6 shadow-2xl space-y-4 relative overflow-hidden">
      {/* Ambient wave-glow background overlay */}
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-purple-600/15 blur-2xl animate-wave-pulse" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-fuchsia-600/10 blur-2xl" aria-hidden="true" />

      <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
        <h4 className="text-sm font-bold text-white font-display flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
          <span>7-Stufen Autopilot Pipeline Sequenz</span>
        </h4>
        <span className="text-[10px] font-mono text-purple-200 bg-purple-900/60 px-2.5 py-1 rounded-full border border-purple-500/30 font-semibold shadow-sm">
          Vollautonom (0 ms Kaltstart)
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 relative z-10">
        {stages.map((stg) => {
          const Icon = stg.icon;
          return (
            <div
              key={stg.num}
              className="rounded-xl border border-purple-500/25 bg-gradient-to-b from-[#150a36]/90 via-[#0e0624]/95 to-[#09041a] p-3.5 flex flex-col justify-between space-y-3 text-left hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-950/40 transition-all duration-200 group"
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border ${stg.badgeColor}`}>
                  #{stg.num}
                </span>
                <div className="p-1 rounded-lg bg-purple-500/10 border border-purple-500/20 group-hover:scale-110 transition-transform">
                  <Icon className={`h-4 w-4 ${stg.iconColor}`} />
                </div>
              </div>
              <div>
                <h5 className="text-xs font-bold text-white leading-tight group-hover:text-purple-200 transition-colors">
                  {stg.title}
                </h5>
                <p className="text-[10px] text-purple-200/70 mt-1 leading-snug">
                  {stg.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
