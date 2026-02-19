#!/usr/bin/env node

import { Command } from 'commander';
import { spawn, ChildProcess } from 'child_process';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, realpathSync } from 'fs';
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

    const demoAgent = spawn('node', [demoAgentPath, `--ws-port=${wsPort}`], {
      stdio: 'inherit',
    });

    // 3. Open browser after a short delay
    if (opts.open !== false) {
      setTimeout(async () => {
        const url = `http://localhost:${port}/?ws=ws://localhost:${wsPort}`;
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

// ── Helpers ────────────────────────────────────────────────────────────

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

program.parse();
