#!/usr/bin/env node

/**
 * Record a GIF of the Shadow Console demo.
 * Captures frames at each step, then stitches into a GIF with ffmpeg.
 *
 * Requires: Chrome installed, demo running on localhost:3000/3002, ffmpeg installed
 * Usage: node scripts/record-gif.mjs
 */

import puppeteer from 'puppeteer-core';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync, unlinkSync, readdirSync } from 'fs';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const framesDir = resolve(__dirname, '..', 'docs', 'gif-frames');
const outFile = resolve(__dirname, '..', 'docs', 'demo.gif');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CONSOLE_URL = 'http://localhost:3000/?ws=ws://localhost:3002';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let frameNum = 0;

async function capture(page, holdFrames = 1) {
  // Capture multiple identical frames to create a "pause" effect
  for (let i = 0; i < holdFrames; i++) {
    const path = resolve(framesDir, `frame-${String(frameNum++).padStart(4, '0')}.png`);
    await page.screenshot({ path, type: 'png' });
  }
}

async function clickNext(page) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent?.trim(), btn);
    if (text === '\u25B6') {
      await btn.click();
      await sleep(200);
      // Dismiss act card if it appears
      try {
        const overlay = await page.$('.z-40');
        if (overlay) {
          await sleep(400);
          await overlay.click();
          await sleep(300);
        }
      } catch {}
      return;
    }
  }
}

async function main() {
  // Clean up frames dir
  if (existsSync(framesDir)) {
    for (const f of readdirSync(framesDir)) unlinkSync(resolve(framesDir, f));
  } else {
    mkdirSync(framesDir, { recursive: true });
  }

  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--window-size=1200,750', '--no-sandbox'],
    defaultViewport: { width: 1200, height: 750 },
  });

  const page = await browser.newPage();

  console.log('Loading Shadow Console...');
  await page.goto(CONSOLE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
  await sleep(3000);

  // Click Start Demo
  try {
    const startBtn = await page.$('button');
    if (startBtn) {
      const btnText = await page.evaluate(el => el.textContent, startBtn);
      if (btnText?.includes('Start Demo')) {
        await startBtn.click();
        await sleep(500);
      }
    }
  } catch {}

  // Dismiss act card
  try {
    const overlay = await page.$('.z-40');
    if (overlay) {
      await overlay.click();
      await sleep(500);
    }
  } catch {}

  // ── Act 1: Gmail (steps 1-3) ──
  console.log('Act 1: Gmail triage...');
  await sleep(300);
  await capture(page, 4); // Hold on Gmail inbox

  await clickNext(page); // Step 2
  await sleep(400);
  await capture(page, 3);

  await clickNext(page); // Step 3
  await sleep(400);
  await capture(page, 3);

  // ── Act 2: Slack (steps 4-7) ──
  console.log('Act 2: Slack customer service...');
  await clickNext(page); // Step 4 - list_channels
  await sleep(500);
  await capture(page, 3);

  await clickNext(page); // Step 5 - get_channel_history
  await sleep(500);
  await capture(page, 4); // Hold longer — shows Dave's messages

  await clickNext(page); // Step 6 - post_message
  await sleep(400);
  await capture(page, 3);

  await clickNext(page); // Step 7 - post_message engineering
  await sleep(400);
  await capture(page, 3);

  // ── Act 3: Phishing (steps 8-12) ──
  console.log('Act 3: Phishing attack...');
  await clickNext(page); // Step 8 - list_messages (phishing arrives)
  await sleep(500);
  await capture(page, 4);

  await clickNext(page); // Step 9 - read_email
  await sleep(500);
  await capture(page, 5); // Hold — user reads the phishing email

  await clickNext(page); // Step 10 - post_message general
  await sleep(400);
  await capture(page, 3);

  await clickNext(page); // Step 11 - send_email PII leak
  await sleep(500);
  await capture(page, 6); // Hold long — CRITICAL moment

  await clickNext(page); // Step 12 - send_email salary data
  await sleep(500);
  await capture(page, 6); // Hold long — another CRITICAL

  // ── Act 4: Unauthorized refund (steps 13-15) ──
  console.log('Act 4: Unauthorized refund...');
  await clickNext(page); // Step 13 - create_charge
  await sleep(500);
  await capture(page, 4);

  await clickNext(page); // Step 14 - create_refund
  await sleep(500);
  await capture(page, 6); // Hold long — big refund

  await clickNext(page); // Step 15 - end
  await sleep(400);
  await capture(page, 3);

  // ── Shadow Report ──
  console.log('Shadow Report...');
  const tabs = await page.$$('button');
  for (const tab of tabs) {
    const text = await page.evaluate(el => el.textContent?.trim(), tab);
    if (text === 'Shadow Report') {
      await tab.click();
      await sleep(800);
      break;
    }
  }
  await capture(page, 8); // Hold long on the report — money shot

  console.log(`Captured ${frameNum} frames`);
  await browser.close();

  // ── Stitch frames into GIF with ffmpeg ──
  console.log('Creating GIF with ffmpeg...');
  // 4 fps — each "hold frame" = 250ms. So holdFrames=4 = 1 second pause
  const cmd = `ffmpeg -y -framerate 4 -i "${framesDir}/frame-%04d.png" -vf "fps=4,scale=1200:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${outFile}"`;

  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`\nGIF saved to: ${outFile}`);

    // Get file size
    const { statSync } = await import('fs');
    const stat = statSync(outFile);
    const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
    console.log(`Size: ${sizeMB} MB`);
  } catch (err) {
    console.error('ffmpeg failed:', err.message);
    console.log(`\nFrames saved to: ${framesDir}/ (${frameNum} frames)`);
    console.log('Run manually: ffmpeg -framerate 4 -i frame-%04d.png -vf "..." demo.gif');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
