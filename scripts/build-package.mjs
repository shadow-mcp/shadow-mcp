#!/usr/bin/env node

/**
 * Build the publishable `mcp-shadow` npm package.
 *
 * Creates a `publish/` directory with:
 *   dist/cli.js          — CLI entry (esbuild bundle)
 *   dist/proxy.js         — Proxy (esbuild bundle)
 *   dist/server-slack.js  — Slack server (esbuild bundle)
 *   dist/server-stripe.js — Stripe server (esbuild bundle)
 *   dist/server-gmail.js  — Gmail server (esbuild bundle)
 *   dist/demo-agent.cjs   — Demo agent (copy)
 *   dist/console/          — Console static files (copy)
 *   scenarios/             — YAML scenario files (copy)
 *   package.json           — Publishable package manifest
 *   LICENSE                — MIT license from root
 *
 * All JS dependencies are inlined by esbuild except `better-sqlite3` (native).
 */

import { execSync } from 'child_process';
import { mkdirSync, cpSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const publishDir = resolve(root, 'publish');

console.log('Building publishable mcp-shadow package...\n');

// 1. Clean (remove contents, not the dir itself — avoids CWD issues)
if (existsSync(resolve(publishDir, 'dist'))) {
  rmSync(resolve(publishDir, 'dist'), { recursive: true });
}
if (existsSync(resolve(publishDir, 'scenarios'))) {
  rmSync(resolve(publishDir, 'scenarios'), { recursive: true });
}
mkdirSync(resolve(publishDir, 'dist'), { recursive: true });

// 2. Build all packages first (tsc + vite)
console.log('Step 1/4: Building packages...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

// 3. esbuild bundles
console.log('\nStep 2/4: Bundling with esbuild...');

const esbuildCommon = [
  '--bundle',
  '--platform=node',
  '--target=node20',
  '--format=esm',
  '--external:better-sqlite3',
].join(' ');

const bundles = [
  {
    entry: 'packages/cli/dist/index.js',
    out: 'publish/dist/cli.js',
    extra: '',
  },
  {
    entry: 'packages/proxy/dist/index.js',
    out: 'publish/dist/proxy.js',
    extra: '',
  },
  {
    entry: 'packages/server-slack/dist/index.js',
    out: 'publish/dist/server-slack.js',
    extra: '',
  },
  {
    entry: 'packages/server-stripe/dist/index.js',
    out: 'publish/dist/server-stripe.js',
    extra: '',
  },
  {
    entry: 'packages/server-gmail/dist/index.js',
    out: 'publish/dist/server-gmail.js',
    extra: '',
  },
];

for (const { entry, out, extra } of bundles) {
  const cmd = `npx esbuild ${entry} ${esbuildCommon} --outfile=${out} ${extra}`.trim();
  console.log(`  ${entry} → ${out}`);
  execSync(cmd, { cwd: root, stdio: 'pipe' });
}

// 3b. Fix CLI shebang (esbuild preserves the source shebang, ensure only one)
const cliPath = resolve(publishDir, 'dist/cli.js');
let cliContent = readFileSync(cliPath, 'utf-8');
// Remove all shebangs, then add exactly one
cliContent = cliContent.replace(/^#!.*\n/gm, '');
cliContent = '#!/usr/bin/env node\n' + cliContent;
writeFileSync(cliPath, cliContent);
console.log('  Fixed CLI shebang');

// 4. Copy static files
console.log('\nStep 3/4: Copying static files...');

// Console dist
cpSync(
  resolve(root, 'packages/console/dist'),
  resolve(publishDir, 'dist/console'),
  { recursive: true }
);
console.log('  packages/console/dist/ → publish/dist/console/');

// Demo agent
cpSync(
  resolve(root, 'packages/cli/demo-agent.cjs'),
  resolve(publishDir, 'dist/demo-agent.cjs')
);
console.log('  packages/cli/demo-agent.cjs → publish/dist/demo-agent.cjs');

// Scenarios
cpSync(
  resolve(root, 'scenarios'),
  resolve(publishDir, 'scenarios'),
  { recursive: true }
);
console.log('  scenarios/ → publish/scenarios/');

// LICENSE
if (existsSync(resolve(root, 'LICENSE'))) {
  cpSync(resolve(root, 'LICENSE'), resolve(publishDir, 'LICENSE'));
  console.log('  LICENSE → publish/LICENSE');
}

// 5. Generate package.json
console.log('\nStep 4/4: Generating package.json...');

const rootPkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));

const publishPkg = {
  name: 'mcp-shadow',
  version: rootPkg.version || '0.1.0',
  type: 'module',
  description: 'The staging environment for AI agents. Rehearse every action before it hits production.',
  bin: {
    shadow: 'dist/cli.js',
    'mcp-shadow': 'dist/cli.js',
  },
  main: 'dist/cli.js',
  files: [
    'dist/',
    'scenarios/',
    'LICENSE',
  ],
  dependencies: {
    'better-sqlite3': '^11.0.0',
  },
  engines: {
    node: '>=20.0.0',
  },
  keywords: [
    'mcp', 'ai-agents', 'testing', 'simulation', 'shadow',
    'staging', 'trust', 'model-context-protocol',
  ],
  license: 'MIT',
  repository: {
    type: 'git',
    url: 'git+https://github.com/shadow-mcp/shadow-mcp.git',
  },
  homepage: 'https://useshadow.dev',
  bugs: {
    url: 'https://github.com/shadow-mcp/shadow-mcp/issues',
  },
};

writeFileSync(
  resolve(publishDir, 'package.json'),
  JSON.stringify(publishPkg, null, 2) + '\n'
);
console.log('  Generated publish/package.json');

// Make CLI executable
execSync(`chmod +x ${resolve(publishDir, 'dist/cli.js')}`);

// Summary
console.log('\n' + '='.repeat(60));
console.log('Package ready at: publish/');
console.log('');
console.log('To test locally:');
console.log('  cd publish && npm install && node dist/cli.js demo --no-open');
console.log('');
console.log('To publish:');
console.log('  cd publish && npm publish');
console.log('='.repeat(60));
