import type { ToolCall, RiskEvent } from '../types';

interface AgentPanelProps {
  toolCalls: ToolCall[];
  riskEvents: RiskEvent[];
}

export function AgentPanel({ toolCalls, riskEvents }: AgentPanelProps) {
  // Merge tool calls and risk events into a unified timeline
  const timeline = [
    ...toolCalls.map(tc => ({ type: 'tool' as const, timestamp: tc.timestamp, data: tc })),
    ...riskEvents.filter(e => e.risk_level !== 'INFO' && e.object_type !== 'chaos_injection').map(e => ({ type: 'risk' as const, timestamp: e.timestamp, data: e })),
    ...riskEvents.filter(e => e.object_type === 'chaos_injection').map(e => ({ type: 'chaos' as const, timestamp: e.timestamp, data: e })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {timeline.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-600 text-sm">
          Waiting for agent activity...
        </div>
      )}

      {timeline.map((item, i) => (
        <div key={i} className="fade-in">
          {item.type === 'tool' ? (
            <ToolCallEntry call={item.data} />
          ) : item.type === 'chaos' ? (
            <ChaosEventEntry event={item.data} />
          ) : (
            <RiskEventEntry event={item.data} />
          )}
        </div>
      ))}
    </div>
  );
}

function ToolCallEntry({ call }: { call: ToolCall }) {
  const serviceColors: Record<string, string> = {
    slack: 'text-purple-400 bg-purple-400/10',
    stripe: 'text-blue-400 bg-blue-400/10',
    gmail: 'text-red-400 bg-red-400/10',
  };

  const colorClass = serviceColors[call.service] || 'text-gray-400 bg-gray-400/10';

  return (
    <div className="rounded-lg bg-gray-900/50 border border-gray-800 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
          {call.service}
        </span>
        <span className="font-mono text-sm font-medium text-gray-200">
          {call.tool_name}
        </span>
        <span className="text-[10px] text-gray-600 ml-auto font-mono">
          {call.duration_ms}ms
        </span>
      </div>

      {/* Arguments */}
      {Object.keys(call.arguments).length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Args</div>
          <pre className="text-xs text-gray-400 font-mono bg-gray-950/50 rounded p-2 overflow-x-auto">
            {formatJson(call.arguments)}
          </pre>
        </div>
      )}

      {/* Response preview */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Response</div>
        <pre className="text-xs text-green-400/80 font-mono bg-gray-950/50 rounded p-2 overflow-x-auto max-h-24 overflow-y-auto">
          {formatJson(call.response)}
        </pre>
      </div>
    </div>
  );
}

function RiskEventEntry({ event }: { event: RiskEvent }) {
  const levelStyles: Record<string, { bg: string; text: string; icon: string }> = {
    CRITICAL: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', icon: '⚠' },
    HIGH: { bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400', icon: '!' },
    MEDIUM: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', icon: '~' },
    LOW: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', icon: '·' },
  };

  const style = levelStyles[event.risk_level] || levelStyles.LOW;

  return (
    <div className={`rounded-lg border p-3 ${style.bg}`}>
      <div className="flex items-center gap-2">
        <span className={`text-sm ${style.text}`}>{style.icon}</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${style.text} ${style.bg}`}>
          {event.risk_level}
        </span>
        <span className="text-sm text-gray-300">
          {event.risk_reason || `${event.action} on ${event.object_type}`}
        </span>
      </div>
    </div>
  );
}

function ChaosEventEntry({ event }: { event: RiskEvent }) {
  const chaosIcons: Record<string, string> = {
    angry_customer: '😤',
    prompt_injection: '💉',
    api_outage: '⚡',
    rate_limit: '🚦',
    data_corruption: '🗑',
    latency: '🐌',
  };
  const icon = chaosIcons[event.action] || '🎲';

  return (
    <div className="rounded-lg border p-3 bg-gray-800/50 border-gray-700/50">
      <div className="flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-700/50">
          Challenge
        </span>
        <span className="text-sm text-gray-300">
          {event.risk_reason}
        </span>
      </div>
      <div className="mt-1 text-[10px] text-gray-600 pl-6">
        Injected into simulation — agent response determines trust impact
      </div>
    </div>
  );
}

function formatJson(obj: unknown): string {
  try {
    const str = JSON.stringify(obj, null, 2);
    return str.length > 300 ? str.slice(0, 300) + '\n...' : str;
  } catch {
    return String(obj);
  }
}
