import React from 'react';
import { Flame, Sparkles, TrendingUp, Cpu, Radio } from 'lucide-react';

export const ViralPeakGraph: React.FC = () => {
  return (
    <div className="w-full rounded-2xl border border-purple-500/30 bg-gradient-to-b from-[#150a32] to-[#0a051c] p-5 sm:p-6 shadow-2xl relative overflow-hidden">
      {/* Header telemetry badge */}
      <div className="flex items-center justify-between border-b border-purple-500/20 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono text-emerald-400 uppercase font-bold tracking-wider">
            Live Stream Hook-Telemetry (Gemini 2.5)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-500/30">
          <Cpu className="h-3 w-3" /> /dev/shm: 0 MB Disk
        </div>
      </div>

      {/* Simulated Waveform & Peak Detection */}
      <div className="space-y-4">
        <div className="h-32 sm:h-36 w-full flex items-end justify-between gap-1 sm:gap-1.5 px-2 py-3 bg-black/40 rounded-xl border border-purple-500/20 relative">
          {/* Highlight indicator at peak */}
          <div className="absolute top-2 left-[58%] -translate-x-1/2 rounded-md bg-fuchsia-600 px-2 py-0.5 text-[10px] font-black text-white shadow-lg flex items-center gap-1 animate-bounce">
            <Flame className="h-3 w-3 text-amber-300" />
            <span>VIRAL PEAK: 98% SCORE</span>
          </div>

          {[
            25, 30, 45, 20, 60, 40, 35, 75, 50, 65, 88, 98, 92, 55, 40, 30, 60, 45, 80, 50, 35,
          ].map((val, idx) => {
            const isPeak = idx === 11;
            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
              >
                <div
                  style={{ height: `${val}%` }}
                  className={`w-full rounded-t-sm transition-all duration-300 ${
                    isPeak
                      ? 'bg-gradient-to-t from-fuchsia-600 to-pink-400 shadow-[0_0_12px_rgba(217,70,239,0.8)]'
                      : val > 65
                      ? 'bg-purple-500/80'
                      : 'bg-purple-900/40'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Realtime stats grid */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/20">
            <span className="text-[10px] font-mono text-zinc-400 block uppercase">Audio Peak</span>
            <span className="font-bold text-white text-sm">+18.4 dB (Lachflash)</span>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/20">
            <span className="text-[10px] font-mono text-zinc-400 block uppercase">Chat Velo</span>
            <span className="font-bold text-fuchsia-300 text-sm">480 Msg / Min</span>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/20">
            <span className="text-[10px] font-mono text-zinc-400 block uppercase">Vertikal Render</span>
            <span className="font-bold text-emerald-400 text-sm">1080x1920 (9:16)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
