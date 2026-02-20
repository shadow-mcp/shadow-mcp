#!/usr/bin/env node

import { Command } from 'commander';
import { spawn, ChildProcess } from 'child_process';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, realpathSync, writeFileSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';
import { homedir } from 'os';
import { createServer } from 'http';
import {
  StateEngine,
  parseScenario,
  evaluateScenario,
  generateReport,
  formatReportForTerminal,
  formatReportAsJson,
  type EvaluationContext,
  type AgentMessage,
  type ScenarioConfig,
} from '@shadow-mcp/core';

const __dirname = dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name('shadow')
  .description('Shadow MCP — The staging environment for AI agents')
  .version('0.1.0');

// ── shadow run ─────────────────────────────────────────────────────────

program
  .command('run')
  .description('Run a Shadow simulation')
  .argument('[scenario]', 'Path to a scenario YAML file or scenario name')
  .option('-s, --services <services>', 'Services to simulate (comma-separated: slack,stripe,gmail)', 'slack')
  .option('--json', 'Output report as JSON')
  .option('--ci', 'CI mode — exit code 1 on failure, minimal output')
  .option('--threshold <n>', 'Override trust score threshold', '85')
  .option('--ws-port <port>', 'WebSocket port for Console', '3002')
  .option('--no-console', 'Disable WebSocket server for Console')
  .action(async (scenario, opts) => {
    // Banner
    if (!opts.ci) {
      console.error('');
      console.error('\x1b[35m\x1b[1m  ◈ Shadow MCP\x1b[0m');
      console.error('\x1b[2m  The staging environment for AI agents\x1b[0m');
      console.error('');
    }

    // Load scenario if provided
    let scenarioConfig: ScenarioConfig | null = null;
    if (scenario) {
      const scenarioPath = resolveScenarioPath(scenario);
      if (!scenarioPath) {
        console.error(`\x1b[31m  Error: Scenario not found: ${scenario}\x1b[0m`);
        process.exit(1);
      }
      const yaml = readFileSync(scenarioPath, 'utf-8');
      scenarioConfig = parseScenario(yaml);
      if (!opts.ci) {
        console.error(`\x1b[2m  Scenario: ${scenarioConfig.name}\x1b[0m`);
        console.error(`\x1b[2m  Service: ${scenarioConfig.service}\x1b[0m`);
        console.error('');
      }
    }

    // Parse services (comma-separated)
    const services = (scenarioConfig?.service || opts.services)
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);

    // Validate services
    const validServices = ['slack', 'stripe', 'gmail'];
    for (const svc of services) {
      if (!validServices.includes(svc)) {
        console.error(`\x1b[31m  Error: Unknown service: ${svc}\x1b[0m`);
        console.error(`\x1b[2m  Available: ${validServices.join(', ')}\x1b[0m`);
        process.exit(1);
      }
    }

    if (!opts.ci) {
      console.error(`\x1b[2m  Simulating: ${services.join(', ')}\x1b[0m`);
    }

    // Resolve proxy path
    const proxyPath = resolveProxyPath();
    if (!proxyPath) {
      console.error('\x1b[31m  Error: Shadow proxy not found.\x1b[0m');
      process.exit(1);
    }

    // Build proxy args
    const proxyArgs = [
      proxyPath,
      `--services=${services.join(',')}`,
      `--ws-port=${opts.wsPort}`,
    ];
    if (!opts.console) {
      proxyArgs.push('--no-console');
    } else {
      // Generate a WS auth token so Console connections are authenticated
      const wsToken = randomBytes(16).toString('hex');
      proxyArgs.push(`--ws-token=${wsToken}`);
    }

    // Start the proxy — it spawns servers, handles MCP stdio, streams to Console
    const child = spawn('node', proxyArgs, {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    // Pipe stdin/stdout for MCP protocol
    process.stdin.pipe(child.stdin);
    child.stdout.pipe(process.stdout);

    child.on('exit', (code) => {
      process.exit(code || 0);
    });

    process.on('SIGINT', () => {
      child.kill('SIGINT');
      process.exit(0);
    });
  });

// ── shadow demo ───────────────────────────────────────────────────────

program
  .command('demo')
  .description('Run a scripted demo — no API key required')
  .option('--port <port>', 'Console port', '3000')
  .option('--ws-port <port>', 'WebSocket port', '3002')
  .option('--no-open', 'Don\'t auto-open browser')
  .action(async (opts) => {
    console.error('');
    console.error('\x1b[35m\x1b[1m  ◈ Shadow MCP Demo\x1b[0m');
    console.error('\x1b[2m  A scripted simulation — no API key required.\x1b[0m');
    console.error('');

    const port = parseInt(opts.port, 10);
    const wsPort = parseInt(opts.wsPort, 10);

    // 1. Serve the Console static files
    // Bundled layout: dist/console/ next to dist/cli.js
    // Monorepo layout: packages/cli/dist/ → packages/console/dist/
    const consoleDist = existsSync(resolve(__dirname, 'console'))
      ? resolve(__dirname, 'console')
      : resolve(__dirname, '..', '..', 'console', 'dist');
    if (!existsSync(consoleDist)) {
      console.error('\x1b[31m  Error: Console not built. Run `npm run build` first.\x1b[0m');
      process.exit(1);
    }

    const MIME: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
      '.json': 'application/json',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };

    const realConsoleDist = realpathSync(consoleDist);
    const server = createServer((req, res) => {
      const urlPath = req.url?.split('?')[0] || '/';
      let filePath = resolve(consoleDist, urlPath === '/' ? 'index.html' : urlPath.slice(1));

      // Prevent path traversal — ensure resolved path stays within consoleDist
      try {
        const realFilePath = realpathSync(filePath);
        if (!realFilePath.startsWith(realConsoleDist)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }
        filePath = realFilePath;
      } catch {
        // File doesn't exist — SPA fallback
        filePath = resolve(consoleDist, 'index.html');
      }

      try {
        const content = readFileSync(filePath);
        const ext = extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      console.error(`\x1b[2m  Console: http://localhost:${port}\x1b[0m`);
    });

    // 2. Start the demo agent (which starts the proxy internally)
    // Bundled: dist/demo-agent.cjs next to dist/cli.js
    // Monorepo: packages/cli/demo-agent.cjs (up from dist/)
    const demoAgentPath = existsSync(resolve(__dirname, 'demo-agent.cjs'))
      ? resolve(__dirname, 'demo-agent.cjs')
      : resolve(__dirname, '..', 'demo-agent.cjs');
    if (!existsSync(demoAgentPath)) {
      console.error('\x1b[31m  Error: demo-agent.cjs not found.\x1b[0m');
      process.exit(1);
    }

    const wsToken = randomBytes(16).toString('hex');

    const demoAgent = spawn('node', [demoAgentPath, `--ws-port=${wsPort}`, `--ws-token=${wsToken}`], {
      stdio: 'inherit',
    });

    // 3. Open browser after a short delay
    if (opts.open !== false) {
      setTimeout(async () => {
        const url = `http://localhost:${port}/?ws=ws://localhost:${wsPort}&token=${wsToken}`;
        console.error(`\x1b[2m  Opening: ${url}\x1b[0m`);
        console.error('');

        // Cross-platform browser open
        const { platform } = process;
        const cmd = platform === 'darwin' ? 'open'
          : platform === 'win32' ? 'start'
          : 'xdg-open';
        spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref();
      }, 3000);
    }

    // Graceful shutdown
    const cleanup = () => {
      server.close();
      demoAgent.kill();
      process.exit(0);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    demoAgent.on('exit', () => {
      // Keep console + WS server alive so users can still browse the demo.
      // The EventBus replays all events to new connections.
      console.error('');
      console.error('\x1b[2m  Demo complete — console still running. Press Ctrl+C to exit.\x1b[0m');
    });
  });

// ── shadow test ────────────────────────────────────────────────────────

program
  .command('test')
  .description('Run all scenarios in a directory and report results')
  .argument('<dir>', 'Directory containing scenario YAML files')
  .option('--json', 'Output as JSON')
  .option('--threshold <n>', 'Override trust threshold for all scenarios', '85')
  .action(async (dir, opts) => {
    console.error('\x1b[35m\x1b[1m  ◈ Shadow MCP Test Suite\x1b[0m');
    console.error('');

    const scenarioDir = resolve(dir);
    if (!existsSync(scenarioDir)) {
      console.error(`\x1b[31m  Error: Directory not found: ${scenarioDir}\x1b[0m`);
      process.exit(1);
    }

    // Find all YAML files
    const { readdirSync } = await import('fs');
    const files = readdirSync(scenarioDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    if (files.length === 0) {
      console.error(`\x1b[33m  No scenario files found in ${scenarioDir}\x1b[0m`);
      process.exit(0);
    }

    console.error(`\x1b[2m  Found ${files.length} scenario(s)\x1b[0m`);
    console.error(`\x1b[33m  ⚠ Lint mode: validating YAML + assertions against empty state.\x1b[0m`);
    console.error(`\x1b[2m    Assertions that check for absence (e.g. "== 0") pass vacuously.\x1b[0m`);
    console.error(`\x1b[2m    For live agent testing, use: shadow run <scenario> with a connected agent.\x1b[0m`);
    console.error('');

    let passed = 0;
    let failed = 0;

    for (const file of files) {
      const yaml = readFileSync(resolve(scenarioDir, file), 'utf-8');
      const scenarioConfig = parseScenario(yaml);

      if (opts.threshold) {
        scenarioConfig.trust_threshold = parseInt(opts.threshold, 10);
      }

      const state = new StateEngine();
      const context: EvaluationContext = {
        agentMessages: [],
        taskCompleted: true,
        responseTime: 0,
        custom: {},
      };

      const evaluation = evaluateScenario(scenarioConfig, state, context);
      const icon = evaluation.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      const score = evaluation.passed
        ? `\x1b[32m${evaluation.trustScore}\x1b[0m`
        : `\x1b[31m${evaluation.trustScore}\x1b[0m`;

      console.error(`  ${icon} ${scenarioConfig.name} — Trust Score: ${score}/100`);

      if (evaluation.passed) passed++;
      else failed++;

      state.close();
    }

    console.error('');
    console.error(`  \x1b[32m${passed} passed\x1b[0m  ${failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : '\x1b[2m0 failed\x1b[0m'}  \x1b[2m(${files.length} total)\x1b[0m`);
    console.error('');

    if (failed > 0) process.exit(1);
  });

// ── shadow list ────────────────────────────────────────────────────────

program
  .command('list')
  .description('List available scenarios')
  .action(async () => {
    console.error('\x1b[35m\x1b[1m  ◈ Shadow MCP Scenarios\x1b[0m');
    console.error('');

    const scenariosDir = getScenariosDir();
    if (!existsSync(scenariosDir)) {
      console.error('\x1b[2m  No scenarios directory found.\x1b[0m');
      return;
    }

    const { readdirSync } = await import('fs');
    const services = readdirSync(scenariosDir).filter(f => {
      try { return readdirSync(resolve(scenariosDir, f)).length > 0; } catch { return false; }
    });

    for (const service of services) {
      const files = readdirSync(resolve(scenariosDir, service)).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      if (files.length === 0) continue;

      console.error(`  \x1b[1m${service}\x1b[0m`);
      for (const file of files) {
        const yaml = readFileSync(resolve(scenariosDir, service, file), 'utf-8');
        try {
          const config = parseScenario(yaml);
          console.error(`    \x1b[2m•\x1b[0m ${config.name} — ${config.description}`);
        } catch {
          console.error(`    \x1b[2m•\x1b[0m ${file}`);
        }
      }
      console.error('');
    }
  });

// ── shadow doctor ─────────────────────────────────────────────────────

program
  .command('doctor')
  .description('Check environment health')
  .action(async () => {
    console.error('');
    console.error('\x1b[35m\x1b[1m  ◈ Shadow Doctor\x1b[0m');
    console.error('');

    let allPassed = true;

    function check(label: string, ok: boolean, detail: string) {
      const icon = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.error(`  ${icon} ${label.padEnd(17)}${detail}`);
      if (!ok) allPassed = false;
    }

    // 1. Node.js version
    const nodeVersion = process.version;
    const nodeMajor = parseInt(nodeVersion.slice(1), 10);
    check('Node.js', nodeMajor >= 20, `${nodeVersion} (requires >=20)`);

    // 2. Proxy
    check('Proxy', !!resolveProxyPath(), resolveProxyPath() ? 'found' : 'not found');

    // 3. Servers
    for (const svc of ['slack', 'stripe', 'gmail']) {
      const label = `${svc.charAt(0).toUpperCase() + svc.slice(1)} server`;
      check(label, !!resolveServerPath(svc), resolveServerPath(svc) ? 'found' : 'not found');
    }

    // 4. Console UI
    const consoleDist = existsSync(resolve(__dirname, 'console'))
      ? resolve(__dirname, 'console')
      : resolve(__dirname, '..', '..', 'console', 'dist');
    check('Console UI', existsSync(consoleDist), existsSync(consoleDist) ? 'found' : 'not found');

    // 5. Demo agent
    const demoAgentPath = existsSync(resolve(__dirname, 'demo-agent.cjs'))
      ? resolve(__dirname, 'demo-agent.cjs')
      : resolve(__dirname, '..', 'demo-agent.cjs');
    check('Demo agent', existsSync(demoAgentPath), existsSync(demoAgentPath) ? 'found' : 'not found');

    // 6-7. Port checks
    const port3000 = await checkPort(3000);
    check('Port 3000', port3000, port3000 ? 'available' : 'in use');
    const port3002 = await checkPort(3002);
    check('Port 3002', port3002, port3002 ? 'available' : 'in use');

    // 8. Scenarios
    const scenariosDir = getScenariosDir();
    let scenarioCount = 0;
    if (existsSync(scenariosDir)) {
      const { readdirSync } = await import('fs');
      for (const sub of readdirSync(scenariosDir)) {
        try {
          const files = readdirSync(resolve(scenariosDir, sub));
          scenarioCount += files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).length;
        } catch { /* not a directory */ }
      }
    }
    check('Scenarios', scenarioCount > 0, `${scenarioCount} found`);

    console.error('');
    if (allPassed) {
      console.error('  \x1b[32mAll checks passed — ready to simulate.\x1b[0m');
    } else {
      console.error('  \x1b[31mSome checks failed. Fix the issues above and try again.\x1b[0m');
    }
    console.error('');
  });

// ── shadow install ────────────────────────────────────────────────────

program
  .command('install')
  .description('Add Shadow MCP servers to your AI client config')
  .option('--client <client>', 'Target client: claude or openclaw (auto-detect if omitted)')
  .option('--services <services>', 'Services to add (comma-separated)', 'slack,stripe,gmail')
  .option('--dry-run', 'Preview changes without writing')
  .action(async (opts) => {
    console.error('');
    console.error('\x1b[35m\x1b[1m  ◈ Shadow Install\x1b[0m');
    console.error('');

    const services = opts.services.split(',').map((s: string) => s.trim()).filter(Boolean);
    const { client, configPath } = resolveClientConfig(opts.client);

    console.error(`\x1b[2m  Client:   ${client === 'claude' ? 'Claude Desktop' : 'OpenClaw'}\x1b[0m`);
    console.error(`\x1b[2m  Config:   ${configPath}\x1b[0m`);
    console.error(`\x1b[2m  Services: ${services.join(', ')}\x1b[0m`);
    console.error('');

    // Read or create config
    let config: Record<string, unknown> = {};
    if (existsSync(configPath)) {
      try {
        config = JSON.parse(readFileSync(configPath, 'utf-8'));
      } catch {
        console.error('\x1b[31m  Error: Could not parse existing config file.\x1b[0m');
        process.exit(1);
      }
    }

    // Build entries
    const entries: Record<string, unknown> = {};
    for (const svc of services) {
      entries[`shadow-${svc}`] = {
        command: 'npx',
        args: ['-y', 'mcp-shadow', 'run', `--services=${svc}`, '--no-console'],
      };
    }

    // Get or create mcpServers object at the right path
    if (client === 'openclaw') {
      if (!config.provider) config.provider = {};
      const provider = config.provider as Record<string, unknown>;
      if (!provider.mcpServers) provider.mcpServers = {};
      Object.assign(provider.mcpServers as Record<string, unknown>, entries);
    } else {
      if (!config.mcpServers) config.mcpServers = {};
      Object.assign(config.mcpServers as Record<string, unknown>, entries);
    }

    if (opts.dryRun) {
      console.error('\x1b[2m  Dry run — would write:\x1b[0m');
      console.error('');
      console.error(JSON.stringify(config, null, 2));
      console.error('');
      return;
    }

    // Ensure directory exists and write
    mkdirSync(resolve(configPath, '..'), { recursive: true });
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    for (const svc of services) {
      console.error(`  \x1b[32m✓\x1b[0m Added shadow-${svc}`);
    }
    console.error('');
    console.error(`  Restart ${client === 'claude' ? 'Claude Desktop' : 'OpenClaw'} to activate Shadow.`);
    console.error('  Run \x1b[2mshadow uninstall\x1b[0m to remove.');
    console.error('');
  });

// ── shadow uninstall ──────────────────────────────────────────────────

program
  .command('uninstall')
  .description('Remove Shadow MCP servers from your AI client config')
  .option('--client <client>', 'Target client: claude or openclaw (auto-detect if omitted)')
  .action(async (opts) => {
    console.error('');
    console.error('\x1b[35m\x1b[1m  ◈ Shadow Uninstall\x1b[0m');
    console.error('');

    const { client, configPath } = resolveClientConfig(opts.client);

    if (!existsSync(configPath)) {
      console.error('\x1b[2m  No config file found. Nothing to remove.\x1b[0m');
      console.error('');
      return;
    }

    let config: Record<string, unknown>;
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
      console.error('\x1b[31m  Error: Could not parse config file.\x1b[0m');
      process.exit(1);
    }

    // Find the mcpServers object
    let mcpServers: Record<string, unknown>;
    if (client === 'openclaw') {
      const provider = (config.provider || {}) as Record<string, unknown>;
      mcpServers = (provider.mcpServers || {}) as Record<string, unknown>;
    } else {
      mcpServers = (config.mcpServers || {}) as Record<string, unknown>;
    }

    // Remove all shadow-* keys
    const removed: string[] = [];
    for (const key of Object.keys(mcpServers)) {
      if (key.startsWith('shadow-')) {
        delete mcpServers[key];
        removed.push(key);
      }
    }

    if (removed.length === 0) {
      console.error('\x1b[2m  No Shadow entries found. Nothing to remove.\x1b[0m');
      console.error('');
      return;
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    for (const key of removed) {
      console.error(`  \x1b[32m✓\x1b[0m Removed ${key}`);
    }
    console.error('');
    console.error(`  Restart ${client === 'claude' ? 'Claude Desktop' : 'OpenClaw'} to apply.`);
    console.error('');
  });

// ── Helpers ────────────────────────────────────────────────────────────

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port, '127.0.0.1');
  });
}

function resolveClientConfig(clientOpt?: string): { client: 'claude' | 'openclaw'; configPath: string } {
  const home = homedir();
  const configs: Record<string, string> = {
    'claude-darwin': resolve(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    'claude-linux': resolve(home, '.config', 'Claude', 'claude_desktop_config.json'),
    'claude-win32': resolve(process.env.APPDATA || resolve(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json'),
    'openclaw': resolve(home, '.openclaw', 'openclaw.json'),
  };

  if (clientOpt === 'openclaw') {
    return { client: 'openclaw', configPath: configs.openclaw };
  }
  if (clientOpt === 'claude') {
    return { client: 'claude', configPath: configs[`claude-${process.platform}`] || configs['claude-darwin'] };
  }

  // Auto-detect: OpenClaw first (more specific), then Claude Desktop
  if (existsSync(configs.openclaw)) {
    return { client: 'openclaw', configPath: configs.openclaw };
  }
  // Default to Claude Desktop
  return { client: 'claude', configPath: configs[`claude-${process.platform}`] || configs['claude-darwin'] };
}

function getScenariosDir(): string {
  // Bundled layout: dist/../scenarios
  const bundled = resolve(__dirname, '..', 'scenarios');
  if (existsSync(bundled)) return bundled;
  // Monorepo layout: packages/cli/dist/ → root/scenarios/
  return resolve(__dirname, '..', '..', '..', 'scenarios');
}

function resolveScenarioPath(scenario: string): string | null {
  // Direct file path
  if (existsSync(scenario)) return resolve(scenario);

  // Check in scenarios directory
  const scenariosDir = getScenariosDir();

  // Try as service/name pattern
  if (scenario.includes('/')) {
    const path = resolve(scenariosDir, `${scenario}.yaml`);
    if (existsSync(path)) return path;
    const ymlPath = resolve(scenariosDir, `${scenario}.yml`);
    if (existsSync(ymlPath)) return ymlPath;
  }

  // Search all subdirectories
  const services = ['slack', 'stripe', 'gmail'];
  for (const service of services) {
    const path = resolve(scenariosDir, service, `${scenario}.yaml`);
    if (existsSync(path)) return path;
    const ymlPath = resolve(scenariosDir, service, `${scenario}.yml`);
    if (existsSync(ymlPath)) return ymlPath;
  }

  return null;
}

function resolveProxyPath(): string | null {
  // Bundled layout: dist/proxy.js next to dist/cli.js
  const bundled = resolve(__dirname, 'proxy.js');
  if (existsSync(bundled)) return bundled;

  // Monorepo layout: packages/cli/dist/ → packages/proxy/dist/index.js
  const monorepo = resolve(__dirname, '..', '..', 'proxy', 'dist', 'index.js');
  if (existsSync(monorepo)) return monorepo;

  return null;
}

function resolveServerPath(service: string): string | null {
  // Bundled layout: dist/server-slack.js next to dist/cli.js
  const bundled = resolve(__dirname, `server-${service}.js`);
  if (existsSync(bundled)) return bundled;

  // Monorepo layout: packages/cli/dist/ → packages/server-*/dist/
  const monorepo = resolve(__dirname, '..', '..', `server-${service}`, 'dist', 'index.js');
  if (existsSync(monorepo)) return monorepo;

  return null;
}

// Default to demo when no command is given (e.g. `npx mcp-shadow`)
if (process.argv.length <= 2) {
  process.argv.push('demo');
}

program.parse();
