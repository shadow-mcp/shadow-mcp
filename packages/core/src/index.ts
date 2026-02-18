// Shadow MCP Core — State Engine, Assertion Engine, Shadow Report

export {
  StateEngine,
  type StateObject,
  type StateEvent,
  type ServiceSchema,
  type TableDefinition,
  type ColumnDefinition,
} from './state-engine.js';

export {
  parseScenario,
  evaluateScenario,
  evaluateAssertion,
  type ScenarioConfig,
  type Assertion,
  type AssertionWeight,
  type ChaosEvent,
  type SetupConfig,
  type AssertionResult,
  type EvaluationResult,
  type EvaluationContext,
  type AgentMessage,
} from './assertion-engine.js';

export {
  generateReport,
  formatReportForTerminal,
  formatReportAsJson,
  type ShadowReport,
  type RiskEntry,
  type ImpactSummary,
} from './shadow-report.js';
