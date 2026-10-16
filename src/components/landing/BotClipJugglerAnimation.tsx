import React from 'react';
import { Tv, MessageSquare, Share2, Clock, Zap, Radio, Bell, HardDrive } from 'lucide-react';

interface BotClipJugglerAnimationProps {
  autoPlay?: boolean;
  activeStep: 1 | 2 | 3;
  onStepChange?: (step: 1 | 2 | 3) => void;
}

export const BotClipJugglerAnimation: React.FC<BotClipJugglerAnimationProps> = ({
  activeStep,
  onStepChange,
}) => {
  return (
    <div className="w-full rounded-2xl border border-purple-500/25 bg-gradient-to-b from-[#13072e] via-[#0b051c] to-[#070314] p-6 sm:p-8 shadow-xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row items-stretch justify-between gap-6 relative z-10">
        {/* Step 1 Visual */}
        <div
          onClick={() => onStepChange?.(1)}
          className={`flex-1 rounded-xl p-5 border transition cursor-pointer text-left flex flex-col justify-between ${
            activeStep === 1
              ? 'border-purple-400 bg-purple-950/50 shadow-lg shadow-purple-500/20'
              : 'border-zinc-800 bg-zinc-900/40 opacity-75 hover:opacity-100 hover:border-purple-500/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Radio className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono text-purple-300 font-bold px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                SCHRITT 1
              </span>
            </div>
            <h4 className="text-sm font-bold text-white font-display">
              Live-Erkennung & Doppel-Einladung
            </h4>
            <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
              Erkennt Online/Offline-Status auf Twitch in Echtzeit. Postet sofort den 1. Einladungslink auf Social Media & nach 15 Minuten Streamzeit die 2. Einladung.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-purple-500/20 text-[10px] font-mono text-purple-200">
            <span className="bg-purple-900/40 px-2 py-0.5 rounded">EventSub</span>
            <span className="bg-purple-900/40 px-2 py-0.5 rounded">1. Invite sofort</span>
            <span className="bg-purple-900/40 px-2 py-0.5 rounded">2. Invite @ 15 Min</span>
          </div>
        </div>

        <div className="text-purple-500 hidden md:flex items-center justify-center text-xl font-bold">
          →
        </div>

        {/* Step 2 Visual */}
        <div
          onClick={() => onStepChange?.(2)}
          className={`flex-1 rounded-xl p-5 border transition cursor-pointer text-left flex flex-col justify-between ${
            activeStep === 2
              ? 'border-fuchsia-400 bg-fuchsia-950/50 shadow-lg shadow-fuchsia-500/20'
              : 'border-zinc-800 bg-zinc-900/40 opacity-75 hover:opacity-100 hover:border-fuchsia-500/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-fuchsia-600/20 border border-fuchsia-500/40 flex items-center justify-center text-fuchsia-300">
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono text-fuchsia-300 font-bold px-2 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30">
                SCHRITT 2
              </span>
            </div>
            <h4 className="text-sm font-bold text-white font-display">
              10-Min Bot-Heartbeat & Verabschiedung
            </h4>
            <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
              Sendet alle 10 Minuten Live-Updates (Viewer, Uptime, Game) an Discord & Telegram Chat-Bots. Postet automatische Danksagungen & Verabschiedung bei Offline.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-fuchsia-500/20 text-[10px] font-mono text-fuchsia-200">
            <span className="bg-fuchsia-900/40 px-2 py-0.5 rounded">Alle 10 Min Info</span>
            <span className="bg-fuchsia-900/40 px-2 py-0.5 rounded">Discord & Telegram</span>
            <span className="bg-fuchsia-900/40 px-2 py-0.5 rounded">Social Verabschiedung</span>
          </div>
        </div>

        <div className="text-fuchsia-500 hidden md:flex items-center justify-center text-xl font-bold">
          →
        </div>

        {/* Step 3 Visual */}
        <div
          onClick={() => onStepChange?.(3)}
          className={`flex-1 rounded-xl p-5 border transition cursor-pointer text-left flex flex-col justify-between ${
            activeStep === 3
              ? 'border-cyan-400 bg-cyan-950/50 shadow-lg shadow-cyan-500/20'
              : 'border-zinc-800 bg-zinc-900/40 opacity-75 hover:opacity-100 hover:border-cyan-500/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                <HardDrive className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-mono text-cyan-300 font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30">
                SCHRITT 3
              </span>
            </div>
            <h4 className="text-sm font-bold text-white font-display">
              5 Min Puffer, RAM Ingest & Multi-Post
            </h4>
            <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
              Wartet nach Offline 5 Min. Holt Twitch Clips per URL/DNS ins flüchtige RAM (/dev/shm). Verarbeitet Highlights & postet Texte, Bilder & Clips autonom.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-cyan-500/20 text-[10px] font-mono text-cyan-200">
            <span className="bg-cyan-900/40 px-2 py-0.5 rounded">5 Min Cooldown</span>
            <span className="bg-cyan-900/40 px-2 py-0.5 rounded">DNS/RAM Ingest</span>
            <span className="bg-cyan-900/40 px-2 py-0.5 rounded">Texte, Bilder & Clips</span>
          </div>
        </div>
      </div>
    </div>
  );
};
