#!/usr/bin/env node

/**
 * Captures fresh screenshots and GIF frames from the Shadow Console.
 *
 * 1. Starts the demo (proxy + console + demo-agent)
 * 2. Waits for key moments in the narrative
 * 3. Takes screenshots at: Slack view, phishing moment, Shadow Report
 * 4. Captures frames for an animated GIF
 *
 * Requires: puppeteer-core, Chrome installed
 * Output: website/screenshots/*.png, website/demo.gif
 */

import puppeteer from 'puppeteer-core';
import { spawn, execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const websiteDir = resolve(root, 'website');
const screenshotsDir = resolve(websiteDir, 'screenshots');
const framesDir = resolve(root, '.gif-frames');

mkdirSync(screenshotsDir, { recursive: true });
mkdirSync(framesDir, { recursive: true });

// Clean old frames
for (const f of readdirSync(framesDir)) {
  unlinkSync(resolve(framesDir, f));
}

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Helper: wait ms
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Helper: wait for WS connection in Console
async function waitForConsoleReady(page, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const connected = await page.evaluate(() => {
      // Check if SIMULATING or LIVE badge is present
      return document.body.innerText.includes('SIMULATING') ||
             document.body.innerText.includes('LIVE') ||
             document.body.innerText.includes('TRUST');
    });
    if (connected) return true;
    await sleep(500);
  }
  return false;
}

// Helper: wait for trust score to change
async function waitForTrustBelow(page, threshold, timeout = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const score = await page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/TRUST\s+(\d+)/);
      return match ? parseInt(match[1]) : 100;
    });
    if (score < threshold) return score;
    await sleep(1000);
  }
  return -1;
}

// Helper: wait for N tool calls
async function waitForToolCalls(page, count, timeout = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const current = await page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/(\d+)\/\d+/);
      return match ? parseInt(match[1]) : 0;
    });
    if (current >= count) return current;
    await sleep(1000);
  }
  return -1;
}

// Helper: click a tab
async function clickTab(page, tabName) {
  await page.evaluate((name) => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.trim() === name);
    if (btn) btn.click();
  }, tabName);
  await sleep(500);
}

// Helper: capture a frame for the GIF
let frameIndex = 0;
async function captureFrame(page) {
  const path = resolve(framesDir, `frame_${String(frameIndex++).padStart(4, '0')}.png`);
  await page.screenshot({ path, type: 'png' });
  return path;
}

async function main() {
  console.log('Starting demo...');

  // Use a fixed token so we can construct the Console URL
  const FIXED_TOKEN = 'screenshot-capture-token-2026';
  const WS_PORT = 3002;
  const HTTP_PORT = 3000;

  // Start the Console static file server
  const { createServer: createHttpServer } = await import('http');
  const { readFileSync: readFs, existsSync: existsFs } = await import('fs');
  const consoleDist = resolve(root, 'packages/console/dist');

  const httpServer = createHttpServer((req, res) => {
    const urlPath = req.url?.split('?')[0] || '/';
    let filePath = resolve(consoleDist, urlPath === '/' ? 'index.html' : urlPath.slice(1));
    if (!filePath.startsWith(consoleDist)) { res.writeHead(403); res.end(); return; }
    try {
      const data = readFs(filePath);
      const ext = filePath.split('.').pop();
      const types = { html: 'text/html', js: 'application/javascript', css: 'text/css', png: 'image/png', jpeg: 'image/jpeg', svg: 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  httpServer.listen(HTTP_PORT, '127.0.0.1');

  // Start demo-agent directly with our known token
  const demoAgentPath = resolve(root, 'packages/cli/demo-agent.cjs');
  const demo = spawn('node', [demoAgentPath, `--ws-port=${WS_PORT}`, `--ws-token=${FIXED_TOKEN}`], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH}` },
  });

  // Give demo time to start
  await sleep(5000);

  const consoleUrl = `http://localhost:${HTTP_PORT}/?ws=ws://localhost:${WS_PORT}&token=${FIXED_TOKEN}&skipOverlay`;
  console.log(`Console URL: ${consoleUrl}`);

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto(consoleUrl, { waitUntil: 'networkidle0', timeout: 15000 });

  console.log('Waiting for Console to connect...');
  const ready = await waitForConsoleReady(page);
  if (!ready) {
    console.error('Console did not connect in time');
    await browser.close();
    demo.kill();
    process.exit(1);
  }
  console.log('Console connected!');

  // skipOverlay URL param means no welcome splash, no act cards, auto-play on
  await sleep(2000);

  // Start capturing GIF frames in the background
  let captureInterval = setInterval(() => captureFrame(page), 2000);

  // ── Screenshot 1: Slack view (during Act 2 — customer service) ──
  console.log('Waiting for Slack activity (tool call 6+)...');
  await waitForToolCalls(page, 6, 60000);
  await clickTab(page, 'Slack');
  await sleep(1500);

  // Click on #clients channel if visible
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('div, span, li'));
    const clients = items.find(el => el.textContent?.trim() === '# clients');
    if (clients) clients.click();
  });
  await sleep(1000);

  await page.screenshot({ path: resolve(screenshotsDir, 'console-slack.png'), type: 'png' });
  console.log('✓ Captured console-slack.png');

  // ── Screenshot 2: Phishing moment (Act 3 — trust dropping) ──
  console.log('Waiting for phishing events (trust < 80)...');
  await waitForTrustBelow(page, 80, 90000);
  await clickTab(page, 'Gmail');
  await sleep(1500);


  await page.screenshot({ path: resolve(screenshotsDir, 'console-phishing.png'), type: 'png' });
  console.log('✓ Captured console-phishing.png');

  // ── Screenshot 3: Shadow Report (after demo completes) ──
  console.log('Waiting for demo to finish (tool call 15+)...');
  await waitForToolCalls(page, 15, 90000);
  await sleep(3000); // Let the report render

  await sleep(1000);


  await clickTab(page, 'Shadow Report');
  await sleep(2000);


  await page.screenshot({ path: resolve(screenshotsDir, 'console-report.png'), type: 'png' });
  console.log('✓ Captured console-report.png');

  // Stop frame capture
  clearInterval(captureInterval);
  // Capture a few more frames on the report
  for (let i = 0; i < 3; i++) {
    await captureFrame(page);
    await sleep(1000);
  }

  console.log(`Captured ${frameIndex} GIF frames`);

  // ── Generate GIF from frames using ffmpeg ──
  console.log('Generating GIF...');
  try {
    execSync(
      `ffmpeg -y -framerate 0.5 -pattern_type glob -i '${framesDir}/frame_*.png' -vf "scale=1400:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" -loop 0 "${resolve(websiteDir, 'demo.gif')}"`,
      { stdio: 'pipe' }
    );
    console.log('✓ Generated demo.gif');
  } catch (e) {
    console.error('ffmpeg not found — skipping GIF generation. Install with: brew install ffmpeg');
    console.log('Frames saved in .gif-frames/ — convert manually if needed');
  }

  await browser.close();
  demo.kill('SIGTERM');
  httpServer.close();

  // Clean up
  await sleep(1000);

  console.log('\nDone! Screenshots updated:');
  console.log('  website/screenshots/console-slack.png');
  console.log('  website/screenshots/console-phishing.png');
  console.log('  website/screenshots/console-report.png');
  console.log('  website/demo.gif');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
