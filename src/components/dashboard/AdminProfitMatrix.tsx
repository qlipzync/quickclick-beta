import React from 'react';
import { Crown, Sparkles } from 'lucide-react';
import { calculateVerifiedTier } from '../../services/pricingEngine';

const QUOTA_PRESETS = [50, 100, 250, 1000, 5000, 20000];

export const AdminProfitMatrix: React.FC = () => {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-[#0e0a1a] p-6 space-y-6 shadow-2xl text-zinc-100">
      <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">
              MASTER ADMIN COCKPIT
            </span>
            <h3 className="text-lg font-bold text-white font-display">
              Dynamische SaaS Gewinn- & Margenmatrix (1 - 20.000 Clips)
            </h3>
          </div>
        </div>
        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
          Reingewinn gesichert
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
            <tr>
              <th className="p-3">Clip-Volumen</th>
              <th className="p-3">Stückpreis</th>
              <th className="p-3">Kundenpreis</th>
              <th className="p-3">Rabatt</th>
              <th className="p-3">GCP RAM Server</th>
              <th className="p-3">Payment Fee</th>
              <th className="p-3">Netto-Gewinn</th>
              <th className="p-3">Marge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-sans">
            {QUOTA_PRESETS.map((clips) => {
              const tier = calculateVerifiedTier(clips)!;
              const serverCost = Number((clips * 0.0012).toFixed(2));
              const paymentFee = Number((0.25 + tier.monthlyTotalEur * 0.015).toFixed(2));
              const netProfit = Number((tier.monthlyTotalEur - serverCost - paymentFee).toFixed(2));
              const margin = Math.round((netProfit / tier.monthlyTotalEur) * 100);

              return (
                <tr key={clips} className="hover:bg-zinc-900/40 transition">
                  <td className="p-3 font-semibold text-white font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>{clips.toLocaleString()} Clips</span>
                  </td>
                  <td className="p-3 font-mono text-cyan-300">
                    {(tier.unitPriceEur * 100).toFixed(2)} ct
                  </td>
                  <td className="p-3 font-mono font-bold text-white">
                    {tier.monthlyTotalEur.toFixed(2)} €
                  </td>
                  <td className="p-3 font-mono text-emerald-400">
                    -{tier.discountPercent}%
                  </td>
                  <td className="p-3 font-mono text-zinc-400">
                    {serverCost.toFixed(2)} €
                  </td>
                  <td className="p-3 font-mono text-zinc-400">
                    {paymentFee.toFixed(2)} €
                  </td>
                  <td className="p-3 font-mono font-bold text-emerald-400">
                    +{netProfit.toFixed(2)} €
                  </td>
                  <td className="p-3 font-mono text-emerald-300 font-bold">
                    {margin}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
