import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, Check, X } from 'lucide-react';

interface CookieConsentBannerProps {
  forceOpen?: boolean;
  onOpenPrivacy: () => void;
  onClose: () => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  forceOpen = false,
  onOpenPrivacy,
  onClose,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('qlipzync_cookie_consent');
    if (!consent || forceOpen) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [forceOpen]);

  if (!visible) return null;

  const handleAcceptAll = () => {
    localStorage.setItem('qlipzync_cookie_consent', 'all');
    setVisible(false);
    onClose();
  };

  const handleAcceptEssential = () => {
    localStorage.setItem('qlipzync_cookie_consent', 'essential');
    setVisible(false);
    onClose();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-3xl border border-amber-500/30 bg-[#0e0722]/95 p-5 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Cookie className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white font-display">
              Cookie- & Datenschutz-Präferenzen
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Wir verwenden technisch notwendige Cookies zur Sitzungsverwaltung (TTDSG-konform).
              Tracking-Cookies werden standardmäßig blockiert.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            onClick={handleAcceptAll}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition shadow-md shadow-purple-600/20"
          >
            Alle akzeptieren
          </button>
          <button
            onClick={handleAcceptEssential}
            className="flex-1 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition"
          >
            Nur notwendige
          </button>
          <button
            onClick={onOpenPrivacy}
            className="py-2 px-3 rounded-xl text-zinc-400 hover:text-white text-xs underline"
          >
            Details
          </button>
        </div>
      </div>
    </div>
  );
};
