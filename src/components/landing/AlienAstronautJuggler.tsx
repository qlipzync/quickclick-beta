import React, { useState, useEffect } from 'react';
import { Tv, Sparkles, Share2, Play, Pause, RotateCw, CheckCircle2, Flame, Bot } from 'lucide-react';

interface AlienAstronautJugglerProps {
  currentStage?: 1 | 2 | 3;
  onStageSelect?: (stage: 1 | 2 | 3) => void;
  channelName?: string;
  clipTitle?: string;
}

export const AlienAstronautJuggler: React.FC<AlienAstronautJugglerProps> = ({
  currentStage,
  onStageSelect,
  channelName = 'sh00trstv',
  clipTitle = 'Insane 1v4 Final Ring Clutch!',
}) => {
  const [internalPhase] = useState<1 | 2 | 3>(1);
  const activePhase: 1 | 2 | 3 = currentStage ?? internalPhase;
  const [frisbeeTarget, setFrisbeeTarget] = useState<'tiktok' | 'shorts' | 'reels'>('tiktok');
  const [deliveredCount, setDeliveredCount] = useState(42);

  useEffect(() => {
    if (activePhase === 3) {
      setFrisbeeTarget((t) => (t === 'tiktok' ? 'shorts' : t === 'shorts' ? 'reels' : 'tiktok'));
      setDeliveredCount((c) => c + 1);
    }
  }, [activePhase]);

  return (
    <div className="w-full h-full flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#13072f]/95 via-[#0c0520]/95 to-[#070314]/95 border border-purple-500/30 shadow-2xl relative overflow-hidden text-center">
      {/* Top Header Badge */}
      <header className="w-full flex items-center justify-between gap-2 mb-2 z-10">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-purple-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>AUTONOMER ALIEN-PILOT</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-lg bg-purple-900/60 border border-purple-500/40 text-purple-200 text-[10px] font-mono font-bold flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Phase {activePhase} / 3</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
            0 MB RAM
          </span>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN OPTIMIZED ANIMATED SVG CANVAS (ViewBox 0 0 520 340)                  */}
      {/* ========================================================================= */}
      <div className="w-full relative flex-1 min-h-[300px] sm:min-h-[330px] flex items-center justify-center my-1 select-none">
        <svg
          viewBox="0 0 520 340"
          className="w-full h-full max-h-[360px] overflow-visible drop-shadow-xl"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="alienSkin" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="60%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            <linearGradient id="alienHelmetGlass" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="rgba(232, 204, 255, 0.45)" />
              <stop offset="45%" stopColor="rgba(168, 85, 247, 0.15)" />
              <stop offset="100%" stopColor="rgba(88, 28, 135, 0.65)" />
            </linearGradient>

            <linearGradient id="spaceSuit" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>

            <linearGradient id="suitPurpleTrim" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#7e22ce" />
            </linearGradient>

            <linearGradient id="frisbeeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="35%" stopColor="#d946ef" />
              <stop offset="70%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>

            <radialGradient id="plasmaThrust" cx="50%" cy="0%" r="90%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="40%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>

            <filter id="neonPurpleGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="neonCyanGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ========================================================================= */}
          {/* ZONE 1 (LEFT): TWITCH HELIX STATION & LIVE STREAM CLIP                    */}
          {/* ========================================================================= */}
          <g transform="translate(18, 95)">
            {/* Ambient Pulse Ring */}
            <circle cx="42" cy="50" r="44" fill="rgba(145, 70, 255, 0.08)" />
            <circle
              cx="42"
              cy="50"
              r="40"
              fill="none"
              stroke="#9146FF"
              strokeWidth="1.8"
              strokeDasharray="5 5"
              className="animate-spin"
              style={{ animationDuration: '20s', transformOrigin: '42px 50px' }}
            />

            {/* Twitch Terminal Box */}
            <rect
              x="10"
              y="16"
              width="64"
              height="68"
              rx="18"
              fill="#140b2e"
              stroke="#9146FF"
              strokeWidth="2"
              filter="url(#neonPurpleGlow)"
            />

            {/* Twitch Glitch Mark Icon */}
            <path
              d="M 27 30 L 55 30 L 60 42 L 60 58 L 51 58 L 47 64 L 41 64 L 41 58 L 27 58 Z"
              fill="#9146FF"
            />
            {/* Eyes in Twitch mark */}
            <rect x="35" y="39" width="3.5" height="8.5" fill="#ffffff" rx="1.5" />
            <rect x="46" y="39" width="3.5" height="8.5" fill="#ffffff" rx="1.5" />

            {/* Platform Sub-Label */}
            <text x="42" y="98" textAnchor="middle" fill="#c084fc" fontSize="10" fontWeight="bold" fontFamily="monospace">
              Twitch Helix
            </text>

            {/* Floating Clip Cartridge */}
            <g
              transform={
                activePhase === 1
                  ? 'translate(22, -14) scale(1)'
                  : 'translate(22, -14) scale(0.92)'
              }
              className={activePhase === 1 ? 'animate-bounce' : ''}
              style={{ animationDuration: '1.2s' }}
            >
              <rect
                x="-18"
                y="-18"
                width="76"
                height="26"
                rx="8"
                fill="#2e1065"
                stroke="#d8b4fe"
                strokeWidth="1.5"
                filter="url(#neonPurpleGlow)"
              />
              <text x="20" y="-1" textAnchor="middle" fill="#fdf4ff" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
                🎬 CLUTCH.MP4
              </text>
            </g>
          </g>

          {/* ========================================================================= */}
          {/* ZONE 3 (RIGHT): SOCIAL MEDIA FRISBEE RECEPTORS                            */}
          {/* ========================================================================= */}
          <g transform="translate(425, 45)">
            {/* TikTok Receptor */}
            <g
              transform="translate(0, 20)"
              className={activePhase === 3 && frisbeeTarget === 'tiktok' ? 'animate-pulse' : ''}
            >
              <rect
                x="-20"
                y="-18"
                width="72"
                height="36"
                rx="12"
                fill="#050e1f"
                stroke={activePhase === 3 && frisbeeTarget === 'tiktok' ? '#00f2fe' : '#1e293b'}
                strokeWidth={activePhase === 3 && frisbeeTarget === 'tiktok' ? '2.5' : '1.2'}
              />
              <circle cx="-5" cy="0" r="8" fill="#00f2fe" opacity="0.3" />
              <text x="20" y="4.5" textAnchor="middle" fill="#38bdf8" fontSize="10.5" fontWeight="bold">
                TikTok
              </text>
              {activePhase === 3 && frisbeeTarget === 'tiktok' && (
                <circle cx="-20" cy="-18" r="4" fill="#00f2fe" className="animate-ping" />
              )}
            </g>

            {/* YouTube Shorts Receptor */}
            <g
              transform="translate(0, 80)"
              className={activePhase === 3 && frisbeeTarget === 'shorts' ? 'animate-pulse' : ''}
            >
              <rect
                x="-20"
                y="-18"
                width="72"
                height="36"
                rx="12"
                fill="#1f0707"
                stroke={activePhase === 3 && frisbeeTarget === 'shorts' ? '#ef4444' : '#1e293b'}
                strokeWidth={activePhase === 3 && frisbeeTarget === 'shorts' ? '2.5' : '1.2'}
              />
              <circle cx="-5" cy="0" r="8" fill="#ef4444" opacity="0.3" />
              <text x="20" y="4.5" textAnchor="middle" fill="#f87171" fontSize="10.5" fontWeight="bold">
                Shorts
              </text>
              {activePhase === 3 && frisbeeTarget === 'shorts' && (
                <circle cx="-20" cy="-18" r="4" fill="#ef4444" className="animate-ping" />
              )}
            </g>

            {/* Instagram Reels Receptor */}
            <g
              transform="translate(0, 140)"
              className={activePhase === 3 && frisbeeTarget === 'reels' ? 'animate-pulse' : ''}
            >
              <rect
                x="-20"
                y="-18"
                width="72"
                height="36"
                rx="12"
                fill="#1f0820"
                stroke={activePhase === 3 && frisbeeTarget === 'reels' ? '#d946ef' : '#1e293b'}
                strokeWidth={activePhase === 3 && frisbeeTarget === 'reels' ? '2.5' : '1.2'}
              />
              <circle cx="-5" cy="0" r="8" fill="#d946ef" opacity="0.3" />
              <text x="20" y="4.5" textAnchor="middle" fill="#e879f9" fontSize="10.5" fontWeight="bold">
                Reels
              </text>
              {activePhase === 3 && frisbeeTarget === 'reels' && (
                <circle cx="-20" cy="-18" r="4" fill="#d946ef" className="animate-ping" />
              )}
            </g>

            <text x="16" y="202" textAnchor="middle" fill="#94a3b8" fontSize="9.5" fontWeight="bold" fontFamily="monospace">
              Multi-Feeds
            </text>
          </g>

          {/* ========================================================================= */}
          {/* ========================================================================= */}
          {/* FRISBEE FLYING ARC (Active in Stage 3: Frisbee Throw)                      */}
          {/* ========================================================================= */}
          {activePhase === 3 && (
            <g>
              {/* Aerodynamic Speed Lines Curve from Right Hand to Social Targets */}
              <path
                d="M 298 150 Q 365 85 435 95"
                fill="none"
                stroke="url(#frisbeeGlow)"
                strokeWidth="3.5"
                strokeDasharray="10 10"
                className="animate-pipeline-laser"
                opacity="0.9"
              />

              {/* The Spinning Frisbee Disc */}
              <g className="animate-frisbee-spin" style={{ transformOrigin: '298px 150px' }}>
                <ellipse cx="298" cy="150" rx="26" ry="8.5" fill="url(#frisbeeGlow)" filter="url(#neonPurpleGlow)" />
                <ellipse cx="298" cy="150" rx="18" ry="5.5" fill="#ffffff" opacity="0.85" />
                <circle cx="298" cy="150" r="3.5" fill="#a855f7" />
                {/* Aerodynamic Rim Blurs */}
                <path d="M 272 150 Q 298 141 324 150 Q 298 159 272 150 Z" fill="rgba(244,63,94,0.7)" />
              </g>

              {/* Impact Flash near the social targets */}
              <g transform="translate(425, 95)" className="animate-ping" style={{ animationDuration: '1.2s' }}>
                <circle cx="0" cy="0" r="14" fill="none" stroke="#f472b6" strokeWidth="2.5" opacity="0.75" />
              </g>
            </g>
          )}

          {/* ========================================================================= */}
          {/* ZONE 2 (CENTER): CUTE ALIEN ASTRONAUT (Centered at X: 260, Y: 125)        */}
          {/* ========================================================================= */}
          <g transform="translate(260, 125)">
            <g className="animate-alien-bob">
              {/* Jetpack with Twin Plasma Thrusters (Symmetric) */}
              <g transform="translate(0, 62)">
                <rect x="-24" y="0" width="19" height="32" rx="7" fill="#475569" stroke="#64748b" strokeWidth="1.2" />
                <rect x="5" y="0" width="19" height="32" rx="7" fill="#475569" stroke="#64748b" strokeWidth="1.2" />
                {/* Thruster Flames */}
                <ellipse cx="-14.5" cy="40" rx="6.5" ry="12" fill="url(#plasmaThrust)" className="animate-thruster" />
                <ellipse cx="14.5" cy="40" rx="6.5" ry="12" fill="url(#plasmaThrust)" className="animate-thruster" />
              </g>

              {/* Astronaut Space Suit Body (Centered around X=0) */}
              <rect
                x="-32"
                y="44"
                width="64"
                height="68"
                rx="22"
                fill="url(#spaceSuit)"
                stroke="#94a3b8"
                strokeWidth="2.2"
              />

              {/* Space Suit Chest Controls & QlipZync Emblem */}
              <rect x="-20" y="52" width="40" height="28" rx="9" fill="#1e1b4b" stroke="#6366f1" strokeWidth="1.5" />
              <circle cx="-10" cy="62" r="3.5" fill="#a855f7" className="animate-pulse" />
              <circle cx="0" cy="62" r="3.5" fill="#10b981" />
              <circle cx="10" cy="62" r="3.5" fill="#38bdf8" />
              <text x="0" y="75" textAnchor="middle" fill="#c084fc" fontSize="7" fontWeight="bold" fontFamily="monospace">
                0 MB RAM
              </text>

              {/* Suit Belt with Gold Buckle */}
              <rect x="-30" y="88" width="60" height="10" rx="4" fill="url(#suitPurpleTrim)" />
              <rect x="-8" y="87" width="16" height="12" rx="3" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />

              {/* Suit Legs & Boots (Symmetric) */}
              <rect x="-22" y="104" width="17" height="28" rx="7" fill="url(#spaceSuit)" stroke="#94a3b8" strokeWidth="1.8" />
              <rect x="5" y="104" width="17" height="28" rx="7" fill="url(#spaceSuit)" stroke="#94a3b8" strokeWidth="1.8" />
              {/* Boots */}
              <ellipse cx="-13.5" cy="132" rx="11" ry="6" fill="#475569" stroke="#334155" strokeWidth="1.2" />
              <ellipse cx="13.5" cy="132" rx="11" ry="6" fill="#475569" stroke="#334155" strokeWidth="1.2" />

              {/* ========================================================================= */}
              {/* LEFT ARM: DER FEDER-ARM (Extendable Coiled Spring Mechanical Arm)         */}
              {/* ========================================================================= */}
              <g transform="translate(-30, 56)">
                {/* Shoulder Swivel Joint */}
                <circle cx="0" cy="0" r="8.5" fill="#64748b" stroke="#334155" strokeWidth="1.8" />
                <circle cx="0" cy="0" r="3.8" fill="#a855f7" />

                {/* The Coiled Spring: Dynamically elongates based on activePhase */}
                {activePhase === 1 ? (
                  /* EXTENDED SPRING ARM (Shooting out to Twitch on the left) */
                  <g className="animate-pulse" style={{ animationDuration: '0.6s' }}>
                    {/* Coiled Spiral Spring Path spanning from shoulder (x=0) to Twitch clip (x=-165) */}
                    <path
                      d="M 0 0 
                         Q -12 -16 -24 0 
                         Q -36 16 -48 0 
                         Q -60 -16 -72 0 
                         Q -84 16 -96 0 
                         Q -108 -16 -120 0 
                         Q -132 16 -144 0 
                         L -165 0"
                      fill="none"
                      stroke="#c084fc"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#neonPurpleGlow)"
                    />
                    {/* Inner metallic wire shine */}
                    <path
                      d="M 0 0 
                         Q -12 -16 -24 0 
                         Q -36 16 -48 0 
                         Q -60 -16 -72 0 
                         Q -84 16 -96 0 
                         Q -108 -16 -120 0 
                         Q -132 16 -144 0 
                         L -165 0"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />

                    {/* Mechanical Claw at the end of the spring gripping the Twitch clip */}
                    <g transform="translate(-165, 0)">
                      <circle cx="0" cy="0" r="6" fill="#64748b" stroke="#334155" strokeWidth="1.2" />
                      {/* Top Claw Finger */}
                      <path d="M 0 -5 L -14 -14 Q -22 -10 -18 0" fill="none" stroke="#f472b6" strokeWidth="3.5" strokeLinecap="round" />
                      {/* Bottom Claw Finger */}
                      <path d="M 0 5 L -14 14 Q -22 10 -18 0" fill="none" stroke="#f472b6" strokeWidth="3.5" strokeLinecap="round" />
                      {/* Magnetic Grab Energy Flash */}
                      <circle cx="-16" cy="0" r="4.5" fill="#38bdf8" className="animate-ping" />
                    </g>
                  </g>
                ) : activePhase === 2 ? (
                  /* JUGGLING CATCH POSITION LEFT ARM (Mirrored glove arm raised to catch/juggle) */
                  <g transform="rotate(-25)">
                    <path d="M 0 0 L -19 12 L -32 -2" fill="none" stroke="url(#spaceSuit)" strokeWidth="9.5" strokeLinecap="round" />
                    {/* Glove */}
                    <ellipse cx="-32" cy="-2" rx="7.5" ry="6" fill="#475569" stroke="#64748b" strokeWidth="1.2" />
                  </g>
                ) : (
                  /* RETRACTED / COILED SPRING ARM (Resting compactly at side during Frisbee throw) */
                  <g>
                    {/* Compact Coiled Spring */}
                    <path
                      d="M 0 0 
                         Q -6 -10 -12 0 
                         Q -18 10 -24 0 
                         Q -30 -10 -36 0 
                         L -40 8"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="3.8"
                      strokeLinecap="round"
                    />
                    {/* Folded Claw Holding Ready Clip */}
                    <circle cx="-40" cy="8" r="5.5" fill="#64748b" />
                    <path d="M -40 8 Q -48 0 -44 -6" fill="none" stroke="#f472b6" strokeWidth="3" strokeLinecap="round" />
                    <path d="M -40 8 Q -48 16 -44 20" fill="none" stroke="#f472b6" strokeWidth="3" strokeLinecap="round" />
                  </g>
                )}
              </g>

              {/* ========================================================================= */}
              {/* RIGHT ARM: FRISBEE TOSS ARM (Glove arm on the right side)                 */}
              {/* ========================================================================= */}
              <g transform="translate(30, 56)">
                {/* Shoulder Joint */}
                <circle cx="0" cy="0" r="8.5" fill="#64748b" stroke="#334155" strokeWidth="1.8" />
                <circle cx="0" cy="0" r="3.8" fill="#10b981" />

                {activePhase === 3 ? (
                  /* FRISBEE LAUNCH POSITION (Swinging arm forward like throwing a disc) */
                  <g transform="rotate(-32)">
                    <path d="M 0 0 L 22 -14 L 38 -7" fill="none" stroke="url(#spaceSuit)" strokeWidth="9.5" strokeLinecap="round" />
                    {/* Glove */}
                    <ellipse cx="38" cy="-7" rx="7.5" ry="6" fill="#475569" stroke="#64748b" strokeWidth="1.2" />
                  </g>
                ) : (
                  /* JUGGLING CATCH POSITION (Holding up hand beneath juggling arc) */
                  <g transform="rotate(25)">
                    <path d="M 0 0 L 19 12 L 32 -2" fill="none" stroke="url(#spaceSuit)" strokeWidth="9.5" strokeLinecap="round" />
                    {/* Glove */}
                    <ellipse cx="32" cy="-2" rx="7.5" ry="6" fill="#475569" stroke="#64748b" strokeWidth="1.2" />
                  </g>
                )}
              </g>

              {/* ========================================================================= */}
              {/* ALIEN HEAD & ASTRONAUT BUBBLE HELMET (Centered at X=0)                    */}
              {/* ========================================================================= */}
              <g transform="translate(0, 10)">
                {/* Gold Helmet Neck Collar */}
                <ellipse cx="0" cy="36" rx="36" ry="10" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" />

                {/* Glass Bubble Helmet Dome (Radius 44) */}
                <circle
                  cx="0"
                  cy="0"
                  r="44"
                  fill="url(#alienHelmetGlass)"
                  stroke="#c084fc"
                  strokeWidth="2.5"
                  filter="url(#neonPurpleGlow)"
                />

                {/* Antennae sticking out through top mini-domes */}
                {/* Left Antenna */}
                <path d="M -16 -38 Q -26 -56 -28 -66" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
                <circle cx="-28" cy="-66" r="5.5" fill="#a855f7" filter="url(#neonPurpleGlow)" className="animate-pulse" />

                {/* Right Antenna */}
                <path d="M 16 -38 Q 26 -56 28 -66" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
                <circle cx="28" cy="-66" r="5.5" fill="#a855f7" filter="url(#neonPurpleGlow)" className="animate-pulse" />

                {/* The Cute Alien Inside the Visor */}
                <g transform="translate(0, 4)">
                  {/* Alien Head Oval */}
                  <ellipse cx="0" cy="0" rx="30" ry="25" fill="url(#alienSkin)" stroke="#059669" strokeWidth="1.5" />

                  {/* Big Adorable Cartoon / Anime Eyes */}
                  {/* Left Eye */}
                  <ellipse cx="-11" cy="-2" rx="8" ry="10.5" fill="#0f172a" />
                  <ellipse cx="-13" cy="-5.5" rx="3.5" ry="4.5" fill="#ffffff" />
                  <circle cx="-8.5" cy="2.5" r="2" fill="#ffffff" />

                  {/* Right Eye */}
                  <ellipse cx="11" cy="-2" rx="8" ry="10.5" fill="#0f172a" />
                  <ellipse cx="9" cy="-5.5" rx="3.5" ry="4.5" fill="#ffffff" />
                  <circle cx="13.5" cy="2.5" r="2" fill="#ffffff" />

                  {/* Cute Rosy Cheeks */}
                  <ellipse cx="-19" cy="7" rx="5" ry="2.5" fill="#f472b6" opacity="0.65" />
                  <ellipse cx="19" cy="7" rx="5" ry="2.5" fill="#f472b6" opacity="0.65" />

                  {/* Happy Mouth */}
                  <path d="M -6 8 Q 0 14 6 8" fill="none" stroke="#047857" strokeWidth="2" strokeLinecap="round" />
                </g>

                {/* Helmet Glass Curved Glare / Specular Highlight */}
                <path
                  d="M -28 -22 Q -8 -38 24 -28"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.8)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </g>

              {/* ========================================================================= */}
              {/* JUGGLING CLIPS: 3 HOLOGRAPHIC 9:16 VERTICAL CARDS (Symmetrically Centered)*/}
              {/* ========================================================================= */}
              {activePhase === 2 && (
                <g transform="translate(0, -42)">
                  {/* Juggling Arc 1: Clip A */}
                  <g className="juggle-card-1">
                    <rect
                      x="-17"
                      y="-27"
                      width="34"
                      height="54"
                      rx="7"
                      fill="#1e1035"
                      stroke="#f472b6"
                      strokeWidth="1.8"
                      filter="url(#neonPurpleGlow)"
                    />
                    {/* Facecam Top & Subtitles Bottom */}
                    <rect x="-12" y="-22" width="24" height="15" rx="3" fill="#3b0764" />
                    <circle cx="0" cy="-14" r="4" fill="#f472b6" />
                    <rect x="-12" y="-3" width="24" height="24" rx="3" fill="#0f172a" />
                    <rect x="-8" y="10" width="16" height="4" rx="1.5" fill="#38bdf8" />
                    <text x="0" y="-30" textAnchor="middle" fill="#f472b6" fontSize="7" fontWeight="bold">
                      9:16
                    </text>
                  </g>

                  {/* Juggling Arc 2: Clip B */}
                  <g className="juggle-card-2">
                    <rect
                      x="-17"
                      y="-27"
                      width="34"
                      height="54"
                      rx="7"
                      fill="#130e2e"
                      stroke="#a855f7"
                      strokeWidth="1.8"
                      filter="url(#neonPurpleGlow)"
                    />
                    <rect x="-12" y="-22" width="24" height="15" rx="3" fill="#2e1065" />
                    <circle cx="0" cy="-14" r="4" fill="#a855f7" />
                    <rect x="-12" y="-3" width="24" height="24" rx="3" fill="#0f172a" />
                    <rect x="-8" y="10" width="16" height="4" rx="1.5" fill="#facc15" />
                    <text x="0" y="-30" textAnchor="middle" fill="#c084fc" fontSize="7" fontWeight="bold">
                      HOOK
                    </text>
                  </g>

                  {/* Juggling Arc 3: Clip C */}
                  <g className="juggle-card-3">
                    <rect
                      x="-17"
                      y="-27"
                      width="34"
                      height="54"
                      rx="7"
                      fill="#0e1726"
                      stroke="#38bdf8"
                      strokeWidth="1.8"
                      filter="url(#neonPurpleGlow)"
                    />
                    <rect x="-12" y="-22" width="24" height="15" rx="3" fill="#075985" />
                    <circle cx="0" cy="-14" r="4" fill="#38bdf8" />
                    <rect x="-12" y="-3" width="24" height="24" rx="3" fill="#0f172a" />
                    <rect x="-8" y="10" width="16" height="4" rx="1.5" fill="#4ade80" />
                    <text x="0" y="-30" textAnchor="middle" fill="#38bdf8" fontSize="7" fontWeight="bold">
                      98% 🔥
                    </text>
                  </g>

                  {/* Juggling Sparkles & Energy Stars */}
                  <circle cx="-32" cy="-12" r="2" fill="#f472b6" className="animate-ping" />
                  <circle cx="32" cy="-18" r="2" fill="#38bdf8" className="animate-ping" />
                  <circle cx="0" cy="-56" r="2.5" fill="#facc15" className="animate-pulse" />
                </g>
              )}
            </g>
          </g>
        </svg>
      </div>

    </div>
  );
};
