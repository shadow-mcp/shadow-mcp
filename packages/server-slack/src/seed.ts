import { StateEngine } from '@shadow-mcp/core';
import { slackSchema, SlackSeedData, defaultSeedData } from './schema.js';

/**
 * Seed the state engine with a Slack workspace, channels, users, and initial messages.
 * Returns a lookup map for resolving names to IDs.
 */
export interface SeedResult {
  workspaceId: string;
  channels: Map<string, string>;   // channel name → channel ID
  users: Map<string, string>;       // user name → user ID
}

export function seedSlackWorkspace(
  state: StateEngine,
  data: SlackSeedData = defaultSeedData
): SeedResult {
  state.registerService(slackSchema);

  const channels = new Map<string, string>();
  const users = new Map<string, string>();

  // Create workspace
  const workspaceId = state.generateId('W');
  state.createObject('slack', 'workspace', workspaceId, {
    name: data.workspace.name,
    domain: data.workspace.domain,
  });

  state.executeRun(
    'INSERT INTO slack_workspaces (id, name, domain, _created_at, _updated_at) VALUES (?, ?, ?, ?, ?)',
    [workspaceId, data.workspace.name, data.workspace.domain, Date.now(), Date.now()]
  );

  // Create users
  for (const user of data.users) {
    const userId = state.generateId('U');
    users.set(user.name, userId);

    state.createObject('slack', 'user', userId, {
      name: user.name,
      display_name: user.display_name,
      email: user.email,
      is_bot: user.is_bot || false,
      is_admin: user.is_admin || false,
    });

    state.executeRun(
      'INSERT INTO slack_users (id, workspace_id, name, display_name, email, is_bot, is_admin, status, _created_at, _updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, workspaceId, user.name, user.display_name, user.email || null, user.is_bot ? 1 : 0, user.is_admin ? 1 : 0, 'active', Date.now(), Date.now()]
    );
  }

  // Create channels
  for (const channel of data.channels) {
    const channelId = state.generateId('C');
    channels.set(channel.name, channelId);

    state.createObject('slack', 'channel', channelId, {
      name: channel.name,
      topic: channel.topic,
      purpose: channel.purpose,
      is_private: channel.is_private || false,
      is_external: channel.is_external || false,
      is_archived: false,
    });

    state.executeRun(
      'INSERT INTO slack_channels (id, workspace_id, name, topic, purpose, is_private, is_archived, is_external, _created_at, _updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [channelId, workspaceId, channel.name, channel.topic || null, channel.purpose || null, channel.is_private ? 1 : 0, 0, channel.is_external ? 1 : 0, Date.now(), Date.now()]
    );

    // Add members — by default, add all non-external users to non-external channels
    const memberNames = channel.members || data.users
      .filter(u => !u.is_bot)
      .map(u => u.name);

    for (const memberName of memberNames) {
      const memberId = users.get(memberName);
      if (memberId) {
        state.executeRun(
          'INSERT INTO slack_channel_members (id, channel_id, user_id, _created_at, _updated_at) VALUES (?, ?, ?, ?, ?)',
          [state.generateId('CM'), channelId, memberId, Date.now(), Date.now()]
        );
      }
    }
  }

  // Seed initial messages if provided
  if (data.messages) {
    for (const msg of data.messages) {
      const channelId = channels.get(msg.channel);
      const userId = users.get(msg.user);
      if (!channelId || !userId) continue;

      const messageId = state.generateId('MSG');
      const ts = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

      state.createObject('slack', 'message', messageId, {
        channel_id: channelId,
        user_id: userId,
        text: msg.text,
        ts,
        thread_ts: msg.thread_ts || null,
        is_external: false,
      });

      state.executeRun(
        'INSERT INTO slack_messages (id, channel_id, user_id, text, ts, thread_ts, _created_at, _updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [messageId, channelId, userId, msg.text, ts, msg.thread_ts || null, Date.now(), Date.now()]
      );
    }
  }

  return { workspaceId, channels, users };
}
