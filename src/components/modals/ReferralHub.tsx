import React, { useState } from 'react';
import { Gift, Copy, Check, Users, Trophy } from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';

interface ReferralHubProps {
  user: StreamerUser;
  onUpdateUser?: (updated: StreamerUser) => void;
}

export const ReferralHub: React.FC<ReferralHubProps> = ({ user, onUpdateUser }) => {
  const [copied, setCopied] = useState(false);
  const link = `https://qlipzync.web.app/?ref=${user.channelName || user.name || 'creator'}`;

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
        <div className="h-10 w-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
          <Gift className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white font-display">
            Streamer-Empfehlungs & Bonus Hub
          </h3>
          <p className="text-xs text-zinc-400">
            Lade Creator ein und sichere dir permanente Kontingent-Boni.
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="space-y-0.5 text-xs text-left w-full sm:w-auto">
          <span className="text-zinc-400 block font-semibold">Dein Einladungs-Link:</span>
          <span className="font-mono text-purple-300 text-[11px] truncate block">{link}</span>
        </div>
        <button
          onClick={copy}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shrink-0"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Kopiert!' : 'Kopieren'}</span>
        </button>
      </div>
    </div>
  );
};
