import React from 'react';
import { Trophy, Gift, Users, Award, ShoppingBag, Copy, Check } from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';

interface TopReferrersLeaderboardProps {
  user: StreamerUser;
  onUpdateUser?: (updated: StreamerUser) => void;
  onOpenClipPacksModal?: () => void;
}

export const TopReferrersLeaderboard: React.FC<TopReferrersLeaderboardProps> = ({
  user,
  onUpdateUser,
  onOpenClipPacksModal,
}) => {
  const [copied, setCopied] = React.useState(false);
  const referralLink = `https://qlipzync.web.app/?ref=${user.channelName || user.name || 'streamer'}`;

  const copyRef = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaders = [
    { rank: 1, name: 'sh00trs.tv', referrals: 48, bonus: '480 Clips', badge: '🥇 Titan VIP' },
    { rank: 2, name: 'twoandahalfeafc', referrals: 35, bonus: '350 Clips', badge: '🥈 Pro Creator' },
    { rank: 3, name: user.name || 'Du', referrals: user.referralCount || 3, bonus: '30 Clips', badge: '🥉 Creator' },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-400" />
            <span>Community Referral Leaderboard</span>
          </h3>
          <p className="text-xs text-zinc-400">
            Empfiehl QlipZync an befreundete Streamer und erhalte pro aktivem Creator 10 Gratis-Clips!
          </p>
        </div>
        {onOpenClipPacksModal && (
          <button
            onClick={onOpenClipPacksModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md transition"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Clip-Packs anzeigen</span>
          </button>
        )}
      </div>

      {/* Referral Link Box */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="space-y-0.5 text-xs text-left w-full sm:w-auto">
          <span className="text-zinc-400 block font-semibold">Dein persönlicher Einladungslink:</span>
          <span className="font-mono text-purple-300 text-[11px] truncate block">{referralLink}</span>
        </div>
        <button
          onClick={copyRef}
          className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shrink-0"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Kopiert!' : 'Link kopieren'}</span>
        </button>
      </div>

      {/* Leaderboard Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
            <tr>
              <th className="p-3">Rang</th>
              <th className="p-3">Streamer</th>
              <th className="p-3">Erfolgreiche Referrals</th>
              <th className="p-3">Erhaltene Bonus-Clips</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {leaders.map((lead) => (
              <tr key={lead.rank} className="hover:bg-zinc-900/40 transition">
                <td className="p-3 font-mono font-bold text-amber-400">#{lead.rank}</td>
                <td className="p-3 font-semibold text-white">{lead.name}</td>
                <td className="p-3 font-mono text-zinc-300">{lead.referrals} Streamer</td>
                <td className="p-3 font-mono font-bold text-emerald-400">{lead.bonus}</td>
                <td className="p-3 text-[10px] text-purple-300 font-mono">{lead.badge}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
