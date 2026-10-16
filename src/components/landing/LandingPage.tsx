import React, { useState } from 'react';
import {
  Zap,
  Sparkles,
  Tv,
  ArrowRight,
  ShieldCheck,
  Check,
  Play,
  Lock,
  Cpu,
  RefreshCw,
  ExternalLink,
  Flame,
  Radio,
  Share2,
  LayoutDashboard,
  MessageSquare,
  Clock,
  HardDrive,
  Bell,
  Timer,
  Send,
} from 'lucide-react';
import { SubscriptionPlan, ModularSubscriptionConfig, ClipPackage } from '../../types/pipeline';
import { BotClipJugglerAnimation } from './BotClipJugglerAnimation';
import { ViralPeakGraph } from '../dashboard/ViralPeakGraph';
import { CentralStripePricingSection } from '../monetization/CentralStripePricingSection';
import { LiveBotProcessingShowcase } from './LiveBotProcessingShowcase';

interface LandingPageProps {
  onGoToDashboard?: () => void;
  onOpenAuth: (preferredPlan?: SubscriptionPlan, initialChannel?: string) => void;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  onStartTrial?: () => void;
  onDirectPreview?: (channelName: string) => void;
  onBuyClipPackage?: (pkg: ClipPackage) => void;
  onOpenStripeCheckout?: (plan: ModularSubscriptionConfig, cycle: 'monthly' | 'annual') => void;
  onOpenBotGuide?: () => void;
  onOpenImpressum?: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
  onOpenAvv?: () => void;
  onOpenGdprAudit?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGoToDashboard,
  onOpenAuth,
  onSelectPlan,
  onStartTrial,
  onDirectPreview,
  onBuyClipPackage,
  onOpenStripeCheckout,
  onOpenImpressum,
  onOpenPrivacy,
  onOpenTerms,
  onOpenAvv,
  onOpenGdprAudit,
}) => {
  const [heroChannel, setHeroChannel] = useState<string>('');
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  const handleHeroSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onOpenAuth('free', heroChannel.trim() || undefined);
  };

  return (
    <div className="w-full space-y-24 py-6 text-zinc-100 font-sans">
      {/* ========================================================================= */}
      {/* ABSCHNITT 1: HERO (Above the fold - Maximale Klarheit & Hook)             */}
      {/* ========================================================================= */}
      <section
        id="hero"
        aria-labelledby="hero-title"
        className="rounded-3xl border border-purple-500/30 bg-gradient-to-b from-[#130830] via-[#0a051e] to-[#070514] p-6 sm:p-12 shadow-2xl relative overflow-hidden scroll-mt-24"
      >
        {/* Ambient atmospheric glows */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-fuchsia-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
          {/* Left Column: Hook, Value Prop & Input */}
          <div className="lg:col-span-6 space-y-6 text-left">
            {/* Orientiert an der Pipeline-Header-Struktur: Icon-Box + Eyebrow-Tag + Status-Pill */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 shadow-lg shadow-fuchsia-500/10">
                <Zap className="h-5 w-5 text-fuchsia-400 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-black text-fuchsia-400 uppercase tracking-wider">
                    QuickClick Autopilot
                  </span>
                  <span className="rounded-full bg-purple-900/60 border border-purple-500/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-purple-200">
                    100% Autonom • 0 MB RAM
                  </span>
                </div>
                <div className="text-[11px] font-mono text-zinc-400 font-medium">
                  Echtzeit Twitch EventSub & Multi-Social Pipeline
                </div>
              </div>
            </div>

            {/* Titel, Subtitel & Beschreibung */}
            <div className="space-y-3">
              <h1
                id="hero-title"
                className="text-3xl sm:text-5xl font-black font-display tracking-tight text-white leading-[1.12]"
              >
                <span className="block">Deine Twitch Clips.</span>
                <span className="block">Viral.</span>
                <span className="block bg-gradient-to-r from-fuchsia-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                  vollautomatisch.
                </span>
              </h1>

              {/* Subtitel */}
              <p className="text-sm sm:text-base font-bold text-fuchsia-300 font-display">
                Vom Twitch Go-Live zum viralen 9:16 Highlight in unter 60 Sekunden.
              </p>

              {/* Beschreibung */}
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans max-w-xl">
                Kein stundenlanges Schneiden mehr nach dem Stream. QuickClick erkennt Highlights in Echtzeit, schneidet im 9:16 Format mit KI-Facecam-Tracking & Untertiteln und postet autonom auf TikTok, YouTube Shorts & Instagram Reels.
              </p>
            </div>

            {/* 3-Step Orientierungs-Badges (identisches Schema wie in der Pipeline-Div) */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/25 text-left">
                <span className="text-[10px] font-mono font-bold text-purple-400 block mb-0.5">1. GO-LIVE</span>
                <span className="font-bold text-white text-xs block truncate">Twitch EventSub</span>
                <p className="text-[10px] text-zinc-400 mt-0.5 truncate">0s Latenz Webhook</p>
              </div>
              <div className="p-2.5 rounded-xl bg-fuchsia-950/40 border border-fuchsia-500/25 text-left">
                <span className="text-[10px] font-mono font-bold text-fuchsia-400 block mb-0.5">2. KI-SCHNITT</span>
                <span className="font-bold text-white text-xs block truncate">9:16 + Subtitles</span>
                <p className="text-[10px] text-zinc-400 mt-0.5 truncate">0 MB RAM Engine</p>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/25 text-left">
                <span className="text-[10px] font-mono font-bold text-cyan-400 block mb-0.5">3. MULTI-POST</span>
                <span className="font-bold text-white text-xs block truncate">Shorts, TikTok, Reels</span>
                <p className="text-[10px] text-zinc-400 mt-0.5 truncate">Paralleler Upload</p>
              </div>
            </div>

            {/* Direct Channel Input Form */}
            <form onSubmit={handleHeroSubmit} className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-purple-400">
                    <Tv className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={heroChannel}
                    onChange={(e) => setHeroChannel(e.target.value)}
                    placeholder="twitch.tv/dein_kanalname"
                    className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-purple-500/40 bg-[#09041a] text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-fuchsia-400 focus:ring-1 focus:ring-fuchsia-400 transition"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full sm:w-auto shrink-0 px-6 py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-display font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-500/30 hover:shadow-fuchsia-500/50 active:scale-95 transition cursor-pointer"
                >
                  <span>Jetzt kostenlos testen ↗</span>
                </button>
                {onGoToDashboard && (
                  <button
                    type="button"
                    onClick={onGoToDashboard}
                    className="w-full sm:w-auto shrink-0 px-5 py-3.5 rounded-xl border border-purple-500/50 bg-purple-950/70 hover:bg-purple-900/90 text-purple-200 hover:text-white font-display font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-purple-950/40 active:scale-95 transition cursor-pointer"
                    title="Direkt zum Live Streamer-Dashboard"
                  >
                    <LayoutDashboard className="h-4 w-4 text-fuchsia-400" />
                    <span>Dashboard ↗</span>
                  </button>
                )}
              </div>

              {/* Micro-Trust direkt unter Button */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-400 font-mono">
                <span className="text-emerald-400">✓ DSGVO-konform (Server in FFM)</span>
              </div>
            </form>
          </div>

          {/* Right Column: Visual Telemetry Graph */}
          <div className="lg:col-span-6 w-full">
            <ViralPeakGraph />
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ABSCHNITT 2: HOW IT WORKS (Visuelle Bot-Animation - 3 Schritte)           */}
      {/* ========================================================================= */}
      <section
        id="how-it-works"
        aria-labelledby="how-it-works-title"
        className="rounded-3xl border border-purple-500/30 bg-[#0a051e] p-6 sm:p-12 shadow-2xl space-y-10 scroll-mt-24"
      >
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-fuchsia-400">
            AUTONOMER STREAMING- & DISTRIBUTION-ABLAUF
          </span>
          <h2
            id="how-it-works-title"
            className="text-2xl sm:text-4xl font-black font-display uppercase tracking-wide text-white"
          >
            In 3 Schritten auf 100% Autopilot
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300">
            Von der sekundengenauen Twitch Live-Erkennung über 10-Minuten Bot-Heartbeats bis zum 5-Minuten DNS/RAM Ingest und Multi-Format Social Blast.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Schritt 1 */}
          <div
            onClick={() => setActiveStep(1)}
            className={`rounded-2xl p-6 space-y-4 transition duration-300 cursor-pointer flex flex-col justify-between ${
              activeStep === 1
                ? 'border-2 border-fuchsia-500 bg-[#160a35] shadow-lg shadow-fuchsia-500/20'
                : 'border border-purple-500/30 bg-[#0e0728] hover:border-purple-500/60'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-9 w-9 rounded-xl bg-purple-900/70 border border-purple-400 flex items-center justify-center font-display font-black text-sm text-purple-200">
                  1
                </span>
                <span className="text-[10px] font-mono text-purple-300 uppercase px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                  Live & 15 Min Invite
                </span>
              </div>
              <h3 className="text-base font-bold text-white font-display">
                Online/Offline & Doppel-Einladung
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Erkennt Twitch Online- und Offline-Status in Echtzeit via EventSub. Postet sofort den <strong>1. Einladungslink</strong> auf allen Social-Media-Kanälen (X, TikTok, Instagram, YouTube) und nach <strong>15 Minuten Streamzeit die 2. Einladung</strong>.
              </p>
            </div>

            <div className="pt-3 border-t border-purple-500/20 space-y-1.5 text-[11px] font-mono text-purple-200">
              <div className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Twitch EventSub Status live</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>1. Einladungslink sofort</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                <span>2. Einladung @ 15 Min Stream</span>
              </div>
            </div>
          </div>

          {/* Schritt 2 */}
          <div
            onClick={() => setActiveStep(2)}
            className={`rounded-2xl p-6 space-y-4 transition duration-300 cursor-pointer flex flex-col justify-between ${
              activeStep === 2
                ? 'border-2 border-fuchsia-500 bg-[#160a35] shadow-lg shadow-fuchsia-500/20'
                : 'border border-purple-500/30 bg-[#0e0728] hover:border-purple-500/60'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-9 w-9 rounded-xl bg-fuchsia-900/70 border border-fuchsia-400 flex items-center justify-center font-display font-black text-sm text-fuchsia-200">
                  2
                </span>
                <span className="text-[10px] font-mono text-fuchsia-300 uppercase px-2 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30">
                  Alle 10 Min Bot-Sync
                </span>
              </div>
              <h3 className="text-base font-bold text-white font-display">
                Bot-Heartbeat & Verabschiedung
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Sendet <strong>alle 10 Minuten aktuelle Stream-Informationen</strong> (Viewer, Uptime, Game-Titel) an Discord- und Telegram-Chat-Bots. Postet bei Stream-Ende eine <strong>automatische Verabschiedung & Danksagung</strong> auf Social Media.
              </p>
            </div>

            <div className="pt-3 border-t border-purple-500/20 space-y-1.5 text-[11px] font-mono text-fuchsia-200">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                <span>Alle 10 Min Stream-Info</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Discord & Telegram Bots</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                <span>Social Verabschiedung bei Offline</span>
              </div>
            </div>
          </div>

          {/* Schritt 3 */}
          <div
            onClick={() => setActiveStep(3)}
            className={`rounded-2xl p-6 space-y-4 transition duration-300 cursor-pointer flex flex-col justify-between ${
              activeStep === 3
                ? 'border-2 border-fuchsia-500 bg-[#160a35] shadow-lg shadow-fuchsia-500/20'
                : 'border border-purple-500/30 bg-[#0e0728] hover:border-purple-500/60'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="h-9 w-9 rounded-xl bg-cyan-900/70 border border-cyan-400 flex items-center justify-center font-display font-black text-sm text-cyan-200">
                  3
                </span>
                <span className="text-[10px] font-mono text-cyan-300 uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30">
                  5 Min Puffer • RAM Ingest
                </span>
              </div>
              <h3 className="text-base font-bold text-white font-display">
                5 Min Puffer, RAM Ingest & Multi-Post
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Wartet nach Stream-Offline <strong>exakt 5 Minuten</strong>. Lädt die Twitch-Clips per URL/DNS direkt in den <strong>flüchtigen RAM (/dev/shm)</strong>, verarbeitet Highlights und postet <strong>Texte, Bilder & Video-Clips</strong> autonom auf allen Kanälen.
              </p>
            </div>

            <div className="pt-3 border-t border-purple-500/20 space-y-1.5 text-[11px] font-mono text-cyan-200">
              <div className="flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>5 Min Twitch Finalisierung</span>
              </div>
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>URL/DNS Ingest ins RAM (/dev/shm)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Texte, Bilder & Video-Clips Multi-Post</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Timeline Tracker Box */}
        <div className="rounded-2xl border border-purple-500/25 bg-[#0e072a]/90 p-5 sm:p-6 shadow-inner space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-fuchsia-400" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Automatisierte Stream-Timeline & Intervall-Trigger
              </span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Latenzfreie Trigger-Kette
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-xs">
            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30">
              <span className="text-[10px] font-mono text-purple-300 font-bold block">00:00 STREAM START</span>
              <p className="font-semibold text-white mt-1">1. Einladungslink</p>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">X, TikTok, IG, YT</span>
            </div>

            <div className="p-3 rounded-xl bg-fuchsia-950/40 border border-fuchsia-500/30">
              <span className="text-[10px] font-mono text-fuchsia-300 font-bold block">15:00 MIN STREAM</span>
              <p className="font-semibold text-white mt-1">2. Einladungslink</p>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Zuschauer-Aktivierung</span>
            </div>

            <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30">
              <span className="text-[10px] font-mono text-indigo-300 font-bold block">ALLE 10 MINUTEN</span>
              <p className="font-semibold text-white mt-1">Bot-Heartbeat</p>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Discord & Telegram</span>
            </div>

            <div className="p-3 rounded-xl bg-pink-950/40 border border-pink-500/30">
              <span className="text-[10px] font-mono text-pink-300 font-bold block">STREAM OFFLINE</span>
              <p className="font-semibold text-white mt-1">Verabschiedung</p>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Danksagungs-Posts</span>
            </div>

            <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30">
              <span className="text-[10px] font-mono text-cyan-300 font-bold block">+5 MINUTEN PUFFER</span>
              <p className="font-semibold text-white mt-1">RAM Ingest per DNS</p>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Flüchtiges /dev/shm</span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
              <span className="text-[10px] font-mono text-emerald-300 font-bold block">POST-PROCESSING</span>
              <p className="font-semibold text-white mt-1">Multi-Social Blast</p>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Texte, Bilder & Clips</span>
            </div>
          </div>
        </div>

        {/* Visual Bot Animation Container */}
        <div className="pt-2">
          <BotClipJugglerAnimation
            autoPlay={true}
            activeStep={activeStep}
            onStepChange={(s) => setActiveStep(s)}
          />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ABSCHNITT 3: DER BEWEIS (Social Proof / Echte Live-Ergebnisse)             */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* ABSCHNITT 3: AUTONOME BOT-ANIMATION & LIVE PIPELINE SHOWCASE               */}
      {/* ========================================================================= */}
      <section
        id="proof"
        aria-labelledby="proof-title"
        className="rounded-3xl border border-purple-500/30 bg-[#0c0724] p-6 sm:p-12 shadow-2xl space-y-10 scroll-mt-24"
      >
        <LiveBotProcessingShowcase />
      </section>

      {/* ========================================================================= */}
      {/* ABSCHNITT 4: ZENTRALE STRIPE PREISSEKTION (Offizielle Stripe Tarife)       */}
      {/* ========================================================================= */}
      <CentralStripePricingSection
        onOpenAuth={onOpenAuth}
        onSelectPlan={onSelectPlan}
        onStartTrial={onStartTrial}
        onOpenStripeCheckout={onOpenStripeCheckout}
        onBuyClipPackage={onBuyClipPackage}
      />

      {/* ========================================================================= */}
      {/* ABSCHNITT 5: TRUST & SICHERHEIT (Einwandbehandlung)                       */}
      {/* ========================================================================= */}
      <section
        id="trust"
        aria-labelledby="trust-title"
        className="rounded-3xl border border-purple-500/30 bg-[#09041a] p-6 sm:p-12 shadow-2xl space-y-8 scroll-mt-24"
      >
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            SICHERHEIT & DATENSCHUTZ
          </span>
          <h2
            id="trust-title"
            className="text-2xl sm:text-3xl font-black font-display uppercase tracking-wide text-white"
          >
            Maximale Sicherheit für deinen Stream
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Wir schützen deine Zugangsdaten und Videoinhalte mit strengen deutschen Sicherheitsstandards.
          </p>
        </div>

        {/* Kompakter 3-Spalten-Bereich für Bedenken */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Säule 1 */}
          <div className="rounded-2xl border border-emerald-500/30 bg-[#0b1322] p-6 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white font-display">
              100% DSGVO-konform
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Serverstandort Frankfurt am Main (eu-central), zertifizierte Auftragsverarbeitung (AVV nach Art. 28 DSGVO) und strikt BGB-konform.
            </p>
          </div>

          {/* Säule 2 */}
          <div className="rounded-2xl border border-purple-500/30 bg-[#12082b] p-6 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-fuchsia-400">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white font-display">
              Zero-Storage RAM
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Keine Speicherung deiner Rohvideos auf Festplatten. Transcoding erfolgt flüchtig im Arbeitsspeicher (0 MB Disk) und wird sofort verworfen.
            </p>
          </div>

          {/* Säule 3 */}
          <div className="rounded-2xl border border-cyan-500/30 bg-[#09152b] p-6 space-y-3">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white font-display">
              Volle Kontrolle
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Jederzeit mit 1 Klick monatlich kündbar. Alle Upload-Links werden sekundengenau in deine persönliche Google Tabelle synchronisiert.
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ABSCHNITT 6: FOOTER (Rechtliches & Minimalistischer Abschluss)             */}
      {/* ========================================================================= */}
      <footer
        id="footer-section"
        aria-label="QuickClick Rechtliches & Impressum"
        className="rounded-3xl border border-purple-500/30 bg-[#09041a] p-6 sm:p-10 space-y-8 shadow-2xl text-xs text-zinc-400"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 border-b border-purple-500/20 pb-8 items-center">
          {/* Col 1: Brand Info */}
          <div className="md:col-span-6 space-y-2 text-left">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-800 to-fuchsia-800 border border-purple-400 flex items-center justify-center font-display font-black text-xs text-white">
                QC
              </div>
              <span className="font-display font-black text-white uppercase tracking-wider text-sm">
                QuickClick Cloud Systems
              </span>
            </div>
            <p className="text-xs text-zinc-400 max-w-sm">
              Die autonome Clip-Pipeline für moderne Twitch-Streamer. Multi-Social Autopilot ohne Festplattenspeicher.
            </p>
          </div>

          {/* Col 2: Rechtliche Links */}
          <div className="md:col-span-6 flex flex-wrap items-center justify-start md:justify-end gap-x-5 gap-y-2 text-xs">
            <button
              type="button"
              onClick={onOpenImpressum}
              className="hover:text-fuchsia-400 transition cursor-pointer"
            >
              Impressum
            </button>
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="hover:text-fuchsia-400 transition cursor-pointer"
            >
              Datenschutz
            </button>
            <button
              type="button"
              onClick={onOpenTerms}
              className="hover:text-fuchsia-400 transition cursor-pointer"
            >
              AGB
            </button>
            <button
              type="button"
              onClick={onOpenAvv}
              className="hover:text-fuchsia-400 transition cursor-pointer"
            >
              AVV-Vertrag
            </button>
            <button
              type="button"
              onClick={onOpenGdprAudit}
              className="text-fuchsia-400 font-bold hover:underline transition cursor-pointer"
            >
              DSGVO-Audit
            </button>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Operational Status */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-zinc-500 font-mono">
          <span>
            © 2026 QuickClick Cloud Systems. Alle Rechte vorbehalten.
          </span>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-bold">All Systems Operational • Frankfurt (FFM)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
