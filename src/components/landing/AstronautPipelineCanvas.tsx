import React from 'react';
import { Rocket, Zap, ShieldCheck, Sparkles, Orbit } from 'lucide-react';

export const AstronautPipelineCanvas: React.FC = () => {
  return (
    <div className="w-full rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#10072b] to-[#080417] p-6 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Orbit className="h-5 w-5 text-purple-400 animate-spin" />
          <h4 className="text-sm font-bold text-white font-display">
            Orbitale Autopilot Pipeline
          </h4>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/30">
          Status: Flugbereit (0 MB RAM)
        </span>
      </div>

      <div className="h-44 rounded-xl bg-black/50 border border-purple-500/20 flex items-center justify-center relative overflow-hidden p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />
        <div className="flex items-center gap-4 sm:gap-8 relative z-10 text-center">
          <div className="space-y-1">
            <div className="h-10 w-10 mx-auto rounded-full bg-purple-600/30 border border-purple-400 flex items-center justify-center text-purple-200">
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono text-zinc-300 block">Twitch Go-Live</span>
          </div>

          <div className="h-0.5 w-8 sm:w-16 bg-gradient-to-r from-purple-500 to-fuchsia-500" />

          <div className="space-y-1">
            <div className="h-12 w-12 mx-auto rounded-full bg-fuchsia-600/30 border border-fuchsia-400 flex items-center justify-center text-fuchsia-200 shadow-lg shadow-fuchsia-600/30 animate-pulse">
              <Rocket className="h-6 w-6" />
            </div>
            <span className="text-[10px] font-mono text-fuchsia-300 font-bold block">RAM Transcoding</span>
          </div>

          <div className="h-0.5 w-8 sm:w-16 bg-gradient-to-r from-fuchsia-500 to-cyan-500" />

          <div className="space-y-1">
            <div className="h-10 w-10 mx-auto rounded-full bg-cyan-600/30 border border-cyan-400 flex items-center justify-center text-cyan-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-mono text-cyan-300 block">Omni-Publish</span>
          </div>
        </div>
      </div>
    </div>
  );
};
