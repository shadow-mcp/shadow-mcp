import { useEffect, useRef } from 'react';
import type { ToolCall, RiskEvent } from '../types';

interface AgentPanelProps {
  toolCalls: ToolCall[];
  riskEvents: RiskEvent[];
  viewingIndex?: number;
}

export function AgentPanel({ toolCalls, riskEvents, viewingIndex }: AgentPanelProps) {
  // When viewingIndex is provided, only show tool calls up to that step
  const visibleToolCalls = viewingIndex !== undefined
    ? toolCalls.slice(0, viewingIndex + 1)
    : toolCalls;

  // Only show risk events that occurred at or before the viewed tool call's timestamp
  const cutoffTime = viewingIndex !== undefined && visibleToolCalls.length > 0
    ? visibleToolCalls[visibleToolCalls.length - 1].timestamp + 1
    : Infinity;

  const visibleRisks = riskEvents.filter(e => e.timestamp <= cutoffTime);

  // Merge tool calls and risk events into a unified timeline
  const timeline = [
    ...visibleToolCalls.map((tc, idx) => ({ type: 'tool' as const, timestamp: tc.timestamp, data: tc, stepIndex: idx })),
    ...visibleRisks.filter(e => e.risk_level !== 'INFO' && e.object_type !== 'chaos_injection').map(e => ({ type: 'risk' as const, timestamp: e.timestamp, data: e, stepIndex: -1 })),
    ...visibleRisks.filter(e => e.object_type === 'chaos_injection').map(e => ({ type: 'chaos' as const, timestamp: e.timestamp, data: e, stepIndex: -1 })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  // Auto-scroll to keep the current step visible
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentStepRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    currentStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [viewingIndex]);

  const currentIdx = viewingIndex ?? -1;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
      {timeline.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-600 text-sm">
          Waiting for agent activity...
        </div>
      )}

      {timeline.map((item, i) => {
        const isCurrent = item.type === 'tool' && item.stepIndex === currentIdx;
        return (
          <div
            key={i}
            ref={isCurrent ? currentStepRef : undefined}
            className={`fade-in transition-opacity ${
              item.type === 'tool' && item.stepIndex !== currentIdx ? 'opacity-40' : ''
            }`}
          >
            {item.type === 'tool' ? (
              <ToolCallEntry call={item.data} highlighted={isCurrent} />
            ) : item.type === 'chaos' ? (
              <ChaosEventEntry event={item.data} />
            ) : (
              <RiskEventEntry event={item.data} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ToolCallEntry({ call, highlighted }: { call: ToolCall; highlighted?: boolean }) {
  const serviceColors: Record<string, string> = {
    slack: 'text-purple-400 bg-purple-400/10',
    stripe: 'text-blue-400 bg-blue-400/10',
    gmail: 'text-red-400 bg-red-400/10',
  };

  const colorClass = serviceColors[call.service] || 'text-gray-400 bg-gray-400/10';

  return (
    <div className={`rounded-lg p-3 ${
      highlighted
        ? 'bg-gray-900/80 border-2 border-shadow-500/50 ring-1 ring-shadow-500/20'
        : 'bg-gray-900/50 border border-gray-800'
    }`}>
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
