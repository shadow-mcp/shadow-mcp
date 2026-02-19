import { useState, useEffect, useRef } from 'react';
import type { ToolCall, RiskEvent } from '../types';

interface NarrationBarProps {
  toolCalls: ToolCall[];
  riskEvents: RiskEvent[];
  viewingIndex: number;
  isAutoPlay: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleAutoPlay: () => void;
}

/** Maps a tool call to a human-readable narration */
function describeToolCall(tc: ToolCall): { icon: string; text: string; color: string } {
  const args = tc.arguments || {};
  const channel = String(args.channel || '');
  const to = String(args.to || '');

  switch (tc.tool_name) {
    // Gmail
    case 'list_messages':
      return { icon: '\uD83D\uDCE7', text: 'Reading inbox...', color: 'gmail' };
    case 'get_message':
      return { icon: '\uD83D\uDCD6', text: 'Reading email...', color: 'gmail' };
    case 'send_email':
      return { icon: '\u2709\uFE0F', text: `Sending email to ${to}...`, color: 'gmail' };
    case 'create_draft':
      return { icon: '\uD83D\uDCDD', text: 'Drafting email...', color: 'gmail' };
    case 'delete_message':
      return { icon: '\uD83D\uDDD1\uFE0F', text: 'Deleting email...', color: 'gmail' };

    // Slack
    case 'list_channels':
      return { icon: '\uD83D\uDCAC', text: 'Checking Slack channels...', color: 'slack' };
    case 'get_channel_history':
      return { icon: '\uD83D\uDCDC', text: `Reading #${channel} history...`, color: 'slack' };
    case 'post_message':
      return { icon: '\uD83D\uDCAC', text: `Posting in #${channel}...`, color: 'slack' };
    case 'send_direct_message':
      return { icon: '\uD83D\uDCAC', text: `DMing ${String(args.user || 'user')}...`, color: 'slack' };

    // Stripe
    case 'create_customer':
      return { icon: '\uD83D\uDCB3', text: 'Creating customer...', color: 'stripe' };
    case 'create_charge': {
      const amount = Number(args.amount || 0);
      const dollars = amount > 0 ? ` ($${(amount / 100).toFixed(2)})` : '';
      return { icon: '\uD83D\uDCB3', text: `Creating charge${dollars}...`, color: 'stripe' };
    }
    case 'create_refund': {
      const amount = Number(args.amount || 0);
      const dollars = amount > 0 ? ` ($${(amount / 100).toFixed(2)})` : '';
      return { icon: '\uD83D\uDCB3', text: `Processing refund${dollars}...`, color: 'stripe' };
    }
    case 'list_charges':
      return { icon: '\uD83D\uDCB3', text: 'Listing charges...', color: 'stripe' };
    case 'list_customers':
      return { icon: '\uD83D\uDCB3', text: 'Listing customers...', color: 'stripe' };

    default:
      return { icon: '\u2699\uFE0F', text: `${tc.tool_name}...`, color: tc.service };
  }
}

/** Color classes by service */
function serviceColors(service: string): { bg: string; text: string; border: string } {
  switch (service) {
    case 'gmail': return { bg: 'bg-red-500/10', text: 'text-red-300', border: 'border-red-500/20' };
    case 'slack': return { bg: 'bg-purple-500/10', text: 'text-purple-300', border: 'border-purple-500/20' };
    case 'stripe': return { bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/20' };
    default: return { bg: 'bg-gray-500/10', text: 'text-gray-300', border: 'border-gray-500/20' };
  }
}

export function NarrationBar({ toolCalls, riskEvents, viewingIndex, isAutoPlay, onPrev, onNext, onToggleAutoPlay }: NarrationBarProps) {
  const [riskFlash, setRiskFlash] = useState<{ level: string; message: string } | null>(null);
  const prevRiskCountRef = useRef(riskEvents.length);
  const [animKey, setAnimKey] = useState(0);

  // Flash risk events (CRITICAL/HIGH only) — suppress during step-through mode
  useEffect(() => {
    if (!isAutoPlay) {
      prevRiskCountRef.current = riskEvents.length;
      return;
    }
    if (riskEvents.length > prevRiskCountRef.current) {
      const newest = riskEvents[riskEvents.length - 1];
      if (newest.risk_level === 'CRITICAL' || newest.risk_level === 'HIGH') {
        if (newest.object_type !== 'chaos_injection') {
          setRiskFlash({ level: newest.risk_level, message: newest.risk_reason || newest.action });
          setTimeout(() => setRiskFlash(null), 4000);
        }
      }
    }
    prevRiskCountRef.current = riskEvents.length;
  }, [riskEvents.length, isAutoPlay]);

  // Animate on viewing index change
  const prevIndexRef = useRef(viewingIndex);
  useEffect(() => {
    if (viewingIndex !== prevIndexRef.current) {
      setAnimKey(k => k + 1);
    }
    prevIndexRef.current = viewingIndex;
  }, [viewingIndex]);

  if (toolCalls.length === 0 && !riskFlash) return null;

  // Risk flash takes priority
  if (riskFlash) {
    const isCritical = riskFlash.level === 'CRITICAL';
    return (
      <div className={`px-4 py-1.5 border-b flex items-center gap-2 transition-all ${
        isCritical
          ? 'bg-red-500/15 border-red-500/30'
          : 'bg-orange-500/10 border-orange-500/20'
      }`}>
        <span className="text-sm">{isCritical ? '\uD83D\uDEA8' : '\u26A0\uFE0F'}</span>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
          isCritical
            ? 'bg-red-500/20 text-red-400'
            : 'bg-orange-500/20 text-orange-400'
        }`}>
          {riskFlash.level}
        </span>
        <span className={`text-xs font-medium ${isCritical ? 'text-red-300' : 'text-orange-300'}`}>
          {riskFlash.message}
        </span>
      </div>
    );
  }

  if (toolCalls.length === 0) return null;

  const tc = toolCalls[viewingIndex] || toolCalls[toolCalls.length - 1];
  const narration = describeToolCall(tc);
  const colors = serviceColors(narration.color);
  const isAtEnd = viewingIndex >= toolCalls.length - 1;
  const isAtStart = viewingIndex <= 0;

  return (
    <div
      key={animKey}
      className={`px-4 py-1.5 border-b flex items-center gap-2 narration-slide ${colors.bg} ${colors.border}`}
    >
      {/* Step controls */}
      <div className="flex items-center gap-1 shrink-0 relative">
        <button
          onClick={onPrev}
          disabled={isAtStart}
          className="w-5 h-5 rounded flex items-center justify-center text-[10px] text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title="Previous step"
        >
          {'\u25C0'}
        </button>
        <span className="text-[10px] text-gray-500 tabular-nums w-12 text-center">
          {viewingIndex + 1}/{toolCalls.length}
        </span>
        <button
          onClick={onNext}
          className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all ${
            !isAutoPlay
              ? 'text-shadow-400 bg-shadow-500/20 ring-1 ring-shadow-500/40 hover:bg-shadow-500/30 animate-pulse'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          title={isAtEnd ? 'Finish' : 'Next step'}
        >
          {isAtEnd ? '\u2713' : '\u25B6'}
        </button>

        {/* First-step hint — clean label pointing at Next button */}
        {viewingIndex === 0 && !isAutoPlay && (
          <div className="absolute left-12 top-9 pointer-events-none z-10">
            <div className="flex items-center gap-1.5 animate-bounce">
              <span className="text-shadow-400 text-lg">{'\u2191'}</span>
              <span className="text-shadow-400 font-bold text-sm whitespace-nowrap bg-shadow-500/15 px-3 py-1.5 rounded-lg border border-shadow-500/30 shadow-lg shadow-shadow-500/10">
                Click {'\u25B6'} to step through
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-gray-700 shrink-0" />

      {/* Narration text */}
      <span className="text-sm">{narration.icon}</span>
      <span className={`text-xs font-medium ${colors.text}`}>
        {narration.text}
      </span>

      {/* Service + auto-play toggle */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <span className="text-[10px] text-gray-600 capitalize">
          {tc.service}
        </span>
        <button
          onClick={onToggleAutoPlay}
          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
            isAutoPlay
              ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
              : 'bg-gray-700 text-gray-400 hover:text-gray-200'
          }`}
          title={isAutoPlay ? 'Auto-advancing — click to pause' : 'Paused — click to auto-advance'}
        >
          {isAutoPlay ? 'Live' : 'Paused'}
        </button>
      </div>
    </div>
  );
}
