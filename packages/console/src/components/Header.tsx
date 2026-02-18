import type { SimulationStatus } from '../types';

interface HeaderProps {
  status: SimulationStatus;
  scenario: string | null;
  trustScore: number | null;
  passed: boolean | null;
  onReset: () => void;
  isLive?: boolean;
  onTrustClick?: () => void;
}

export function Header({ status, scenario, trustScore, passed, onReset, isLive, onTrustClick }: HeaderProps) {
  // Derive display status from trust score when available
  const displayPassed = passed ?? (trustScore !== null ? trustScore >= 85 : null);

  const statusColors: Record<SimulationStatus, string> = {
    idle: 'bg-gray-600',
    running: 'bg-yellow-500 pulse-glow',
    completed: displayPassed === null ? 'bg-green-500' : displayPassed ? 'bg-green-500' : 'bg-red-500',
    failed: 'bg-red-500',
  };

  const statusLabels: Record<SimulationStatus, string> = {
    idle: 'Ready',
    running: 'Simulating...',
    completed: displayPassed === null ? 'Done' : displayPassed ? 'PASS' : 'FAIL',
    failed: 'Error',
  };

  return (
    <header className="h-14 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm flex items-center px-4 gap-4 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-shadow-500 to-shadow-700 flex items-center justify-center text-white font-bold text-sm">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
            <path d="M12 3 L20 12 L12 21 L4 12 Z" opacity="0.9"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </div>
        <span className="font-semibold text-base tracking-tight">
          Shadow<span className="text-shadow-400">Console</span>
        </span>
        <a
          href="https://useshadow.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-gray-600 hover:text-shadow-400 transition-colors ml-0.5 self-end mb-0.5"
        >
          useshadow.dev
        </a>
      </div>

      {/* Live indicator */}
      {isLive && (
        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-400 ring-1 ring-red-500/40 rounded">
          Live
        </span>
      )}

      {/* Divider */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Scenario */}
      <div className="text-sm text-gray-400 truncate">
        {scenario || 'No scenario loaded'}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Trust Score Badge — clickable → Shadow Report */}
      {trustScore !== null && (
        <button
          onClick={onTrustClick}
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold cursor-pointer hover:brightness-125 transition-all ${
            trustScore >= 90 ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/30' :
            trustScore >= 70 ? 'bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/30' :
            'bg-red-500/10 text-red-400 ring-1 ring-red-500/30'
          }`}
        >
          <span className="text-xs uppercase tracking-wider opacity-70">Trust</span>
          <span className="text-base">{trustScore}</span>
          <span className="text-xs opacity-50">/100</span>
        </button>
      )}

      {/* Status Indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {statusLabels[status]}
        </span>
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors"
      >
        Reset
      </button>
    </header>
  );
}
