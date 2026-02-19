import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';

/**
 * Event Bus — streams simulation events to the Console UI via WebSocket
 * and receives chaos injection commands back from the Console.
 *
 * Events flow:
 *   Agent → Proxy → Shadow Server → Proxy → Event Bus → WebSocket → Console
 *   Console → WebSocket → Event Bus → Proxy (chaos injection)
 */

export interface ProxyEvent {
  type: 'tool_call' | 'tool_response' | 'risk_event' | 'status' | 'report' | 'chaos_injected';
  timestamp: number;
  data: Record<string, unknown>;
}

export interface ChaosCommand {
  type: 'chaos';
  chaos: string;  // api_outage | angry_customer | rate_limit | prompt_injection | data_corruption | latency
}

export interface InjectMessageCommand {
  type: 'inject_message';
  channel: string;
  user_name: string;
  text: string;
}

export interface InjectEmailCommand {
  type: 'inject_email';
  from_name: string;
  from_email: string;
  subject: string;
  body: string;
}

export interface InjectStripeEventCommand {
  type: 'inject_stripe_event';
  event_type: 'dispute_created' | 'payment_failed';
  charge_id?: string;
  customer_id?: string;
  amount?: number;
  reason?: string;
  description?: string;
}

const MAX_EVENT_LOG = 10000;

export class EventBus extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private eventLog: ProxyEvent[] = [];

  /**
   * Start the WebSocket server for Console connections.
   */
  startWebSocket(port: number = 3001): void {
    this.wss = new WebSocketServer({ port, host: '127.0.0.1' });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      console.error(`[Shadow] Console connected (${this.clients.size} client(s))`);

      // Send all historical events to the new client
      for (const event of this.eventLog) {
        ws.send(JSON.stringify(event));
      }

      // Listen for chaos commands from the Console
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'chaos' && msg.chaos) {
            console.error(`[Shadow] Chaos injected from Console: ${msg.chaos}`);
            this.emit('chaos', msg as ChaosCommand);
          }
          if (msg.type === 'inject_message' && msg.channel && msg.text) {
            console.error(`[Shadow] ShadowPlay: ${msg.user_name} → #${msg.channel}`);
            this.emit('inject_message', msg as InjectMessageCommand);
          }
          if (msg.type === 'inject_email' && msg.subject) {
            console.error(`[Shadow] ShadowPlay: ${msg.from_name} → inbox (${msg.subject})`);
            this.emit('inject_email', msg as InjectEmailCommand);
          }
          if (msg.type === 'inject_stripe_event' && msg.event_type) {
            console.error(`[Shadow] ShadowPlay: Stripe ${msg.event_type}`);
            this.emit('inject_stripe_event', msg as InjectStripeEventCommand);
          }
        } catch {
          // Not valid JSON, skip
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.error(`[Shadow] Console disconnected (${this.clients.size} client(s))`);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    console.error(`[Shadow] WebSocket server listening on ws://localhost:${port}`);
  }

  /**
   * Emit an event — logs it and broadcasts to all Console clients.
   */
  emitEvent(event: ProxyEvent): void {
    this.eventLog.push(event);
    if (this.eventLog.length > MAX_EVENT_LOG) {
      this.eventLog = this.eventLog.slice(-MAX_EVENT_LOG);
    }
    this.emit('event', event);

    const msg = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  /**
   * Log a tool call from the agent.
   */
  logToolCall(service: string, toolName: string, args: Record<string, unknown>): void {
    this.emitEvent({
      type: 'tool_call',
      timestamp: Date.now(),
      data: { service, tool_name: toolName, arguments: args },
    });
  }

  /**
   * Log a tool response back to the agent.
   */
  logToolResponse(service: string, toolName: string, response: unknown, durationMs: number): void {
    this.emitEvent({
      type: 'tool_response',
      timestamp: Date.now(),
      data: { service, tool_name: toolName, response, duration_ms: durationMs },
    });
  }

  /**
   * Log a risk event detected during simulation.
   */
  logRiskEvent(level: string, message: string, service: string, details: Record<string, unknown> = {}): void {
    this.emitEvent({
      type: 'risk_event',
      timestamp: Date.now(),
      data: { level, message, service, ...details },
    });
  }

  /**
   * Emit a status update.
   */
  emitStatus(status: 'starting' | 'running' | 'completed' | 'failed', message?: string): void {
    this.emitEvent({
      type: 'status',
      timestamp: Date.now(),
      data: { status, message },
    });
  }

  /**
   * Emit a chaos injection notification (so Console can show it).
   */
  emitChaosInjected(chaos: string, description: string): void {
    this.emitEvent({
      type: 'chaos_injected',
      timestamp: Date.now(),
      data: { chaos, description },
    });
  }

  /**
   * Emit the final Shadow Report.
   */
  emitReport(report: Record<string, unknown>): void {
    this.emitEvent({
      type: 'report',
      timestamp: Date.now(),
      data: { report },
    });
  }

  /**
   * Get all logged events.
   */
  getEvents(): ProxyEvent[] {
    return this.eventLog;
  }

  /**
   * Shut down the WebSocket server.
   */
  close(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    this.wss?.close();
  }
}
