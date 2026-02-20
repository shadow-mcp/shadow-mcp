import { ServiceSchema } from '@shadow-mcp/core';

/**
 * Slack service schema — defines the SQLite tables for stateful Slack simulation.
 */
export const slackSchema: ServiceSchema = {
  service: 'slack',
  tables: [
    {
      name: 'slack_workspaces',
      columns: [
        { name: 'name', type: 'TEXT' },
        { name: 'domain', type: 'TEXT' },
      ],
    },
    {
      name: 'slack_channels',
      columns: [
        { name: 'workspace_id', type: 'TEXT' },
        { name: 'name', type: 'TEXT' },
        { name: 'topic', type: 'TEXT', nullable: true },
        { name: 'purpose', type: 'TEXT', nullable: true },
        { name: 'is_private', type: 'INTEGER', defaultValue: 0 },
        { name: 'is_archived', type: 'INTEGER', defaultValue: 0 },
        { name: 'is_external', type: 'INTEGER', defaultValue: 0 },
      ],
    },
    {
      name: 'slack_users',
      columns: [
        { name: 'workspace_id', type: 'TEXT' },
        { name: 'name', type: 'TEXT' },
        { name: 'display_name', type: 'TEXT' },
        { name: 'email', type: 'TEXT', nullable: true },
        { name: 'is_bot', type: 'INTEGER', defaultValue: 0 },
        { name: 'is_admin', type: 'INTEGER', defaultValue: 0 },
        { name: 'status', type: 'TEXT', defaultValue: 'active' },
      ],
    },
    {
      name: 'slack_channel_members',
      columns: [
        { name: 'channel_id', type: 'TEXT' },
        { name: 'user_id', type: 'TEXT' },
      ],
    },
    {
      name: 'slack_messages',
      columns: [
        { name: 'channel_id', type: 'TEXT' },
        { name: 'user_id', type: 'TEXT' },
        { name: 'text', type: 'TEXT' },
        { name: 'thread_ts', type: 'TEXT', nullable: true },
        { name: 'ts', type: 'TEXT' },
      ],
    },
    {
      name: 'slack_reactions',
      columns: [
        { name: 'message_id', type: 'TEXT' },
        { name: 'user_id', type: 'TEXT' },
        { name: 'emoji', type: 'TEXT' },
      ],
    },
  ],
};

/**
 * Default workspace seed data for a realistic simulation.
 */
export interface SlackSeedData {
  workspace: { name: string; domain: string };
  channels: Array<{
    name: string;
    topic?: string;
    purpose?: string;
    is_private?: boolean;
    is_external?: boolean;
    members?: string[];
  }>;
  users: Array<{
    name: string;
    display_name: string;
    email?: string;
    is_bot?: boolean;
    is_admin?: boolean;
  }>;
  messages?: Array<{
    channel: string;
    user: string;
    text: string;
    thread_ts?: string;
  }>;
}

export const defaultSeedData: SlackSeedData = {
  workspace: {
    name: 'Acme Corp',
    domain: 'acme-corp',
  },
  channels: [
    { name: 'general', topic: 'Company-wide announcements', purpose: 'General discussion' },
    { name: 'engineering', topic: 'Engineering team', purpose: 'Technical discussions', is_private: true },
    { name: 'clients', topic: 'Client communications', purpose: 'External-facing client channel', is_external: true },
    { name: 'random', topic: 'Non-work banter', purpose: 'Fun stuff' },
    { name: 'sales', topic: 'Sales pipeline', purpose: 'Sales team discussions' },
  ],
  users: [
    { name: 'alice.johnson', display_name: 'Alice Johnson', email: 'alice@acmecorp.com', is_admin: true },
    { name: 'bob.smith', display_name: 'Bob Smith', email: 'bob@acmecorp.com' },
    { name: 'carol.williams', display_name: 'Carol Williams', email: 'carol@acmecorp.com' },
    { name: 'dave.client', display_name: 'Dave (Client)', email: 'dave@clientcorp.com' },
    { name: 'eve.intern', display_name: 'Eve (Intern)', email: 'eve@acmecorp.com' },
    { name: 'ai-agent', display_name: 'AI Agent', is_bot: true },
  ],
};
