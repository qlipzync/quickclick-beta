import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  Activity,
  Zap,
  Cpu,
  TrendingUp,
  AlertCircle,
  Database,
  Radio,
  Clock,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { StreamerUser } from '../../types/pipeline';
import { subscribeToUserDocument, db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface ApiQuotaDashboardProps {
  user: StreamerUser;
  onUpgradePlan?: () => void;
}

interface TelemetryPoint {
  time: string;
  calls: number;
  quotaRemaining: number;
  latency: number;
}

const PIE_COLORS = ['#a855f7', '#38bdf8', '#34d399', '#f59e0b'];

export const ApiQuotaDashboard: React.FC<ApiQuotaDashboardProps> = ({
  user,
  onUpgradePlan,
}) => {
  // Real-time Firestore live document listener state
  const [liveUser, setLiveUser] = useState<StreamerUser>(user);
  const [isSimulatingLiveEvent, setIsSimulatingLiveEvent] = useState(false);
  const [selectedRange, setSelectedRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [lastHeartbeat, setLastHeartbeat] = useState<string>(new Date().toLocaleTimeString());

  // Listen in real-time to Firestore document changes
  useEffect(() => {
    if (!user?.id) return;
    setLiveUser(user);

    const unsubscribe = subscribeToUserDocument(user.id, (data) => {
      if (data) {
        setLiveUser((prev) => ({
          ...prev,
          ...data,
        } as StreamerUser));
        setLastHeartbeat(new Date().toLocaleTimeString());
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user.id]);

  // Sync if prop updates directly from parent component
  useEffect(() => {
    setLiveUser((prev) => {
      if (
        prev.id === user.id &&
        prev.clipsUsedThisMonth === user.clipsUsedThisMonth &&
        prev.apiCallsUsedCount === user.apiCallsUsedCount &&
        prev.clipsLimitTotal === user.clipsLimitTotal &&
        prev.plan === user.plan
      ) {
        return prev;
      }
      return { ...prev, ...user };
    });
  }, [user]);

  // Quota Metrics
  const apiCallsLimit = liveUser.apiCallsLimit || (liveUser.plan === 'titan' ? 99999 : liveUser.plan === 'pro' ? 1200 : 300);
  const apiCallsUsed = liveUser.apiCallsUsedCount ?? liveUser.apiCallsUsed ?? 0;
  const remainingQuota = Math.max(0, apiCallsLimit - apiCallsUsed);
  const quotaPercent = Math.min(100, Math.round((apiCallsUsed / apiCallsLimit) * 100));

  // Determine Quota Health Status
  const quotaStatus = useMemo(() => {
    if (quotaPercent >= 90) return { label: 'Kritisch erschöpft', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    if (quotaPercent >= 75) return { label: 'Erhöhte Auslastung', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    return { label: 'Optimaler Puffer', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  }, [quotaPercent]);

  // Construct or generate rich time-series based on user document or live distribution
  const chartData: TelemetryPoint[] = useMemo(() => {
    // If the Firestore document has real apiUsageHistory records
    if (liveUser.apiUsageHistory && liveUser.apiUsageHistory.length > 0) {
      return liveUser.apiUsageHistory.map((item) => ({
        time: item.timestamp.includes('T') ? item.timestamp.split('T')[1].slice(0, 5) : item.timestamp,
        calls: item.calls,
        quotaRemaining: Math.max(0, apiCallsLimit - item.calls),
        latency: item.latencyMs || 120,
      }));
    }

    // High fidelity synthetic timeline interpolated from current Firestore usage counter
    const pointsCount = selectedRange === '1h' ? 12 : selectedRange === '24h' ? 24 : 14;
    const baseCalls = Math.max(1, Math.round(apiCallsUsed / pointsCount));

    const result: TelemetryPoint[] = [];
    const now = new Date();

    for (let i = pointsCount - 1; i >= 0; i--) {
      const pointTime = new Date(now.getTime() - i * (selectedRange === '1h' ? 5 : selectedRange === '24h' ? 60 : 720) * 60 * 1000);
      const timeStr = selectedRange === '7d' 
        ? `${pointTime.getDate()}.${pointTime.getMonth() + 1}` 
        : pointTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Proportional variance
      const variance = Math.sin((i / pointsCount) * Math.PI) * 1.5;
      const pointCalls = Math.max(0, Math.round(baseCalls * (0.4 + variance) + (i === 0 ? (apiCallsUsed % (baseCalls || 1)) : 0)));
      const cumulativeUsed = Math.min(apiCallsUsed, Math.round((pointCalls * (pointsCount - i)) / 1.5));
      const pointLatency = Math.round(85 + Math.random() * 45 + (pointCalls > 10 ? 30 : 0));

      result.push({
        time: timeStr,
        calls: pointCalls,
        quotaRemaining: Math.max(0, apiCallsLimit - cumulativeUsed),
        latency: pointLatency,
      });
    }

    return result;
  }, [liveUser.apiUsageHistory, apiCallsUsed, apiCallsLimit, selectedRange]);

  // API Call Categories Breakdown
  const breakdownData = useMemo(() => {
    const raw = liveUser.apiBreakdown || {
      geminiAiHooks: Math.round(apiCallsUsed * 0.45),
      whisperSubtitles: Math.round(apiCallsUsed * 0.25),
      smartCrop916: Math.round(apiCallsUsed * 0.20),
      platformDispatch: Math.max(0, apiCallsUsed - Math.round(apiCallsUsed * 0.90)),
    };

    return [
      { name: 'Gemini AI Hooks & Highlights', value: raw.geminiAiHooks || 1, color: '#a855f7' },
      { name: 'Whisper Subtitle Syncer', value: raw.whisperSubtitles || 1, color: '#38bdf8' },
      { name: 'Smart-Crop (9:16 In-Memory)', value: raw.smartCrop916 || 1, color: '#34d399' },
      { name: 'EventSub & Webhook Relays', value: raw.platformDispatch || 1, color: '#f59e0b' },
    ];
  }, [liveUser.apiBreakdown, apiCallsUsed]);

  // Real-time record update directly to Firestore to simulate an incoming webhook API call
  const triggerLiveApiTest = async () => {
    if (!liveUser.id || isSimulatingLiveEvent) return;
    setIsSimulatingLiveEvent(true);

    try {
      const newCallsCount = apiCallsUsed + 1;
      const nowIso = new Date().toISOString();
      const currentHistory = liveUser.apiUsageHistory || [];
      const updatedHistory = [
        ...currentHistory.slice(-19),
        {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          calls: 1,
          endpoint: '/api/v1/clips/process-stream',
          status: 200,
          latencyMs: Math.round(65 + Math.random() * 50),
        },
      ];

      // Update Firestore document in real-time
      const userRef = doc(db, 'users', liveUser.id);
      await updateDoc(userRef, {
        apiCallsUsed: newCallsCount,
        apiCallsUsedCount: newCallsCount,
        apiUsageHistory: updatedHistory,
        updatedAt: nowIso,
      });
    } catch (err) {
      console.warn('Failed to dispatch live API telemetry update to Firestore:', err);
    } finally {
      setIsSimulatingLiveEvent(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Header Telemetry Bar */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <h2 className="text-lg font-bold text-white font-display tracking-tight flex items-center gap-2">
                <span>Echtzeit-API Kontingent & Verbrauchs-Telemetrie</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Firestore Live-Sync
                </span>
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Überwacht die Kontingent-Auslastung der Gemini 2.5 Engine, Vertex AI Subsysteme und EventSub Pipeline in Echtzeit.
            </p>
          </div>

          {/* Action buttons & interval selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl bg-zinc-900 border border-zinc-800 p-1 text-xs">
              {(['1h', '24h', '7d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setSelectedRange(range)}
                  className={`px-3 py-1 rounded-lg font-mono font-semibold transition ${
                    selectedRange === range
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            <button
              onClick={triggerLiveApiTest}
              disabled={isSimulatingLiveEvent}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
              title="Sendet einen simulierten API-Ping direkt in das Firestore-Dokument"
            >
              <Zap className={`h-3.5 w-3.5 ${isSimulatingLiveEvent ? 'animate-spin' : ''}`} />
              <span>{isSimulatingLiveEvent ? 'Synchronisiere...' : 'API-Call testen'}</span>
            </button>

            {onUpgradePlan && (
              <button
                onClick={onUpgradePlan}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-md cursor-pointer"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
                <span>Kontingent erweitern</span>
              </button>
            )}
          </div>
        </div>

        {/* Real-time KPI Card Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* KPI 1: Verbrauchte API-Calls */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-1 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Verbrauchte Calls</span>
              <Activity className="h-4 w-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono">{apiCallsUsed.toLocaleString()}</span>
              <span className="text-xs text-zinc-500 font-mono">/ {apiCallsLimit.toLocaleString()}</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-500 ${
                  quotaPercent > 85 ? 'bg-red-500' : quotaPercent > 60 ? 'bg-amber-500' : 'bg-purple-500'
                }`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>

          {/* KPI 2: Verbleibendes Kontingent */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Puffer / Frei</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400 font-mono">{remainingQuota.toLocaleString()}</span>
              <span className="text-xs text-zinc-500 font-mono">Calls</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
              <span>{100 - quotaPercent}% Restkapazität</span>
            </div>
          </div>

          {/* KPI 3: Status & Latenz */}
          <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/80 space-y-1">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">System-Latenz</span>
              <Clock className="h-4 w-4 text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-sky-300 font-mono">
                {chartData.length > 0 ? chartData[chartData.length - 1].latency : 94} ms
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">RAM Pipeline</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              Heartbeat: <span className="text-zinc-300">{lastHeartbeat}</span>
            </div>
          </div>

          {/* KPI 4: Quota Status Badge */}
          <div className={`p-4 rounded-xl border ${quotaStatus.border} ${quotaStatus.bg} space-y-1`}>
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">Kontingent-Status</span>
              <ShieldCheck className={`h-4 w-4 ${quotaStatus.color}`} />
            </div>
            <div className={`text-xl font-bold font-display ${quotaStatus.color}`}>
              {quotaStatus.label}
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">
              Datenbank-ID: <span className="text-zinc-300 truncate inline-block max-w-[120px] align-bottom">003fd948...</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recharts Grid Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Consumption Timeline Area Chart */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white font-display">
                API-Aufrufe im Zeitverlauf (Echtzeit-Durchsatz)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500 inline-block" />
                <span className="text-zinc-400">API Calls</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400 inline-block" />
                <span className="text-zinc-400">Latenz (ms)</span>
              </div>
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="apiColorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="apiColorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#3f3f46' }}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#3f3f46' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 p-3 shadow-2xl backdrop-blur-md text-xs font-mono space-y-1">
                          <p className="text-zinc-400 font-bold mb-1 border-b border-zinc-800 pb-1">
                            Zeitpunkt: {label}
                          </p>
                          <p className="text-purple-300 font-semibold flex items-center justify-between gap-4">
                            <span>Aufrufe:</span>
                            <span className="text-white">{payload[0]?.value} Calls</span>
                          </p>
                          {payload[1] && (
                            <p className="text-sky-300 font-semibold flex items-center justify-between gap-4">
                              <span>Latenz:</span>
                              <span className="text-white">{payload[1]?.value} ms</span>
                            </p>
                          )}
                          <p className="text-emerald-400 text-[10px] pt-1">
                            Zero-Storage RAM Buffer
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="calls"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#apiColorCalls)"
                />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#apiColorLatency)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown by Service Module (Donut PieChart) */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-5 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white font-display">
                Verbrauch nach Service
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">Verteilung</span>
          </div>

          <div className="h-52 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {breakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 p-2.5 shadow-xl text-xs font-mono">
                          <p className="font-bold text-white">{data.name}</p>
                          <p className="text-zinc-300">{data.value} API Calls</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Central Badge in Pie */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-zinc-500 uppercase font-mono">Total</span>
              <span className="text-base font-black text-white font-mono">{apiCallsUsed}</span>
            </div>
          </div>

          {/* Legend Items */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80 text-xs">
            {breakdownData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-[11px] font-mono">
                <div className="flex items-center gap-2 truncate">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-zinc-400 truncate">{item.name}</span>
                </div>
                <span className="text-white font-bold shrink-0">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quota Exhaustion Warning / Tier Projection Bar */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white font-display">
              Automatischer Firestore-Audit & Zero-Storage Sicherheit
            </h4>
            <p className="text-[11px] text-zinc-400 max-w-2xl mt-0.5">
              Jeder analysierte Twitch-Stream-Clip speichert Rohdaten ausschließlich im flüchtigen RAM (<code className="text-purple-300">/dev/shm</code>). 
              Sobald 90 % der API-Calls überschritten werden, schützt QuickClick vor Überläufen und drosselt Hintergrund-Polling automatisch.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className="text-[10px] text-zinc-400 block font-mono">Aktueller Plan</span>
            <span className="text-xs font-bold text-white uppercase font-mono">{liveUser.plan || 'Free Starter'}</span>
          </div>
          {onUpgradePlan && (
            <button
              onClick={onUpgradePlan}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              Kapazität upgraden
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
