import React from 'react';
import {
  Zap,
  Sparkles,
  Tv,
  LogOut,
  Layers,
  Scale,
  Film,
  Lock,
  ShieldCheck,
  Crown,
  LayoutDashboard,
  ArrowRight,
} from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';

interface NavbarProps {
  currentUser: StreamerUser | null;
  currentView?: 'landing' | 'dashboard';
  onOpenAuth: () => void;
  onLogout: () => void;
  onScrollTo: (sectionId: string) => void;
  onGoToDashboard: () => void;
  onGoToLanding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentView = 'landing',
  onOpenAuth,
  onLogout,
  onScrollTo,
  onGoToDashboard,
  onGoToLanding,
}) => {
  return (
    <nav aria-label="Toolbar" className="ui-toolbar sticky top-0 z-40 w-full border-b border-purple-500/25 bg-[#070514]/90 backdrop-blur-2xl shadow-[0_4px_35px_rgba(145,70,255,0.12)] transition-all duration-300 relative overflow-hidden">
      {/* Wave-Glow Background System in Header */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {/* Minimalist dot overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(145,70,255,0.08)_1px,transparent_1px)] bg-[size:24px_24px] opacity-40" />

        {/* Floating wave-glow ribbons across header */}
        <div className="absolute -top-16 left-1/5 h-28 w-[450px] rounded-full bg-gradient-to-r from-purple-600/25 via-[#9146FF]/30 to-fuchsia-600/20 blur-2xl animate-wave-glow" />
        <div className="absolute -top-14 right-1/4 h-24 w-[380px] rounded-full bg-gradient-to-l from-indigo-600/20 via-purple-700/25 to-violet-500/20 blur-2xl animate-wave-glow-reverse" />

        {/* Bottom edge neon wave light */}
        <div className="absolute inset-x-0 bottom-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#9146FF]/70 to-transparent shadow-[0_0_12px_rgba(145,70,255,0.6)]" />
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="w-full flex h-16 items-center justify-between gap-3 sm:gap-4">
          {/* Brand Logo */}
          <div
            onClick={() => onScrollTo('hero')}
            className="flex items-center gap-3 cursor-pointer group shrink-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 via-[#9146FF] to-fuchsia-500 shadow-lg shadow-purple-500/25 group-hover:scale-105 transition">
              <span className="font-display text-sm font-black text-white">QC</span>
            </div>
            <div>
              <h1 className="text-base font-black tracking-widest uppercase font-display text-white group-hover:text-fuchsia-400 transition">
                QlipZync
              </h1>
              <span className="text-[9px] font-mono text-[#9146FF] tracking-wider block leading-none font-bold">
                INC. AUTOPILOT
              </span>
            </div>
          </div>

          {/* Navigation Items: On LandingPage, ALWAYS show clean public links with ZERO user data */}
          {currentView === 'landing' ? (
            <nav className="hidden sm:flex items-center space-x-6 text-xs font-semibold text-zinc-300 font-syne">
              <button
                onClick={() => onScrollTo('hero')}
                className="hover:text-fuchsia-400 transition cursor-pointer"
              >
                Start
              </button>
              <button
                type="button"
                onClick={onGoToDashboard}
                className="hover:text-fuchsia-400 transition cursor-pointer flex items-center gap-1.5 text-purple-200 font-bold px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 shadow-sm"
                title="Live Streamer-Dashboard anzeigen"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-fuchsia-400" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => onScrollTo('how-it-works')}
                className="hover:text-fuchsia-400 transition cursor-pointer flex items-center gap-1 text-purple-300 font-bold"
              >
                <Sparkles className="h-3 w-3 text-fuchsia-400" />
                <span>Funktionsweise</span>
              </button>
              <button
                onClick={() => onScrollTo('pricing')}
                className="hover:text-fuchsia-400 transition flex items-center gap-1.5 text-fuchsia-400 font-bold cursor-pointer"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Preise</span>
              </button>
              <button
                onClick={() => onScrollTo('trust')}
                className="hover:text-fuchsia-400 transition cursor-pointer"
              >
                Sicherheit
              </button>
            </nav>
          ) : currentUser ? (
            /* Dashboard View: Contextual Badges */
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              <span className="rounded-full bg-[#9146FF]/10 border border-[#9146FF]/30 px-3 py-1 text-xs font-bold text-[#9146FF] flex items-center gap-1.5 shrink-0">
                <Tv className="h-3.5 w-3.5" />
                <span>Twitch: {currentUser.channelName}</span>
              </span>
              {(currentUser.isAdmin ||
                currentUser.email === 'robert.f.telekom@gmail.com' ||
                currentUser.channelName === 'robert_f_telekom') && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/40 px-2.5 py-1 text-xs font-black text-amber-400 shrink-0">
                  <ShieldCheck className="h-3 w-3" />
                  Administrator
                </span>
              )}
              {currentUser.twoFactorAuth?.isVerified && (
                <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/30 px-2.5 py-1 text-xs font-bold text-sky-400 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                  2FA Aktiv
                </span>
              )}
              {currentUser.hasActiveSubscription ? (
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-400 shrink-0">
                  {currentUser.plan === 'free' ? 'FREE STARTER (0 €)' : `${currentUser.plan.toUpperCase()} ABO AKTIV`}
                </span>
              ) : (
                <span className="rounded-full bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 text-xs font-bold text-rose-400 flex items-center gap-1 shrink-0">
                  <Lock className="h-3 w-3" />
                  <span>KEIN ABO (GESPERRT)</span>
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Gast-Modus (Nicht eingeloggt)</span>
              </span>
            </div>
          )}

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {currentView === 'landing' ? (
              /* When on landing page: NEVER render user identity/stats/badges */
              currentUser ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={onGoToDashboard}
                    className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-black text-white shadow-lg shadow-purple-600/30 hover:shadow-purple-500/50 transition active:scale-95 cursor-pointer border border-purple-400/30"
                    title="Direkt zum persönlichen Streamer-Dashboard"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-purple-100" />
                    <span className="tracking-wide">Zum Dashboard</span>
                    <ArrowRight className="h-3.5 w-3.5 text-purple-200" />
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    title="Abmelden"
                    className="rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 p-2 sm:px-3 sm:py-2 text-zinc-400 hover:text-white transition flex items-center gap-1.5 text-xs cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Abmelden</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={onGoToDashboard}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-purple-200 hover:text-white transition active:scale-95 cursor-pointer shadow-md shadow-purple-950/40"
                    title="Direkt zum Live Streamer-Dashboard"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-fuchsia-400" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="rounded-xl border border-purple-500/30 bg-purple-950/30 hover:bg-purple-900/40 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-zinc-100 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Tv className="h-3.5 w-3.5 text-[#9146FF]" />
                    <span className="hidden xs:inline">Anmelden</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-extrabold text-white shadow-lg shadow-fuchsia-500/25 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Registrieren</span>
                  </button>
                </div>
              )
            ) : (
              /* When in Dashboard view: Show switch to landing and streamer profile pill */
              <>
                <button
                  type="button"
                  onClick={onGoToLanding}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-950/50 hover:bg-purple-900/60 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-purple-200 hover:text-white transition active:scale-95 cursor-pointer shadow-md shadow-purple-950/40"
                  title="Zur Startseite wechseln"
                >
                  <Tv className="h-3.5 w-3.5 text-fuchsia-400" />
                  <span className="hidden xs:inline">Zur Startseite</span>
                </button>

                {!currentUser && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-white shadow-lg shadow-fuchsia-600/30 transition cursor-pointer active:scale-95"
                  >
                    <Tv className="h-3.5 w-3.5" />
                    <span>Jetzt anmelden</span>
                  </button>
                )}

                {currentUser && (
                  <div className="flex items-center gap-2 sm:gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-1.5 pl-2.5 sm:pl-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={currentUser.avatarUrl}
                        alt={currentUser.name}
                        className="h-7 w-7 rounded-full object-cover border border-emerald-500/50"
                      />
                      <div className="hidden sm:block text-left">
                        <span className="text-xs font-bold text-white block leading-none">
                          {currentUser.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {currentUser.hasActiveSubscription
                            ? `${currentUser.clipsUsedThisMonth}/${currentUser.clipsLimitTotal} Clips`
                            : 'Zugriff gesperrt'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={onLogout}
                      title="Abmelden"
                      className="rounded-lg bg-zinc-800 hover:bg-zinc-700 p-1.5 text-zinc-400 hover:text-white transition flex items-center gap-1 text-xs px-2 sm:px-2.5 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Abmelden</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
