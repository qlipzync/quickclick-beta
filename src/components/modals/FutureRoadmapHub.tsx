import React from 'react';
import { Sparkles, Rocket, CheckCircle2, Clock } from 'lucide-react';

interface FutureRoadmapHubProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const FutureRoadmapHub: React.FC<FutureRoadmapHubProps> = () => {
  const roadmapItems = [
    { title: 'Kick.com Integration', status: 'In Entwicklung', q: 'Q4 2026' },
    { title: 'Multilingual AI Voice-Dubbing', status: 'Geplant', q: 'Q1 2027' },
    { title: 'Automatisierte YouTube Community Posts', status: 'Live', q: 'Jetzt aktiv' },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 space-y-4">
      <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
        <Rocket className="h-5 w-5 text-purple-400" />
        <span>QlipZync Produkt-Roadmap</span>
      </h3>
      <div className="space-y-2">
        {roadmapItems.map((item, idx) => (
          <div key={idx} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between text-xs">
            <span className="font-semibold text-white">{item.title}</span>
            <span className="text-purple-300 font-mono">{item.status} ({item.q})</span>
          </div>
        ))}
      </div>
    </div>
  );
};
