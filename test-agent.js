#!/usr/bin/env node

/**
 * Test Agent — simulates an AI agent calling Shadow MCP tools.
 *
 * Usage:
 *   node test-agent.js [scenario]
 *
 * Scenarios:
 *   gmail     — List inbox, read emails, reply, search
 *   slack     — List channels, read history, post messages
 *   stripe    — Create customer, charge, refund
 *   chaos     — Do risky things (PII leak, mass delete, etc.)
 *   all       — Run all scenarios (default)
 */

const { spawn } = require('child_process');
const path = require('path');

const scenario = process.argv[2] || 'all';

// Parse optional --ws-port flag (default 3002 to avoid colliding with Vite)
const wsPortFlag = process.argv.find(a => a.startsWith('--ws-port='));
const wsPort = wsPortFlag ? wsPortFlag.split('=')[1] : '3002';

// Start the proxy as a child process
const proxy = spawn('node', [
  path.join(__dirname, 'packages/proxy/dist/index.js'),
  '--services=slack,stripe,gmail',
  `--ws-port=${wsPort}`,
], {
  stdio: ['pipe', 'pipe', 'inherit'], // inherit stderr so we see proxy logs
});

let stdout = '';
const pendingRequests = new Map(); // id → resolve
let nextId = 1;

proxy.stdout.on('data', (data) => {
  stdout += data.toString();
  const lines = stdout.split('\n');
  stdout = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pendingRequests.has(msg.id)) {
        pendingRequests.get(msg.id)(msg);
        pendingRequests.delete(msg.id);
      }
    } catch {}
  }
});

function send(method, params) {
  return new Promise((resolve) => {
    const id = nextId++;
    pendingRequests.set(id, resolve);
    const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    proxy.stdin.write(msg);
  });
}

function notify(method, params) {
  const msg = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
  proxy.stdin.write(msg);
}

function callTool(name, args = {}) {
  return send('tools/call', { name, arguments: args });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function printResult(label, response) {
  const content = response?.result?.content?.[0]?.text;
  if (content) {
    try {
      const parsed = JSON.parse(content);
      console.log(`\n✅ ${label}:`);
      console.log(JSON.stringify(parsed, null, 2).slice(0, 500));
      if (JSON.stringify(parsed).length > 500) console.log('  ... (truncated)');
    } catch {
      console.log(`\n✅ ${label}: ${content.slice(0, 200)}`);
    }
  } else if (response?.result?.isError) {
    console.log(`\n❌ ${label}: ${response.result.content?.[0]?.text}`);
  }
}

// === SCENARIOS ===

async function gmailScenario() {
  console.log('\n' + '═'.repeat(60));
  console.log('📧  GMAIL SCENARIO — Inbox Triage');
  console.log('═'.repeat(60));

  await sleep(500);

  // List inbox
  let r = await callTool('list_messages', { max_results: 10 });
  printResult('Listed inbox', r);

  // Extract first message ID from the response
  let firstMsgId = null;
  try {
    const content = r?.result?.content?.[0]?.text;
    if (content) {
      const parsed = JSON.parse(content);
      firstMsgId = parsed.messages?.[0]?.id;
    }
  } catch {}
  await sleep(800);

  // Search for important emails
  r = await callTool('search_emails', { query: 'contract' });
  printResult('Searched for "contract"', r);
  await sleep(800);

  // Read the first message if we have an ID
  if (firstMsgId) {
    r = await callTool('get_message', { message_id: firstMsgId });
    printResult(`Read message ${firstMsgId}`, r);
  } else {
    console.log('\n⏭  Skipping get_message (no message ID from list)');
  }
  await sleep(800);

  // Send a reply
  r = await callTool('send_email', {
    to: 'sarah.chen@techcorp.com',
    subject: 'Re: Q4 Contract Renewal',
    body: 'Hi Sarah, I\'ve reviewed the contract. The terms look good. I\'ll have the signed copy back to you by EOD tomorrow.',
  });
  printResult('Sent reply email', r);
  await sleep(600);

  // Create a draft
  r = await callTool('create_draft', {
    to: 'team@company.com',
    subject: 'Weekly Status Update',
    body: 'Hi team, here\'s the weekly update:\n\n- Contract renewal in progress\n- Sprint review completed\n- New hires starting Monday',
  });
  printResult('Created draft', r);
  await sleep(500);
}

async function slackScenario() {
  console.log('\n' + '═'.repeat(60));
  console.log('💬  SLACK SCENARIO — Channel Operations');
  console.log('═'.repeat(60));

  await sleep(500);

  // List channels
  let r = await callTool('list_channels');
  printResult('Listed channels', r);
  await sleep(800);

  // Get channel history
  r = await callTool('get_channel_history', { channel: 'general', limit: 5 });
  printResult('Got #general history', r);
  await sleep(800);

  // List users
  r = await callTool('list_users');
  printResult('Listed users', r);
  await sleep(600);

  // Post a message
  r = await callTool('post_message', {
    channel: 'general',
    text: 'Good morning team! Just wanted to share that the Q4 metrics are looking strong. Great work everyone! 🎉',
  });
  printResult('Posted to #general', r);
  await sleep(800);

  // Post to engineering
  r = await callTool('post_message', {
    channel: 'engineering',
    text: 'Heads up: deploying v2.4.1 to staging at 3pm. Please hold off on merging to main until the deployment is complete.',
  });
  printResult('Posted to #engineering', r);
  await sleep(600);

  // Search messages
  r = await callTool('search_messages', { query: 'deploy' });
  printResult('Searched for "deploy"', r);
  await sleep(500);
}

async function stripeScenario() {
  console.log('\n' + '═'.repeat(60));
  console.log('💳  STRIPE SCENARIO — Payment Lifecycle');
  console.log('═'.repeat(60));

  await sleep(500);

  // Check balance
  let r = await callTool('get_balance');
  printResult('Got account balance', r);
  await sleep(800);

  // Create a customer
  r = await callTool('create_customer', {
    email: 'jane.doe@example.com',
    name: 'Jane Doe',
    description: 'Enterprise customer - annual plan',
  });
  printResult('Created customer', r);

  // Extract customer ID from response
  let customerId = 'cus_unknown';
  try {
    const content = r?.result?.content?.[0]?.text;
    if (content) {
      const parsed = JSON.parse(content);
      customerId = parsed.id;
    }
  } catch {}
  await sleep(800);

  // Create a charge
  r = await callTool('create_charge', {
    customer: customerId,
    amount: 9900,
    currency: 'usd',
    description: 'Pro Plan - Monthly',
  });
  printResult('Created charge ($99.00)', r);

  let chargeId = 'ch_unknown';
  try {
    const content = r?.result?.content?.[0]?.text;
    if (content) {
      const parsed = JSON.parse(content);
      chargeId = parsed.id;
    }
  } catch {}
  await sleep(800);

  // List charges
  r = await callTool('list_charges', { customer: customerId });
  printResult('Listed charges for customer', r);
  await sleep(600);

  // Create a partial refund
  r = await callTool('create_refund', {
    charge: chargeId,
    amount: 2500,
    reason: 'Prorated refund for plan downgrade',
  });
  printResult('Created partial refund ($25.00)', r);
  await sleep(500);
}

async function chaosScenario() {
  console.log('\n' + '═'.repeat(60));
  console.log('🔥  CHAOS SCENARIO — Risky Agent Behavior');
  console.log('═'.repeat(60));

  await sleep(500);

  // Try to leak PII in a Slack message
  let r = await callTool('post_message', {
    channel: 'general',
    text: 'Hey, Dave\'s SSN is 123-45-6789 and his credit card is 4111-1111-1111-1111. Can someone update the records?',
  });
  printResult('⚠️  Posted PII to #general', r);
  await sleep(1000);

  // Try to send PII via email
  r = await callTool('send_email', {
    to: 'external@competitor.com',
    subject: 'Customer Data Export',
    body: 'Here is the customer data you requested:\nSSN: 987-65-4321\nCredit Card: 5500-0000-0000-0004\nPassword: hunter2',
  });
  printResult('⚠️  Sent PII via email to external address', r);
  await sleep(1000);

  // Try to delete a channel
  r = await callTool('delete_channel', { channel: 'engineering' });
  printResult('⚠️  Deleted #engineering channel', r);
  await sleep(800);

  // Try a high-value charge
  r = await callTool('create_customer', { email: 'victim@example.com', name: 'Victim' });
  let victimId = 'cus_unknown';
  try {
    const content = r?.result?.content?.[0]?.text;
    if (content) victimId = JSON.parse(content).id;
  } catch {}
  await sleep(500);

  r = await callTool('create_charge', {
    customer: victimId,
    amount: 5000000,
    currency: 'usd',
    description: 'Unauthorized charge',
  });
  printResult('⚠️  Created $50,000 charge', r);
  await sleep(500);

  // Delete a customer
  r = await callTool('delete_customer', { customer_id: victimId });
  printResult('⚠️  Deleted customer record', r);
  await sleep(500);

  // Delete an email
  r = await callTool('delete_message', { message_id: 'msg_1' });
  printResult('⚠️  Deleted email message', r);
  await sleep(500);
}

// === MAIN ===

async function main() {
  console.log('🌑 Shadow Test Agent');
  console.log('   Simulating agent behavior against Shadow MCP servers');
  console.log(`   Console: open http://localhost:3001?ws=ws://localhost:${wsPort}`);
  console.log('');

  // Initialize MCP connection
  await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'shadow-test-agent', version: '1.0.0' },
  });
  notify('notifications/initialized', {});

  // List available tools
  const toolsResponse = await send('tools/list', {});
  const toolCount = toolsResponse?.result?.tools?.length || 0;
  console.log(`Connected to Shadow Proxy — ${toolCount} tools available\n`);

  await sleep(1000);

  const scenarios = {
    gmail: gmailScenario,
    slack: slackScenario,
    stripe: stripeScenario,
    chaos: chaosScenario,
  };

  if (scenario === 'all') {
    await slackScenario();
    await sleep(1000);
    await stripeScenario();
    await sleep(1000);
    await gmailScenario();
  } else if (scenarios[scenario]) {
    await scenarios[scenario]();
  } else {
    console.log(`Unknown scenario: ${scenario}`);
    console.log('Available: gmail, slack, stripe, chaos, all');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Test agent finished. Check the Console for the full replay.');
  console.log('   Console stays open for 30s — press Ctrl+C to exit early.');
  console.log('═'.repeat(60) + '\n');

  // Keep proxy alive so Console can inspect results
  await sleep(30000);
  proxy.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  proxy.kill();
  process.exit(1);
});
