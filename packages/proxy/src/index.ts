#!/usr/bin/env node

export { ShadowProxy, type ProxyConfig } from './shadow-proxy.js';
export { EventBus, type ProxyEvent } from './event-bus.js';
export { ToolRegistry, SLACK_TOOLS, STRIPE_TOOLS, GMAIL_TOOLS } from './tool-registry.js';

/**
 * If run directly (not imported), start the proxy with default config.
 * This allows: node packages/proxy/dist/index.js --services slack,stripe,gmail
 */
import { ShadowProxy } from './shadow-proxy.js';

const args = process.argv.slice(2);
const isDirectRun = !args.includes('--lib');

if (isDirectRun && args.length >= 0) {
  const servicesArg = args.find(a => a.startsWith('--services='));
  const services = servicesArg
    ? servicesArg.split('=')[1].split(',')
    : ['slack', 'stripe', 'gmail'];

  const wsPortArg = args.find(a => a.startsWith('--ws-port='));
  const wsPort = wsPortArg ? parseInt(wsPortArg.split('=')[1], 10) : 3001;

  const wsTokenArg = args.find(a => a.startsWith('--ws-token='));
  const wsToken = wsTokenArg ? wsTokenArg.split('=')[1] : undefined;

  const noConsole = args.includes('--no-console');
  const allowShadowTools = args.includes('--allow-shadow-tools');

  const proxy = new ShadowProxy({
    services,
    wsPort,
    enableConsole: !noConsole,
    wsToken,
    allowShadowTools,
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\n[Shadow] Shutting down...');
    await proxy.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await proxy.shutdown();
    process.exit(0);
  });

  proxy.start().catch((err) => {
    console.error('[Shadow] Fatal error:', err);
    process.exit(1);
  });
}
