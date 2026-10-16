import React, { useState } from 'react';
import { Bot, Sparkles, X, ChevronRight, HelpCircle, ShieldCheck, Tv, ArrowRight } from 'lucide-react';
import { StreamerUser, SubscriptionPlan } from '../../types/pipeline';

interface QuickClickBotGuideProps {
  user: StreamerUser | null;
  onNavigateToSection: (sectionId: string) => void;
  onOpenAuth: (plan?: SubscriptionPlan) => void;
  onOpenChannelSetup: () => void;
  onOpen2FASetup: () => void;
}

export const QuickClickBotGuide: React.FC<QuickClickBotGuideProps> = ({
  user,
  onNavigateToSection,
  onOpenAuth,
  onOpenChannelSetup,
  onOpen2FASetup,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <aside aria-label="QlipZync Bot Guide" className="fixed bottom-6 right-6 z-40">
      {/* Bot Chat Widget Popup */}
      {isOpen && (
        <div className="mb-3 w-80 sm:w-96 rounded-2xl border border-purple-500/40 bg-[#0f0727]/95 p-5 shadow-2xl backdrop-blur-xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-purple-600 to-fuchsia-500 flex items-center justify-center text-white shadow-md">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white font-display">QlipZync Copilot</h4>
                <span className="text-[10px] text-emerald-400 font-mono">0 MB RAM • Bereit</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-white transition p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="text-xs text-zinc-300 space-y-2 bg-zinc-900/60 p-3 rounded-xl border border-zinc-800">
            <p>
              Willkommen bei <strong className="text-white">QlipZync</strong>! Ich überwache deinen Twitch-Kanal
              vollautomatisch im flüchtigen Arbeitsspeicher.
            </p>
            <ul className="space-y-1 text-zinc-400 text-[11px] list-disc list-inside">
              <li>0 MB persistenter Speicher (DSGVO-konform)</li>
              <li>Gemini 2.5 Flash multimodale Viralitätsanalyse</li>
              <li>Omni-Publishing auf TikTok, Shorts & Reels</li>
            </ul>
          </div>

          <div className="space-y-1.5 pt-1">
            {!user ? (
              <button
                onClick={() => {
                  onOpenAuth('creator');
                  setIsOpen(false);
                }}
                className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-between transition shadow-md"
              >
                <span>Twitch-Kanal verbinden</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    onOpenChannelSetup();
                    setIsOpen(false);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center justify-between transition"
                >
                  <span>Kanal-Setup Assistent öffnen</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    onOpen2FASetup();
                    setIsOpen(false);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center justify-between transition"
                >
                  <span>Zwei-Faktor-Authentifizierung (2FA)</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={() => {
                onNavigateToSection('pricing');
                setIsOpen(false);
              }}
              className="w-full py-1.5 px-3 rounded-xl text-zinc-400 hover:text-zinc-200 text-[11px] text-left transition"
            >
              → Zu den Stripe Tarifen & Plänen
            </button>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2.5 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 p-3 sm:px-4 sm:py-3 text-white shadow-xl shadow-purple-600/30 hover:scale-105 transition"
        title="QuickClick Bot Guide"
      >
        <div className="relative">
          <Bot className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
        </div>
        <span className="hidden sm:inline text-xs font-bold font-display tracking-wider">
          Bot Guide
        </span>
      </button>
    </aside>
  );
};
