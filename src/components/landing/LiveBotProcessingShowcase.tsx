import React, { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';
import { AlienAstronautJuggler } from './AlienAstronautJuggler';

export interface QuickClickEngineData {
  clip_analysis: {
    virality_score: number;
    highlight_summary: string;
    hook_timestamp: string;
    peak_action_timestamp: string;
    recommended_trim: {
      start: string;
      end: string;
    };
  };
  content_generation: {
    viral_hooks: string[];
    social_posts: {
      tiktok: {
        title: string;
        caption: string;
        hashtags: string[];
      };
      youtube_shorts: {
        title: string;
        description: string;
        hashtags: string[];
      };
      reels: {
        caption: string;
        hashtags: string[];
      };
    };
    call_to_action: string;
  };
}

interface StreamerScenario {
  channel: string;
  category: string;
  clipTitle: string;
  viralityScore: number;
  hookText: string;
  cropFocus: 'facecam_top_gameplay_bottom' | 'center' | 'split';
  platforms: string[];
  twitchUrl: string;
  views: string;
  latencySec: number;
  quickClickData: QuickClickEngineData;
}

const SCENARIOS: StreamerScenario[] = [
  {
    channel: 'sh00trstv',
    category: 'FPS & Battle Royale',
    clipTitle: 'Insane 1v4 Final Ring Clutch! 🔥',
    viralityScore: 98,
    hookText: 'DAS IST DER KRANKESTE CLUTCH DES JAHRES! 🎯',
    cropFocus: 'facecam_top_gameplay_bottom',
    platforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels'],
    twitchUrl: 'https://www.twitch.tv/sh00trstv',
    views: '3.2M+ Views',
    latencySec: 42,
    quickClickData: {
      clip_analysis: {
        virality_score: 98,
        highlight_summary: 'sh00trstv clutches an intense 1v4 final ring battle against impossible odds, reacting with pure euphoria.',
        hook_timestamp: '00:00 - 00:03',
        peak_action_timestamp: '00:14 - 00:19',
        recommended_trim: {
          start: '00:00',
          end: '00:28',
        },
      },
      content_generation: {
        viral_hooks: [
          'Wait until you see how this push ended...',
          'Nobody expected this round to flip so fast.',
          'The exact second the lobby realized what happened.',
        ],
        social_posts: {
          tiktok: {
            title: 'This clutch had no right working out 💀',
            caption: 'When the timing aligns perfectly. Catch the next stream on Twitch/Kick! #gaming #clutch #streamer',
            hashtags: ['#gaming', '#twitchclips', '#streamer', '#fpshighlights', '#clutchmoment'],
          },
          youtube_shorts: {
            title: 'How to Win a 1v3 in 5 Seconds 🔥 Final Ring Apex Play',
            description: "Insane reaction clutch during today's live stream. Like and subscribe for daily competitive clips and highlights!",
            hashtags: ['#Shorts', '#GamingShorts', '#ClutchMoment', '#StreamerHighlights'],
          },
          reels: {
            caption: 'Never give up on a play until the screen goes black. 🎮 Drop a follow for daily live stream highlights!',
            hashtags: ['#gamingreels', '#streamerlife', '#highlight', '#esports'],
          },
        },
        call_to_action: 'Follow on Twitch & Kick for daily live matches and competitive clutches.',
      },
    },
  },
  {
    channel: 'twoandahalfeafc',
    category: 'EA Sports FC 25 Specialist',
    clipTitle: 'ICON PACK OPENING REACTION! 😱 TOTY DROP',
    viralityScore: 95,
    hookText: 'ICH GLAUB ES NICHT... DAS GIBT ES NICHT! ⚽🏆',
    cropFocus: 'split',
    platforms: ['TikTok', 'YouTube Shorts', 'Instagram Reels', 'X'],
    twitchUrl: 'https://www.twitch.tv/twoandahalfeafc',
    views: '4.8M+ Views',
    latencySec: 36,
    quickClickData: {
      clip_analysis: {
        virality_score: 95,
        highlight_summary: 'twoandahalfeafc pulls an untradeable Team of the Year icon, unleashing an uncontrolled celebratory reaction.',
        hook_timestamp: '00:00 - 00:03',
        peak_action_timestamp: '00:08 - 00:14',
        recommended_trim: {
          start: '00:00',
          end: '00:24',
        },
      },
      content_generation: {
        viral_hooks: [
          'I screamed so loud my neighbor knocked on the door...',
          'Do NOT open your packs without seeing this first.',
          'EA finally gave me what I deserved after 5 years.',
        ],
        social_posts: {
          tiktok: {
            title: 'THE ICON PACK ACTUALLY PAID OUT 😭🔥',
            caption: "My hands were shaking the entire walkout. Follow for tonight's weekend league run live! #fc25 #packopening #streamer",
            hashtags: ['#fc25', '#toty', '#packopening', '#twitchstreamer', '#gaming'],
          },
          youtube_shorts: {
            title: 'Insane TOTY Icon Pack Opening Reaction! ⚽🏆',
            description: 'Unbelievable walkout during today\'s live pack session. Drop a like and subscribe for more live openings!',
            hashtags: ['#Shorts', '#GamingShorts', '#FC25', '#PackOpening'],
          },
          reels: {
            caption: 'Proof that miracles still happen in ultimate team. 🏆 Catch the next pack opening live!',
            hashtags: ['#gamingreels', '#ultimateteam', '#streamerlife', '#fifaclips'],
          },
        },
        call_to_action: 'Drop a follow on Twitch & Kick to catch the next live pack opening.',
      },
    },
  },
];

export const SYSTEM_INSTRUCTION_TEXT = `You are QuickClick Engine, an elite multimodal video intelligence and social media distribution agent specialized in live streams, gaming highlights, and fast-paced gameplay.

Your task is to analyze submitted video clips frame-by-frame and second-by-second to identify high-retention moments, evaluate viral potential, and generate high-converting social media metadata (TikTok, YouTube Shorts, Instagram Reels, X/Kick/Twitch).

### CORE ANALYSIS RULES
1. Multi-Modal Vision & Audio:
   - Identify the exact climax or peak action (kills, clutches, fails, high-intensity streamer reactions, audio spikes).
   - Evaluate the first 3 seconds (The Hook): Check visual velocity, text overlays, and audio cues to determine instant retention impact.
   - Pacing & Flow: Determine dead air vs. continuous action.

2. Virality Scoring (0 to 100):
   - 90-100: Exceptional clip (fast hook, loud/authentic reaction, high-skill clutch or rare RNG).
   - 75-89: Solid highlight with strong retention potential.
   - 50-74: Standard gameplay, requires heavy pacing cuts or strong captioning.
   - Below 50: Low energy, slow progression, or unclear focus.

3. Platform-Specific Copywriting:
   - TikTok / Reels: High intrigue, bold hooks, curiosity gaps, punchy punchlines, short & conversational.
   - YouTube Shorts: Clear keyword-rich titles, searchable context, strong action verbs.
   - Streamer Retention CTA: Organic calls to action tailored to following the channel or catching the next live stream.

4. STRICT PRODUCTION-READY DATA (ZERO PLACEHOLDERS):
   - NEVER use placeholders, template tokens, or bracketed variables (e.g., NO "[Insert Game]", NO "[StreamerName]", NO "<timestamp>", NO "TODO", NO "Lorem Ipsum").
   - Every single field must contain fully finalized, deployable, human-readable copy.
   - If a specific piece of information (such as the player's name or exact game title) cannot be visually identified from the UI, HUD, or audio, craft complete, natural copy that works autonomously without referencing missing variables.
   - Timestamps must represent actual, calculated intervals directly derived from the analyzed video's exact duration (e.g., "00:03 - 00:18"), never theoretical or template numbers.

5. Output Constraints:
   - Always return strictly valid JSON matching the requested schema.
   - Do NOT wrap the JSON in conversational filler (no "Here is your JSON:", no post-analysis text).
   - All fields in the schema must be fully populated with final production values.`;

export const LiveBotProcessingShowcase: React.FC = () => {
  const [activeScenarioIdx] = useState(0);
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3>(1);

  const scenario = SCENARIOS[activeScenarioIdx];

  // Auto-cycle stages to simulate real bot work
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStage((prev) => (prev === 3 ? 1 : ((prev + 1) as 1 | 2 | 3)));
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full space-y-8">
      {/* Top Header */}
      <header className="text-center space-y-3 max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold tracking-wider uppercase">
          <Bot className="h-4 w-4 text-fuchsia-400 animate-bounce" />
          <span>AUTONOMER BOT-AUTOPILOT IN ECHTZEIT</span>
        </span>
        <h2 className="text-2xl sm:text-4xl font-black font-display uppercase tracking-wide text-white">
          Bot-Pipeline live im Einsatz
        </h2>
        <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-2xl mx-auto">
          Erlebe die Zero-Storage KI-Engine in Aktion: Der Bot fängt Twitch-Peaks ab, transkodiert im flüchtigen RAM (/dev/shm)
          und postet autonom auf alle Social-Media-Kanäle.
        </p>
      </header>

      {/* Main Bot Animation Holo-Display */}
      <figure className="rounded-3xl border border-purple-500/30 bg-gradient-to-b from-[#140b2f] via-[#0d0724] to-[#070514] p-6 sm:p-10 shadow-2xl relative overflow-hidden flex justify-center w-full max-w-4xl mx-auto m-0">
        <AlienAstronautJuggler
          currentStage={currentStage}
          channelName={scenario.channel}
          clipTitle={scenario.clipTitle}
        />
      </figure>
    </div>
  );
};
