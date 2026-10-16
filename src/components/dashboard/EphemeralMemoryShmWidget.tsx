import React from 'react';
import { Cpu, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

export const EphemeralMemoryShmWidget: React.FC = () => {
  return (
    <div className="rounded-2xl border border-purple-500/25 bg-gradient-to-r from-[#12082b] via-[#090518] to-[#12082b] p-4 sm:p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
          <Cpu className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-white font-display">
              Zero-Storage RAM Engine (/dev/shm)
            </h4>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold">
              0,00 MB Disk
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Flüchtige Transkodierung im Google Cloud Run Arbeitsspeicher (Keine persistente Disk-Ablage).
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-mono">
        <div className="text-center sm:text-right">
          <span className="text-[10px] text-zinc-500 uppercase block">RAM Puffer</span>
          <span className="text-emerald-400 font-bold">1 GiB Bereitgestellt</span>
        </div>
        <div className="text-center sm:text-right">
          <span className="text-[10px] text-zinc-500 uppercase block">Datenschutz</span>
          <span className="text-purple-300 font-bold">DSGVO Art. 5 Konform</span>
        </div>
      </div>
    </div>
  );
};
