/**
 * Tool Registry — maps tool names to services.
 *
 * When the agent calls a tool, the proxy needs to know which Shadow
 * server handles it. This registry maintains the mapping and the
 * combined tool list that gets returned to the agent.
 */

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface ServiceTools {
  service: string;
  tools: ToolDefinition[];
}

export class ToolRegistry {
  private toolToService = new Map<string, string>();
  private allTools: ToolDefinition[] = [];
  private services = new Map<string, ServiceTools>();

  /**
   * Register all tools from a Shadow service.
   */
  registerService(service: string, tools: ToolDefinition[]): void {
    this.services.set(service, { service, tools });

    for (const tool of tools) {
      this.toolToService.set(tool.name, service);
      this.allTools.push(tool);
    }
  }

  /**
   * Get which service handles a given tool.
   */
  getServiceForTool(toolName: string): string | undefined {
    return this.toolToService.get(toolName);
  }

  /**
   * Get the combined tool list (returned to the agent on tools/list).
   */
  getAllTools(): ToolDefinition[] {
    return this.allTools;
  }

  /**
   * Check if a tool is registered.
   */
  hasTool(toolName: string): boolean {
    return this.toolToService.has(toolName);
  }
}

/**
 * Default tool definitions for each service.
 * These match the tools registered in the Shadow MCP servers.
 */
export const SLACK_TOOLS: ToolDefinition[] = [
  { name: 'list_channels', description: 'List all channels in the workspace', inputSchema: { type: 'object', properties: { include_archived: { type: 'boolean', description: 'Include archived channels' } } } },
  { name: 'post_message', description: 'Send a message to a Slack channel', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, text: { type: 'string' }, thread_ts: { type: 'string' } }, required: ['channel', 'text'] } },
  { name: 'get_channel_history', description: 'Get message history for a channel', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, limit: { type: 'number' } }, required: ['channel'] } },
  { name: 'get_thread_replies', description: 'Get replies to a thread', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, thread_ts: { type: 'string' } }, required: ['channel', 'thread_ts'] } },
  { name: 'list_users', description: 'List all users in the workspace', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_user_info', description: 'Get information about a user', inputSchema: { type: 'object', properties: { user: { type: 'string' } }, required: ['user'] } },
  { name: 'send_direct_message', description: 'Send a direct message to a user', inputSchema: { type: 'object', properties: { user: { type: 'string' }, text: { type: 'string' } }, required: ['user', 'text'] } },
  { name: 'add_reaction', description: 'Add a reaction emoji to a message', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, timestamp: { type: 'string' }, emoji: { type: 'string' } }, required: ['channel', 'timestamp', 'emoji'] } },
  { name: 'create_channel', description: 'Create a new channel', inputSchema: { type: 'object', properties: { name: { type: 'string' }, is_private: { type: 'boolean' } }, required: ['name'] } },
  { name: 'archive_channel', description: 'Archive a channel', inputSchema: { type: 'object', properties: { channel: { type: 'string' } }, required: ['channel'] } },
  { name: 'delete_channel', description: 'Delete a channel (destructive)', inputSchema: { type: 'object', properties: { channel: { type: 'string' } }, required: ['channel'] } },
  { name: 'set_channel_topic', description: 'Set the topic for a channel', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, topic: { type: 'string' } }, required: ['channel', 'topic'] } },
  { name: 'search_messages', description: 'Search for messages across channels', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
];

export const STRIPE_TOOLS: ToolDefinition[] = [
  { name: 'create_customer', description: 'Create a new Stripe customer', inputSchema: { type: 'object', properties: { email: { type: 'string' }, name: { type: 'string' }, phone: { type: 'string' }, description: { type: 'string' } }, required: ['email'] } },
  { name: 'get_customer', description: 'Retrieve a Stripe customer by ID', inputSchema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: ['customer_id'] } },
  { name: 'list_customers', description: 'List all customers', inputSchema: { type: 'object', properties: { limit: { type: 'number' }, email: { type: 'string' } } } },
  { name: 'delete_customer', description: 'Delete a customer (destructive)', inputSchema: { type: 'object', properties: { customer_id: { type: 'string' } }, required: ['customer_id'] } },
  { name: 'create_charge', description: 'Create a charge on a customer', inputSchema: { type: 'object', properties: { customer: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' }, description: { type: 'string' } }, required: ['customer', 'amount'] } },
  { name: 'get_charge', description: 'Retrieve a charge by ID', inputSchema: { type: 'object', properties: { charge_id: { type: 'string' } }, required: ['charge_id'] } },
  { name: 'list_charges', description: 'List charges', inputSchema: { type: 'object', properties: { customer: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'create_refund', description: 'Create a refund for a charge', inputSchema: { type: 'object', properties: { charge: { type: 'string' }, amount: { type: 'number' }, reason: { type: 'string' } }, required: ['charge'] } },
  { name: 'create_dispute', description: 'Simulate a dispute on a charge', inputSchema: { type: 'object', properties: { charge: { type: 'string' }, reason: { type: 'string' } }, required: ['charge'] } },
  { name: 'get_balance', description: 'Get the Stripe account balance', inputSchema: { type: 'object', properties: {} } },
];

export const GMAIL_TOOLS: ToolDefinition[] = [
  { name: 'list_messages', description: 'List messages in the inbox', inputSchema: { type: 'object', properties: { label: { type: 'string' }, query: { type: 'string' }, max_results: { type: 'number' }, unread_only: { type: 'boolean' } } } },
  { name: 'get_message', description: 'Get full message content by ID', inputSchema: { type: 'object', properties: { message_id: { type: 'string' } }, required: ['message_id'] } },
  { name: 'send_email', description: 'Send an email', inputSchema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' }, cc: { type: 'string' }, bcc: { type: 'string' }, in_reply_to: { type: 'string' } }, required: ['to', 'subject', 'body'] } },
  { name: 'create_draft', description: 'Create an email draft', inputSchema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' }, cc: { type: 'string' } }, required: ['to', 'subject', 'body'] } },
  { name: 'modify_labels', description: 'Add or remove labels from a message', inputSchema: { type: 'object', properties: { message_id: { type: 'string' }, add_labels: { type: 'array', items: { type: 'string' } }, remove_labels: { type: 'array', items: { type: 'string' } } }, required: ['message_id'] } },
  { name: 'mark_as_read', description: 'Mark messages as read', inputSchema: { type: 'object', properties: { message_ids: { type: 'array', items: { type: 'string' } } }, required: ['message_ids'] } },
  { name: 'search_emails', description: 'Search emails with a query', inputSchema: { type: 'object', properties: { query: { type: 'string' }, max_results: { type: 'number' } }, required: ['query'] } },
  { name: 'delete_message', description: 'Permanently delete a message', inputSchema: { type: 'object', properties: { message_id: { type: 'string' } }, required: ['message_id'] } },
  { name: 'unsubscribe', description: 'Unsubscribe from a mailing list', inputSchema: { type: 'object', properties: { message_id: { type: 'string' } }, required: ['message_id'] } },
];
