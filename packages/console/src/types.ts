/** Types for the Shadow Console UI */

export interface ToolCall {
  id: string;
  timestamp: number;
  service: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  response: unknown;
  duration_ms: number;
}

export interface RiskEvent {
  id: number;
  timestamp: number;
  service: string;
  action: string;
  object_type: string;
  object_id: string;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  risk_reason?: string;
}

export interface AssertionResult {
  description: string;
  expr: string;
  weight: 'critical' | 'high' | 'medium' | 'low';
  passed: boolean;
  actual?: unknown;
  message: string;
}

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
  riskLog: Array<{
    level: string;
    message: string;
    service: string;
    timestamp: number;
  }>;
  impactSummary: {
    totalToolCalls: number;
    byService: Record<string, number>;
    messages?: { total: number; external: number; internal: number };
    emails?: { sent: number; drafted: number; withAttachments: number };
    financial?: { charges: number; totalCharged: number; refunds: number; totalRefunded: number };
    destructiveActions: number;
    dataExposureEvents: number;
  };
}

export interface SlackMessage {
  id: string;
  channel: string;
  user: string;
  user_name: string;
  text: string;
  timestamp: number;
  is_agent: boolean;
}

export interface SlackChannel {
  id: string;
  name: string;
  messages: SlackMessage[];
}

export interface StripeOperation {
  type: 'customer' | 'charge' | 'refund' | 'dispute';
  id: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface GmailEmail {
  id: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  body?: string;
  is_read: boolean;
  labels: string[];
  timestamp: number;
}

export type SimulationStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface SimulationState {
  status: SimulationStatus;
  scenario: string | null;
  services: string[];
  toolCalls: ToolCall[];
  riskEvents: RiskEvent[];
  report: ShadowReport | null;
  // Simulated world state
  slackChannels: SlackChannel[];
  stripeOperations: StripeOperation[];
  gmailEmails: GmailEmail[];
}
