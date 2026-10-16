import React from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { DashboardTopup } from '../DashboardTopup';

interface ClipPacksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuyPackage?: (pkg: any) => void;
  currentClipsUsed?: number;
  currentClipsTotal?: number;
  currentClipsLimit?: number;
  bonusClips?: number;
  userId?: string;
  onTopupSuccess?: (addedClips: number, chargedEur: number) => void;
}

export const ClipPacksModal: React.FC<ClipPacksModalProps> = ({
  isOpen,
  onClose,
  currentClipsUsed = 0,
  currentClipsTotal,
  currentClipsLimit,
  userId = 'usr_94821a',
  onTopupSuccess,
}) => {
  const effectiveTotal = currentClipsLimit ?? currentClipsTotal ?? 100;
  if (!isOpen) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-[#0a1420] to-[#060b14] p-6 sm:p-8 shadow-2xl space-y-6 text-zinc-100 backdrop:bg-black/80 backdrop:backdrop-blur-md block my-auto text-left"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 text-zinc-400 hover:text-white transition p-1 cursor-pointer"
        aria-label="Schließen"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 uppercase">
          <ShoppingBag className="h-3.5 w-3.5" /> DYNAMISCHES CLIP-TOP-UP
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-white font-display">
          Kontingent flexibel aufladen
        </h3>
        <p className="text-xs text-zinc-400">
          Aktuelles Profil: <span className="text-emerald-300 font-mono font-bold">{userId}</span> • Verbleibend:{' '}
          <span className="text-emerald-400 font-bold">534 Clips</span> (Basis-Abo: {effectiveTotal} Clips/Mo • Einheitspreis: 0,2907 €)
        </p>
      </div>

      <div className="flex flex-col items-center">
        <DashboardTopup
          userId={userId}
          onSuccess={(addedClips, chargedEur) => {
            if (onTopupSuccess) {
              onTopupSuccess(addedClips, chargedEur);
            }
          }}
          onClose={onClose}
        />
      </div>
    </dialog>
  );
};
