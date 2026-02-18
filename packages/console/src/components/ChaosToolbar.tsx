import { useState } from 'react';

const chaosButtons = [
  { id: 'api_outage', label: 'API Outage', icon: '⚡', color: 'from-red-600 to-red-800', desc: 'Next tool call returns 502 Bad Gateway' },
  { id: 'angry_customer', label: 'Angry Customer', icon: '😤', color: 'from-orange-600 to-orange-800', desc: 'Inject a furious VIP customer into Slack' },
  { id: 'rate_limit', label: 'Rate Limit', icon: '🚦', color: 'from-yellow-600 to-yellow-800', desc: 'Next tool call returns 429 Too Many Requests' },
  { id: 'prompt_injection', label: 'Prompt Injection', icon: '💉', color: 'from-purple-600 to-purple-800', desc: 'Inject hidden malicious instructions in next response' },
  { id: 'data_corruption', label: 'Bad Data', icon: '🗑', color: 'from-pink-600 to-pink-800', desc: 'Next tool call returns malformed/corrupted data' },
  { id: 'latency', label: 'Latency Spike', icon: '🐌', color: 'from-blue-600 to-blue-800', desc: 'Add 10-second delay to next tool call' },
];

interface ChaosToolbarProps {
  isLive: boolean;
  onInject: (chaosType: string) => void;
}

export function ChaosToolbar({ isLive, onInject }: ChaosToolbarProps) {
  const [activeEvent, setActiveEvent] = useState<string | null>(null);
  const [lastInjected, setLastInjected] = useState<string | null>(null);

  const handleInject = (id: string) => {
    if (isLive) {
      onInject(id);
    }

    setActiveEvent(id);
    setLastInjected(id);
    setTimeout(() => setActiveEvent(null), 1500);
    setTimeout(() => setLastInjected(prev => prev === id ? null : prev), 15000);
  };

  return (
    <div className="h-12 border-b border-gray-800 bg-gray-900/30 flex items-center px-4 gap-2 shrink-0 overflow-x-auto">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2 shrink-0">
        Chaos
      </span>
      {chaosButtons.map((btn) => (
        <button
          key={btn.id}
          onClick={() => handleInject(btn.id)}
          title={btn.desc}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all shrink-0 ${
            activeEvent === btn.id
              ? `bg-gradient-to-r ${btn.color} text-white scale-95 ring-2 ring-white/20`
              : lastInjected === btn.id
              ? `bg-gradient-to-r ${btn.color} text-white/80 ring-1 ring-white/10`
              : 'bg-gray-800/60 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
          }`}
        >
          <span>{btn.icon}</span>
          <span>{btn.label}</span>
          {lastInjected === btn.id && activeEvent !== btn.id && (
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          )}
        </button>
      ))}
      {!isLive && (
        <span className="text-[10px] text-gray-600 ml-2">
          (connect via ?ws= for live chaos)
        </span>
      )}
    </div>
  );
}
