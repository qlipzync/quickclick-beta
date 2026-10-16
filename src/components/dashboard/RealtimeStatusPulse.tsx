import React from 'react';
import { Radio } from 'lucide-react';

interface RealtimeStatusPulseProps {
  isLive?: boolean;
}

export const RealtimeStatusPulse: React.FC<RealtimeStatusPulseProps> = ({ isLive = false }) => {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          isLive ? 'bg-red-500 animate-ping' : 'bg-emerald-400 animate-pulse'
        }`}
      />
      <span className="text-xs font-mono font-bold text-zinc-300">
        {isLive ? 'LIVE AUF TWITCH' : 'SYSTEM OPERATIONAL'}
      </span>
    </div>
  );
};
