import { useState } from 'react';
import type { ShadowReport, ToolCall, RiskEvent } from '../types';

interface ReportPanelProps {
  report: ShadowReport | null;
  toolCalls?: ToolCall[];
  riskEvents?: RiskEvent[];
}

function generateScenarioYaml(report: ShadowReport, toolCalls: ToolCall[], riskEvents: RiskEvent[]): string {
  const lines: string[] = [];
  lines.push(`name: "Exported: ${report.scenario}"`);
  lines.push(`description: "Auto-exported from Shadow Console session"`);
  lines.push(`service: ${Object.keys(report.impactSummary.byService)[0] || 'slack'}`);
  lines.push(`version: "1.0"`);
  lines.push(`trust_threshold: ${report.threshold}`);
  lines.push('');

  // Add assertions from the report
  lines.push('assertions:');
  for (const r of report.assertions.results) {
    lines.push(`  - expr: "${r.expr}"`);
    lines.push(`    description: "${r.description}"`);
    lines.push(`    weight: ${r.weight}`);
  }
  lines.push('');

  // Add tool call log as comments for reference
  lines.push('# Tool calls observed in this session:');
  for (const tc of toolCalls.slice(0, 20)) {
    const args = JSON.stringify(tc.arguments).slice(0, 80);
    lines.push(`#   ${tc.tool_name}(${args})`);
  }
  if (toolCalls.length > 20) {
    lines.push(`#   ... and ${toolCalls.length - 20} more`);
  }
  lines.push('');

  // Add risk events as comments
  const nonInfoRisks = riskEvents.filter(e => e.risk_level !== 'INFO');
  if (nonInfoRisks.length > 0) {
    lines.push('# Risk events detected:');
    for (const e of nonInfoRisks) {
      lines.push(`#   [${e.risk_level}] ${e.risk_reason || e.action} (${e.service})`);
    }
  }

  return lines.join('\n');
}

export function ReportPanel({ report, toolCalls = [], riskEvents = [] }: ReportPanelProps) {
  const [toast, setToast] = useState<string | null>(null);
  if (!report) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Run a simulation to generate a Shadow Report
      </div>
    );
  }

  const scoreColor = report.trustScore >= 90 ? 'text-green-400' :
                     report.trustScore >= 70 ? 'text-yellow-400' : 'text-red-400';
  const scoreRing = report.trustScore >= 90 ? 'ring-green-500/30' :
                    report.trustScore >= 70 ? 'ring-yellow-500/30' : 'ring-red-500/30';
  const scoreBg = report.trustScore >= 90 ? 'from-green-500/5 to-transparent' :
                  report.trustScore >= 70 ? 'from-yellow-500/5 to-transparent' : 'from-red-500/5 to-transparent';

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Trust Score Hero */}
      <div className={`rounded-xl bg-gradient-to-b ${scoreBg} ring-1 ${scoreRing} p-6 text-center`}>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
          Trust Score
        </div>
        <div className={`text-6xl font-bold ${scoreColor} mb-1`}>
          {report.trustScore}
        </div>
        <div className="text-sm text-gray-500">out of 100</div>
        <div className="mt-4">
          <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${
            report.passed
              ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/30'
              : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/30'
          }`}>
            {report.passed ? 'PASS' : 'FAIL'}
          </span>
        </div>
        <div className="mt-3 text-xs text-gray-600">
          Threshold: {report.threshold} | {report.scenario}
        </div>
      </div>

      {/* Assertions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Assertions</h3>
          <span className="text-xs text-gray-600">
            {report.assertions.passed}/{report.assertions.total} passed
          </span>
        </div>
        <div className="space-y-2">
          {report.assertions.results.map((result, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 border ${
                result.passed
                  ? 'bg-green-500/5 border-green-500/10'
                  : 'bg-red-500/5 border-red-500/20'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
                  {result.passed ? '✓' : '✗'}
                </span>
                <WeightBadge weight={result.weight} />
                <span className="text-sm text-gray-300">{result.description}</span>
              </div>
              {!result.passed && (
                <div className="mt-1.5 pl-6 text-xs text-red-400/70 font-mono">
                  {result.message}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Risk Log */}
      {report.riskLog.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            Risk Log
          </h3>
          <div className="space-y-2">
            {report.riskLog.map((risk, i) => {
              const style = riskStyles[risk.level] || riskStyles.LOW;
              return (
                <div key={i} className={`rounded-lg p-3 border ${style.bg} ${style.border}`}>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${style.badge}`}>
                      {risk.level}
                    </span>
                    <span className="text-sm text-gray-300">{risk.message}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-gray-600 pl-0.5">
                    {risk.service} · {new Date(risk.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Impact Summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Impact Summary
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Tool Calls" value={report.impactSummary.totalToolCalls} />
          {report.impactSummary.messages && (
            <StatCard
              label="Messages Sent"
              value={report.impactSummary.messages.total}
              sub={`${report.impactSummary.messages.external} external`}
            />
          )}
          {report.impactSummary.emails && (
            <StatCard
              label="Emails"
              value={(report.impactSummary.emails.drafted || 0)}
              sub={`${report.impactSummary.emails.drafted} drafted`}
            />
          )}
          {report.impactSummary.financial && (
            <>
              <StatCard
                label="Charges"
                value={report.impactSummary.financial.charges}
                sub={`$${(report.impactSummary.financial.totalCharged / 100).toFixed(2)}`}
              />
              <StatCard
                label="Refunds"
                value={report.impactSummary.financial.refunds}
                sub={`$${(report.impactSummary.financial.totalRefunded / 100).toFixed(2)}`}
              />
            </>
          )}
          <StatCard
            label="Destructive Actions"
            value={report.impactSummary.destructiveActions}
            danger={report.impactSummary.destructiveActions > 0}
          />
          <StatCard
            label="Data Exposure"
            value={report.impactSummary.dataExposureEvents}
            danger={report.impactSummary.dataExposureEvents > 0}
          />
        </div>
      </div>

      {/* Per-service breakdown */}
      {Object.keys(report.impactSummary.byService).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            By Service
          </h3>
          <div className="flex gap-2">
            {Object.entries(report.impactSummary.byService).map(([service, count]) => (
              <div key={service} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-800">
                <ServiceIcon service={service} />
                <span className="text-sm text-gray-300">{service}</span>
                <span className="text-sm font-bold text-gray-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Copy as YAML */}
      <div className="pt-2">
        <button
          onClick={() => {
            const yaml = generateScenarioYaml(report, toolCalls, riskEvents);
            navigator.clipboard.writeText(yaml).then(() => {
              setToast('Scenario YAML copied to clipboard!');
              setTimeout(() => setToast(null), 3000);
            });
          }}
          className="w-full py-2.5 rounded-lg text-sm font-medium bg-shadow-600/20 text-shadow-300 ring-1 ring-shadow-500/30 hover:bg-shadow-600/30 transition-colors"
        >
          Copy as YAML
        </button>
        <p className="text-[10px] text-gray-600 text-center mt-1.5">
          Save as a .yaml file to use as a regression test
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-500/90 text-white text-sm font-medium rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="text-center text-[10px] text-gray-700 pt-4 border-t border-gray-800/50">
        Shadow MCP · useshadow.dev
      </div>
    </div>
  );
}

function WeightBadge({ weight }: { weight: string }) {
  const colors: Record<string, string> = {
    critical: 'text-red-400 bg-red-400/10',
    high: 'text-orange-400 bg-orange-400/10',
    medium: 'text-yellow-400 bg-yellow-400/10',
    low: 'text-blue-400 bg-blue-400/10',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${colors[weight] || colors.low}`}>
      {weight}
    </span>
  );
}

function StatCard({ label, value, sub, danger }: { label: string; value: number; sub?: string; danger?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-900/50 border border-gray-800 p-3">
      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${danger ? 'text-red-400' : 'text-gray-200'}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function ServiceIcon({ service }: { service: string }) {
  const colors: Record<string, string> = { slack: 'bg-purple-500', stripe: 'bg-blue-500', gmail: 'bg-red-500' };
  return <div className={`w-2 h-2 rounded-full ${colors[service] || 'bg-gray-500'}`} />;
}

const riskStyles: Record<string, { bg: string; border: string; badge: string }> = {
  CRITICAL: { bg: 'bg-red-500/5', border: 'border-red-500/20', badge: 'bg-red-500/10 text-red-400' },
  HIGH: { bg: 'bg-orange-500/5', border: 'border-orange-500/20', badge: 'bg-orange-500/10 text-orange-400' },
  MEDIUM: { bg: 'bg-yellow-500/5', border: 'border-yellow-500/20', badge: 'bg-yellow-500/10 text-yellow-400' },
  LOW: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', badge: 'bg-blue-500/10 text-blue-400' },
};
