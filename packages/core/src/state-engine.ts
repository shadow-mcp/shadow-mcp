import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Realistic ID generation — no watermarks, indistinguishable from production
// ---------------------------------------------------------------------------

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const UPPER_ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomChars(charset: string, length: number): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

/**
 * Generate an ID matching the real service's exact format.
 * An LLM reading these IDs cannot distinguish them from production.
 */
function realisticId(prefix: string): string {
  switch (prefix) {
    // Stripe — prefix_ + mixed-case alphanumeric
    case 'cus': return `cus_${randomChars(ALNUM, 14)}`;
    case 'ch':  return `ch_${randomChars(ALNUM, 24)}`;
    case 're':  return `re_${randomChars(ALNUM, 24)}`;
    case 'pm':  return `pm_${randomChars(ALNUM, 18)}`;
    case 'dp':  return `dp_${randomChars(ALNUM, 18)}`;

    // Slack — single letter + uppercase alphanumeric
    case 'U':   return `U${randomChars(UPPER_ALNUM, 10)}`;
    case 'C':   return `C${randomChars(UPPER_ALNUM, 10)}`;
    case 'W':   return `W${randomChars(UPPER_ALNUM, 10)}`;

    // Slack messages — Slack uses float timestamps like "1708200345.000127"
    case 'MSG': {
      const ts = (Date.now() / 1000).toFixed(6);
      return ts;
    }

    // Slack misc — reactions, DM channels, channel memberships
    case 'RXN': return `RXN${randomChars(UPPER_ALNUM, 8)}`;
    case 'DM':  return `D${randomChars(UPPER_ALNUM, 10)}`;
    case 'CM':  return `CM${randomChars(UPPER_ALNUM, 8)}`;

    // Gmail — hex string (like real Gmail message/thread IDs)
    case 'msg':    return randomBytes(8).toString('hex');
    case 'thread': return randomBytes(8).toString('hex');
    case 'draft':  return `r${randomBytes(8).toString('hex')}`;
    case 'Label':  return `Label_${randomBytes(4).toString('hex')}`;

    // Fallback — prefix + random alphanumeric (still no watermark)
    default: return `${prefix}_${randomChars(ALNUM, 14)}`;
  }
}

/**
 * The State Engine is the technical moat of Shadow MCP.
 *
 * It maintains an in-memory SQLite database tracking every simulated object
 * across multi-turn agent interactions. When an agent creates a Stripe customer,
 * then later charges that customer, the state engine ensures consistency.
 *
 * Each service (Slack, Stripe, Gmail) registers its own tables and the state
 * engine provides a unified interface for CRUD operations with automatic ID
 * generation and event logging.
 */

export interface StateObject {
  id: string;
  service: string;
  type: string;
  data: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface StateEvent {
  id: number;
  timestamp: number;
  service: string;
  action: string;
  object_type: string;
  object_id: string;
  details: Record<string, unknown>;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  risk_reason?: string;
}

export interface ServiceSchema {
  service: string;
  tables: TableDefinition[];
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB';
  nullable?: boolean;
  defaultValue?: string | number | null;
}

export class StateEngine {
  private db: Database.Database;
  private registeredServices: Set<string> = new Set();

  constructor() {
    // In-memory SQLite — fast, ephemeral, perfect for simulation
    this.db = new Database(':memory:');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initCoreTables();
  }

  private initCoreTables(): void {
    // Universal object registry — tracks every simulated object across all services
    this.db.exec(`
      CREATE TABLE shadow_objects (
        id TEXT PRIMARY KEY,
        service TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX idx_objects_service ON shadow_objects(service);
      CREATE INDEX idx_objects_type ON shadow_objects(service, type);
    `);

    // Event log — every action the agent takes, scored by risk
    this.db.exec(`
      CREATE TABLE shadow_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        service TEXT NOT NULL,
        action TEXT NOT NULL,
        object_type TEXT NOT NULL,
        object_id TEXT,
        details TEXT NOT NULL DEFAULT '{}',
        risk_level TEXT NOT NULL DEFAULT 'INFO',
        risk_reason TEXT
      );

      CREATE INDEX idx_events_service ON shadow_events(service);
      CREATE INDEX idx_events_risk ON shadow_events(risk_level);
    `);

    // Tool call log — raw record of every MCP tool call
    this.db.exec(`
      CREATE TABLE shadow_tool_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        service TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        arguments TEXT NOT NULL DEFAULT '{}',
        response TEXT NOT NULL DEFAULT '{}',
        duration_ms INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  /**
   * Register a service's custom tables (e.g., Stripe's customers, charges, etc.)
   */
  registerService(schema: ServiceSchema): void {
    if (this.registeredServices.has(schema.service)) return;

    for (const table of schema.tables) {
      const cols = table.columns.map(col => {
        let def = `${col.name} ${col.type}`;
        if (!col.nullable) def += ' NOT NULL';
        if (col.defaultValue !== undefined) {
          def += ` DEFAULT ${typeof col.defaultValue === 'string' ? `'${col.defaultValue}'` : col.defaultValue}`;
        }
        return def;
      }).join(',\n        ');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${table.name} (
          id TEXT PRIMARY KEY,
          ${cols},
          _created_at INTEGER NOT NULL,
          _updated_at INTEGER NOT NULL
        );
      `);
    }

    this.registeredServices.add(schema.service);
  }

  /**
   * Generate an ID that is indistinguishable from the real service's format.
   *
   * IMPORTANT: IDs must NOT contain any watermarks (like "shadow" or "fake")
   * that would let an LLM detect it's in a simulation. The whole point of
   * Shadow is that the agent has NO IDEA it's in a sandbox.
   *
   * Formats match real services:
   *   Stripe:  cus_NfD0QpKgh3LdZz  (prefix + 14 alphanumeric)
   *   Slack:   U04QAHJ6R           (letter + 10 uppercase alphanumeric)
   *   Gmail:   18d5a2b3c4e5f6a7    (16-char hex, no prefix)
   */
  generateId(prefix: string): string {
    return realisticId(prefix);
  }

  /**
   * Create a simulated object and register it in the universal registry.
   */
  createObject(service: string, type: string, id: string, data: Record<string, unknown>): StateObject {
    const now = Date.now();
    const obj: StateObject = {
      id,
      service,
      type,
      data,
      created_at: now,
      updated_at: now,
    };

    this.db.prepare(`
      INSERT INTO shadow_objects (id, service, type, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, service, type, JSON.stringify(data), now, now);

    return obj;
  }

  /**
   * Get a simulated object by ID. Returns null if not found.
   */
  getObject(id: string): StateObject | null {
    const row = this.db.prepare(
      'SELECT * FROM shadow_objects WHERE id = ?'
    ).get(id) as { id: string; service: string; type: string; data: string; created_at: number; updated_at: number } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      service: row.service,
      type: row.type,
      data: JSON.parse(row.data),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Update a simulated object's data (merge).
   */
  updateObject(id: string, data: Record<string, unknown>): StateObject | null {
    const existing = this.getObject(id);
    if (!existing) return null;

    const merged = { ...existing.data, ...data };
    const now = Date.now();

    this.db.prepare(`
      UPDATE shadow_objects SET data = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(merged), now, id);

    return { ...existing, data: merged, updated_at: now };
  }

  /**
   * Delete a simulated object.
   */
  deleteObject(id: string): boolean {
    const result = this.db.prepare(
      'DELETE FROM shadow_objects WHERE id = ?'
    ).run(id);
    return result.changes > 0;
  }

  /**
   * Query objects by service and type.
   */
  queryObjects(service: string, type: string, filter?: Record<string, unknown>): StateObject[] {
    const rows = this.db.prepare(
      'SELECT * FROM shadow_objects WHERE service = ? AND type = ?'
    ).all(service, type) as Array<{ id: string; service: string; type: string; data: string; created_at: number; updated_at: number }>;

    let objects = rows.map(row => ({
      id: row.id,
      service: row.service,
      type: row.type,
      data: JSON.parse(row.data) as Record<string, unknown>,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    // Client-side filtering on JSON data fields
    if (filter) {
      objects = objects.filter(obj => {
        return Object.entries(filter).every(([key, value]) => obj.data[key] === value);
      });
    }

    return objects;
  }

  /**
   * Execute raw SQL on a service-specific table.
   * Used by service implementations for complex queries.
   */
  execute(sql: string, params: unknown[] = []): unknown[] {
    return this.db.prepare(sql).all(...params);
  }

  executeRun(sql: string, params: unknown[] = []): Database.RunResult {
    return this.db.prepare(sql).run(...params);
  }

  /**
   * Log an event (every agent action).
   */
  logEvent(event: Omit<StateEvent, 'id' | 'timestamp'>): StateEvent {
    const timestamp = Date.now();
    const result = this.db.prepare(`
      INSERT INTO shadow_events (timestamp, service, action, object_type, object_id, details, risk_level, risk_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      timestamp,
      event.service,
      event.action,
      event.object_type,
      event.object_id,
      JSON.stringify(event.details),
      event.risk_level,
      event.risk_reason || null
    );

    return {
      id: Number(result.lastInsertRowid),
      timestamp,
      ...event,
    };
  }

  /**
   * Log a raw tool call.
   */
  logToolCall(service: string, toolName: string, args: Record<string, unknown>, response: unknown, durationMs: number): void {
    this.db.prepare(`
      INSERT INTO shadow_tool_calls (timestamp, service, tool_name, arguments, response, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(Date.now(), service, toolName, JSON.stringify(args), JSON.stringify(response), durationMs);
  }

  /**
   * Get all events, optionally filtered.
   */
  getEvents(filter?: { service?: string; riskLevel?: string }): StateEvent[] {
    let sql = 'SELECT * FROM shadow_events';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.service) {
      conditions.push('service = ?');
      params.push(filter.service);
    }
    if (filter?.riskLevel) {
      conditions.push('risk_level = ?');
      params.push(filter.riskLevel);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY timestamp ASC';

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: number; timestamp: number; service: string; action: string;
      object_type: string; object_id: string; details: string;
      risk_level: string; risk_reason: string | null;
    }>;

    return rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      service: row.service,
      action: row.action,
      object_type: row.object_type,
      object_id: row.object_id,
      details: JSON.parse(row.details),
      risk_level: row.risk_level as StateEvent['risk_level'],
      risk_reason: row.risk_reason || undefined,
    }));
  }

  /**
   * Get all tool calls for building the impact summary.
   */
  getToolCalls(): Array<{
    service: string;
    tool_name: string;
    arguments: Record<string, unknown>;
    response: unknown;
    timestamp: number;
    duration_ms: number;
  }> {
    const rows = this.db.prepare(
      'SELECT * FROM shadow_tool_calls ORDER BY timestamp ASC'
    ).all() as Array<{
      timestamp: number; service: string; tool_name: string;
      arguments: string; response: string; duration_ms: number;
    }>;

    return rows.map(row => ({
      service: row.service,
      tool_name: row.tool_name,
      arguments: JSON.parse(row.arguments),
      response: JSON.parse(row.response),
      timestamp: row.timestamp,
      duration_ms: row.duration_ms,
    }));
  }

  /**
   * Get summary stats for the impact summary.
   */
  getImpactSummary(): {
    totalToolCalls: number;
    byService: Record<string, number>;
    byRiskLevel: Record<string, number>;
    riskEvents: StateEvent[];
  } {
    const totalToolCalls = (this.db.prepare(
      'SELECT COUNT(*) as count FROM shadow_tool_calls'
    ).get() as { count: number }).count;

    const byServiceRows = this.db.prepare(
      'SELECT service, COUNT(*) as count FROM shadow_tool_calls GROUP BY service'
    ).all() as Array<{ service: string; count: number }>;
    const byService: Record<string, number> = {};
    for (const row of byServiceRows) byService[row.service] = row.count;

    const byRiskRows = this.db.prepare(
      'SELECT risk_level, COUNT(*) as count FROM shadow_events WHERE risk_level != \'INFO\' GROUP BY risk_level'
    ).all() as Array<{ risk_level: string; count: number }>;
    const byRiskLevel: Record<string, number> = {};
    for (const row of byRiskRows) byRiskLevel[row.risk_level] = row.count;

    const riskEvents = this.getEvents().filter(e => e.risk_level !== 'INFO');

    return { totalToolCalls, byService, byRiskLevel, riskEvents };
  }

  /**
   * Reset the entire simulation state.
   */
  reset(): void {
    this.db.exec('DELETE FROM shadow_objects');
    this.db.exec('DELETE FROM shadow_events');
    this.db.exec('DELETE FROM shadow_tool_calls');
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}
