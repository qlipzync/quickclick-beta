import React, { useState } from 'react';
import { X, Tv, Check, Sparkles, ArrowRight, ShieldCheck, Settings } from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';

interface ChannelSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  user: StreamerUser;
  onUpdateUser: (updated: StreamerUser) => void;
  onOpen2FA?: () => void;
}

export const ChannelSetupWizard: React.FC<ChannelSetupWizardProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateUser,
  onOpen2FA,
}) => {
  const [channelName, setChannelName] = useState(user.channelName || user.name || '');
  const [autoPublish, setAutoPublish] = useState(user.settings?.autoPublish ?? true);
  const [cropMode, setCropMode] = useState<'facecam_top_gameplay_bottom' | 'center' | 'split'>(
    user.settings?.verticalCropMode ?? 'facecam_top_gameplay_bottom'
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    user.settings?.targetPlatforms ?? ['tiktok', 'youtube_shorts', 'instagram_reels']
  );

  if (!isOpen) return null;

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((item) => item !== p) : [...prev, p]
    );
  };

  const handleSave = () => {
    const updated: StreamerUser = {
      ...user,
      channelName: channelName.trim() || user.channelName,
      isFullyConfigured: true,
      settings: {
        autoPublish,
        verticalCropMode: cropMode,
        aiSubtitlesEnabled: true,
        aiHooksEnabled: true,
        cooldownMinutes: 5,
        notificationDiscord: true,
        notificationTelegram: false,
        targetPlatforms: selectedPlatforms,
      },
    };
    onUpdateUser(updated);
    onClose();
  };

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-purple-500/30 bg-gradient-to-b from-[#130a2a] to-[#080518] p-6 sm:p-8 shadow-2xl space-y-6 text-zinc-100 backdrop:bg-black/80 backdrop:backdrop-blur-md block my-auto text-left"
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
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-purple-400 uppercase">
            <Settings className="h-3.5 w-3.5" /> AUTONOMES KANAL-SETUP
          </div>
          <h3 className="text-xl font-bold font-display text-white">
            Twitch & Social Media Konfiguration
          </h3>
          <p className="text-xs text-zinc-400">
            Passe deine automatische 9:16 Video-Pipeline und Ziel-Plattformen an.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1">
              Twitch Kanal
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="w-full rounded-xl bg-zinc-900 border border-purple-500/30 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              9:16 Vertikal-Zuschnitt Fokus
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'facecam_top_gameplay_bottom', label: 'Facecam + Game' },
                { id: 'center', label: 'Mitte (Fokus)' },
                { id: 'split', label: 'Split-Screen' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCropMode(opt.id as any)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold transition ${
                    cropMode === opt.id
                      ? 'bg-purple-600 text-white border border-purple-400'
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
              Ziel-Plattformen für Omni-Posting
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'tiktok', label: 'TikTok' },
                { id: 'youtube_shorts', label: 'YouTube Shorts' },
                { id: 'instagram_reels', label: 'Instagram Reels' },
                { id: 'twitter_x', label: 'X / Twitter' },
              ].map((plat) => {
                const active = selectedPlatforms.includes(plat.id);
                return (
                  <button
                    key={plat.id}
                    type="button"
                    onClick={() => togglePlatform(plat.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-between transition ${
                      active
                        ? 'bg-purple-950/60 border border-purple-500/50 text-white'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <span>{plat.label}</span>
                    {active && <Check className="h-3.5 w-3.5 text-purple-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div>
              <span className="text-xs font-semibold text-white block">Autopilot Auto-Publishing</span>
              <span className="text-[11px] text-zinc-400">Veröffentliche Clips sofort nach 5 Min. Cooldown</span>
            </div>
            <input
              type="checkbox"
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
              className="rounded bg-zinc-800 text-purple-600 h-4 w-4"
            />
          </div>

          <div className="pt-2 flex gap-3">
            {onOpen2FA && (
              <button
                type="button"
                onClick={onOpen2FA}
                className="py-2.5 px-3 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-300 text-xs font-medium"
              >
                2FA konfigurieren
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/30"
            >
              Konfiguration speichern
            </button>
          </div>
        </div>
    </dialog>
  );
};
