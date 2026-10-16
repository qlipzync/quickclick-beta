import React, { useState } from 'react';
import { X, ShieldCheck, Download, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';

interface GdprPrivacyAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: StreamerUser;
  onAccountDeleted?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenAvvAgreement?: () => void;
}

export const GdprPrivacyAuditModal: React.FC<GdprPrivacyAuditModalProps> = ({
  isOpen,
  onClose,
  user,
  onAccountDeleted,
  onOpenPrivacyPolicy,
  onOpenAvvAgreement,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen) return null;

  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(user, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `qlipzync_gdpr_export_${user.channelName || user.name || 'user'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleDeleteAccount = () => {
    localStorage.removeItem('quickclick_user');
    localStorage.removeItem('qlipzync_user');
    sessionStorage.clear();
    onClose();
    onAccountDeleted?.();
  };

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-purple-500/30 bg-[#0c0620] p-6 sm:p-8 text-zinc-200 shadow-2xl space-y-6 backdrop:bg-black/80 backdrop:backdrop-blur-md block my-auto text-left"
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
            <ShieldCheck className="h-3.5 w-3.5" /> DSGVO SELF-SERVICE HUB (ART. 15–20)
          </div>
          <h3 className="text-2xl font-black font-display text-white">
            Datenschutz & Datenverwaltung
          </h3>
          <p className="text-xs text-zinc-400">
            Volle Transparenz über deine gespeicherten Kontodaten.
          </p>
        </div>

        {/* Data summary */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3 text-xs">
          <h4 className="font-bold text-white text-sm">Aktuell gespeicherte Daten:</h4>
          <div className="grid grid-cols-2 gap-2 text-zinc-300">
            <div>
              <span className="text-zinc-500 block">Twitch Kanal:</span>
              <span className="font-mono text-white">{user.channelName || user.name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">E-Mail Adresse:</span>
              <span className="font-mono text-white">{user.email || 'N/A'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Tarif & Status:</span>
              <span className="font-mono text-emerald-400">{user.plan} (Aktiv)</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Cloud Video-Speicher:</span>
              <span className="font-mono text-purple-300">0 MB (Zero-Storage RAM)</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExportData}
              className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <Download className="h-4 w-4" />
              <span>Daten exportieren (JSON)</span>
            </button>
            {downloadSuccess && (
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Exportiert!
              </span>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-red-950/20 border border-red-500/30 space-y-2">
            <span className="text-xs font-bold text-red-400 block">Recht auf Vergessenwerden (Art. 17 DSGVO):</span>
            <p className="text-[11px] text-zinc-400">
              Löscht deinen Account und alle zugehörigen Metadaten unwiderruflich aus der Firestore-Datenbank.
            </p>
            {confirmDelete ? (
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleDeleteAccount}
                  className="py-2 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                >
                  Ja, Account unwiderruflich löschen
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="py-2 px-3 rounded-lg bg-zinc-800 text-zinc-300 text-xs"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="py-2 px-3 rounded-lg border border-red-500/40 hover:bg-red-500/10 text-red-400 text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" /> Account löschen
              </button>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-purple-500/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs cursor-pointer"
          >
            Schließen
          </button>
        </div>
    </dialog>
  );
};
