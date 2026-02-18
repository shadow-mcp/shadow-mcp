import { EvaluationResult, AssertionResult } from './assertion-engine.js';
import { StateEngine, StateEvent } from './state-engine.js';

/**
 * The Shadow Report is the primary output of every simulation.
 * It's the viral screenshot — a clean scorecard that sells the product
 * on HackerNews, in investor decks, and in enterprise procurement.
 *
 * Three components:
 * 1. Trust Score (0-100) — the single number that gates CI/CD
 * 2. Risk Log — every dangerous action, ranked by severity
 * 3. Impact Summary — quantified summary of all actions taken
 */

export interface ShadowReport {
  trustScore: number;
  passed: boolean;
  threshold: number;
  scenario: string;
  timestamp: string;
  duration: number;
  assertions: {
    total: number;
    passed: number;
    failed: number;
    results: AssertionResult[];
  };
  riskLog: RiskEntry[];
  impactSummary: ImpactSummary;
}

export interface RiskEntry {
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  message: string;
  service: string;
  timestamp: number;
}

export interface ImpactSummary {
  totalToolCalls: number;
  byService: Record<string, number>;
  messages?: { total: number; external: number; internal: number };
  emails?: { drafted: number; withAttachments: number };
  financial?: { charges: number; totalCharged: number; refunds: number; totalRefunded: number };
  destructiveActions: number;
  dataExposureEvents: number;
}

/**
 * Generate a Shadow Report from evaluation results and state engine.
 */
export function generateReport(
  evaluation: EvaluationResult,
  state: StateEngine,
  durationMs: number
): ShadowReport {
  const impact = state.getImpactSummary();
  const riskEvents = impact.riskEvents;

  // Build risk log from events
  const riskLog: RiskEntry[] = riskEvents.map(event => ({
    level: event.risk_level,
    message: event.risk_reason || `${event.action} on ${event.object_type} ${event.object_id}`,
    service: event.service,
    timestamp: event.timestamp,
  }));

  // Sort risk log: CRITICAL first, then HIGH, MEDIUM, LOW
  const riskOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  riskLog.sort((a, b) => riskOrder[a.level] - riskOrder[b.level]);

  // Build impact summary from tool calls and state
  const toolCalls = state.getToolCalls();
  const impactSummary = buildImpactSummary(toolCalls, state, impact);

  return {
    trustScore: evaluation.trustScore,
    passed: evaluation.passed,
    threshold: evaluation.threshold,
    scenario: evaluation.scenario,
    timestamp: new Date().toISOString(),
    duration: durationMs,
    assertions: {
      total: evaluation.summary.total,
      passed: evaluation.summary.passed,
      failed: evaluation.summary.failed,
      results: evaluation.results,
    },
    riskLog,
    impactSummary,
  };
}

function buildImpactSummary(
  toolCalls: Array<{ service: string; tool_name: string; arguments: Record<string, unknown> }>,
  state: StateEngine,
  impact: ReturnType<StateEngine['getImpactSummary']>
): ImpactSummary {
  const summary: ImpactSummary = {
    totalToolCalls: impact.totalToolCalls,
    byService: impact.byService,
    destructiveActions: 0,
    dataExposureEvents: 0,
  };

  // Count Slack messages
  const slackMessages = state.queryObjects('slack', 'message');
  if (slackMessages.length > 0) {
    const external = slackMessages.filter(m => m.data.is_external).length;
    summary.messages = {
      total: slackMessages.length,
      external,
      internal: slackMessages.length - external,
    };
  }

  // Count Gmail emails
  const emails = state.queryObjects('gmail', 'draft');
  if (emails.length > 0) {
    summary.emails = {
      drafted: emails.length,
      withAttachments: emails.filter(e => e.data.has_attachments).length,
    };
  }

  // Count Stripe financial operations
  const charges = state.queryObjects('stripe', 'charge');
  const refunds = state.queryObjects('stripe', 'refund');
  if (charges.length > 0 || refunds.length > 0) {
    summary.financial = {
      charges: charges.length,
      totalCharged: charges.reduce((sum, c) => sum + (Number(c.data.amount) || 0), 0),
      refunds: refunds.length,
      totalRefunded: refunds.reduce((sum, r) => sum + (Number(r.data.amount) || 0), 0),
    };
  }

  // Count destructive actions and data exposure from risk events
  summary.destructiveActions = impact.riskEvents.filter(
    e => e.action.includes('delete') || e.action.includes('destroy') || e.action.includes('remove')
  ).length;

  summary.dataExposureEvents = impact.riskEvents.filter(
    e => e.risk_reason?.toLowerCase().includes('pii') ||
         e.risk_reason?.toLowerCase().includes('leak') ||
         e.risk_reason?.toLowerCase().includes('exfiltrat')
  ).length;

  return summary;
}

/**
 * Format the Shadow Report for terminal output.
 * This is what prints to stdout — the viral screenshot.
 */
export function formatReportForTerminal(report: ShadowReport): string {
  const lines: string[] = [];
  const RESET = '\x1b[0m';
  const BOLD = '\x1b[1m';
  const DIM = '\x1b[2m';
  const RED = '\x1b[31m';
  const GREEN = '\x1b[32m';
  const YELLOW = '\x1b[33m';
  const BLUE = '\x1b[34m';
  const MAGENTA = '\x1b[35m';
  const CYAN = '\x1b[36m';
  const WHITE = '\x1b[37m';
  const BG_RED = '\x1b[41m';
  const BG_GREEN = '\x1b[42m';

  const width = 60;
  const divider = DIM + '─'.repeat(width) + RESET;
  const doubleDivider = DIM + '═'.repeat(width) + RESET;

  lines.push('');
  lines.push(doubleDivider);
  lines.push(`${BOLD}${MAGENTA}  ◈ SHADOW REPORT${RESET}`);
  lines.push(doubleDivider);
  lines.push('');

  // Trust Score — the hero number
  const scoreColor = report.trustScore >= 90 ? GREEN :
                     report.trustScore >= 70 ? YELLOW : RED;
  const statusBg = report.passed ? BG_GREEN : BG_RED;
  const statusText = report.passed ? ' PASS ' : ' FAIL ';

  lines.push(`  ${BOLD}Trust Score:  ${scoreColor}${report.trustScore}/100${RESET}  ${statusBg}${BOLD} ${statusText} ${RESET}`);
  lines.push(`  ${DIM}Threshold: ${report.threshold} | Scenario: ${report.scenario}${RESET}`);
  lines.push(`  ${DIM}Duration: ${(report.duration / 1000).toFixed(1)}s | ${report.timestamp}${RESET}`);
  lines.push('');

  // Assertions
  lines.push(divider);
  lines.push(`${BOLD}  ASSERTIONS${RESET}  ${GREEN}${report.assertions.passed} passed${RESET}  ${report.assertions.failed > 0 ? RED + report.assertions.failed + ' failed' + RESET : DIM + '0 failed' + RESET}  ${DIM}(${report.assertions.total} total)${RESET}`);
  lines.push(divider);
  lines.push('');

  for (const result of report.assertions.results) {
    const icon = result.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    const weight = result.assertion.weight.toUpperCase();
    const weightColor = weight === 'CRITICAL' ? RED : weight === 'HIGH' ? YELLOW : weight === 'MEDIUM' ? BLUE : DIM;
    lines.push(`  ${icon} ${weightColor}[${weight}]${RESET} ${result.assertion.description}`);
    if (!result.passed) {
      lines.push(`    ${DIM}→ ${result.message}${RESET}`);
    }
  }

  lines.push('');

  // Risk Log
  if (report.riskLog.length > 0) {
    lines.push(divider);
    lines.push(`${BOLD}  RISK LOG${RESET}  ${DIM}(${report.riskLog.length} events)${RESET}`);
    lines.push(divider);
    lines.push('');

    for (const risk of report.riskLog) {
      const levelColor = risk.level === 'CRITICAL' ? RED :
                         risk.level === 'HIGH' ? YELLOW :
                         risk.level === 'MEDIUM' ? BLUE : DIM;
      const icon = risk.level === 'CRITICAL' ? '⚠' :
                   risk.level === 'HIGH' ? '!' :
                   risk.level === 'MEDIUM' ? '~' : '·';
      lines.push(`  ${levelColor}${icon} [${risk.level}]${RESET} ${risk.message}`);
      lines.push(`    ${DIM}${risk.service} · ${new Date(risk.timestamp).toISOString()}${RESET}`);
    }

    lines.push('');
  }

  // Impact Summary
  lines.push(divider);
  lines.push(`${BOLD}  IMPACT SUMMARY${RESET}`);
  lines.push(divider);
  lines.push('');
  lines.push(`  ${CYAN}Tool calls:${RESET} ${report.impactSummary.totalToolCalls}`);

  for (const [service, count] of Object.entries(report.impactSummary.byService)) {
    lines.push(`    ${DIM}${service}: ${count}${RESET}`);
  }

  if (report.impactSummary.messages) {
    const m = report.impactSummary.messages;
    lines.push(`  ${CYAN}Messages sent:${RESET} ${m.total} (${m.external} external, ${m.internal} internal)`);
  }

  if (report.impactSummary.emails) {
    const e = report.impactSummary.emails;
    lines.push(`  ${CYAN}Emails drafted:${RESET} ${e.drafted} (${e.withAttachments} with attachments)`);
  }

  if (report.impactSummary.financial) {
    const f = report.impactSummary.financial;
    lines.push(`  ${CYAN}Charges:${RESET} ${f.charges} ($${(f.totalCharged / 100).toFixed(2)} total)`);
    lines.push(`  ${CYAN}Refunds:${RESET} ${f.refunds} ($${(f.totalRefunded / 100).toFixed(2)} total)`);
  }

  const destructColor = report.impactSummary.destructiveActions > 0 ? RED : GREEN;
  lines.push(`  ${CYAN}Destructive actions:${RESET} ${destructColor}${report.impactSummary.destructiveActions}${RESET}`);

  const exposureColor = report.impactSummary.dataExposureEvents > 0 ? RED : GREEN;
  lines.push(`  ${CYAN}Data exposure events:${RESET} ${exposureColor}${report.impactSummary.dataExposureEvents}${RESET}`);

  lines.push('');
  lines.push(doubleDivider);
  lines.push(`${DIM}  Shadow MCP · https://shadowmcp.com${RESET}`);
  lines.push(doubleDivider);
  lines.push('');

  return lines.join('\n');
}

/**
 * Format the Shadow Report as JSON (for CI/CD pipelines and API consumers).
 */
export function formatReportAsJson(report: ShadowReport): string {
  return JSON.stringify(report, null, 2);
}
