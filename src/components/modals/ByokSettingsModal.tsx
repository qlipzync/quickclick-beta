import React, { useState } from 'react';
import { X, Key, ShieldCheck, Check, Sparkles } from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';

interface ByokSettingsModalProps {
  user: StreamerUser;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUser: (updatedUser: StreamerUser) => Promise<void> | void;
}

export const ByokSettingsModal: React.FC<ByokSettingsModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdateUser,
}) => {
  const [apiKey, setApiKey] = useState(user.byokConfig?.geminiApiKey || '');
  const [enabled, setEnabled] = useState(user.byokConfig?.enabled || false);

  if (!isOpen) return null;

  const handleSave = async () => {
    const updated: StreamerUser = {
      ...user,
      byokConfig: {
        enabled,
        geminiApiKey: apiKey.trim() || undefined,
        googleDriveFolderId: user.byokConfig?.googleDriveFolderId,
      },
    };
    await onUpdateUser(updated);
    onClose();
  };

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-[#09152b] to-[#050b18] p-6 sm:p-8 shadow-2xl space-y-6 text-zinc-100 backdrop:bg-black/80 backdrop:backdrop-blur-md block my-auto"
    >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white transition p-1"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-400 uppercase">
            <Key className="h-3.5 w-3.5" /> BRING YOUR OWN KEY (BYOK)
          </div>
          <h3 className="text-xl font-bold font-display text-white">
            Eigene API-Schlüssel
          </h3>
          <p className="text-xs text-zinc-400">
            Nutze deinen eigenen Google Gemini API Key für unbegrenzte kostenlose KI-Analysen.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
            <span className="text-xs font-semibold text-white">Eigene Schlüssel verwenden</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="rounded bg-zinc-800 text-cyan-600 h-4 w-4"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Google Gemini API Key
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-xl bg-zinc-900 border border-cyan-500/30 px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/20 cursor-pointer"
            >
              Speichern
            </button>
          </div>
        </div>
    </dialog>
  );
};
