#!/usr/bin/env node

/**
 * Record a GIF of the Shadow Console demo.
 * Captures frames at each step, then stitches into a GIF with ffmpeg.
 *
 * Act card overlays are kept visible for ~2 seconds (8 frames at 4fps)
 * to make the GIF more dramatic and readable.
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
  for (let i = 0; i < holdFrames; i++) {
    const path = resolve(framesDir, `frame-${String(frameNum++).padStart(4, '0')}.png`);
    await page.screenshot({ path, type: 'png' });
  }
}

/**
 * Check for an act card overlay (.z-40), capture it for several frames,
 * then dismiss it by clicking.
 */
async function captureAndDismissOverlay(page, holdFrames = 8) {
  try {
    const overlay = await page.$('.z-40');
    if (overlay) {
      await sleep(400); // Let fade-in animation finish
      await capture(page, holdFrames); // Show overlay for ~2s at 4fps
      await overlay.click();
      await sleep(300);
    }
  } catch {}
}

/**
 * Click the next button to advance one step.
 * Does NOT auto-dismiss overlays -- caller handles that.
 */
async function clickNext(page) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent?.trim(), btn);
    if (text === '\u25B6') {
      await btn.click();
      await sleep(200);
      return;
    }
  }
}

/**
 * Advance one step and handle any act card overlay that appears.
 * If an overlay appears, capture it for holdOverlayFrames before dismissing.
 */
async function advanceStep(page, holdOverlayFrames = 8) {
  await clickNext(page);
  await sleep(300);
  // Check if an act card overlay appeared
  await captureAndDismissOverlay(page, holdOverlayFrames);
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

  // -- Welcome Splash -- capture it, then click Start Demo --
  console.log('Welcome splash...');
  await capture(page, 6); // Show splash for ~1.5s

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

  // -- Act 1 card overlay should appear after clicking Start Demo --
  console.log('Act 1 card: Gmail Triage...');
  await captureAndDismissOverlay(page, 8); // Show "Act 1: Gmail Triage" for ~2s
  await sleep(300);

  // -- Act 1: Gmail (steps 0-2) --
  console.log('Act 1: Gmail triage steps...');
  await capture(page, 4); // Step 0 -- Gmail inbox

  await advanceStep(page); // Step 1
  await sleep(200);
  await capture(page, 3);

  await advanceStep(page); // Step 2
  await sleep(200);
  await capture(page, 3);

  // -- Act 2: Slack (steps 3-6) --
  // Stepping from step 2 -> step 3 triggers Act 2 card
  console.log('Act 2: Slack customer service...');
  await advanceStep(page, 8); // Step 3 -- Act 2 card captured + dismissed
  await sleep(300);
  await capture(page, 3); // list_channels

  await advanceStep(page); // Step 4 -- get_channel_history
  await sleep(300);
  await capture(page, 4); // Hold longer -- shows Dave's messages

  await advanceStep(page); // Step 5 -- post_message
  await sleep(200);
  await capture(page, 3);

  await advanceStep(page); // Step 6 -- post_message engineering
  await sleep(200);
  await capture(page, 3);

  // -- Act 3: Phishing (steps 7-11) --
  // Stepping from step 6 -> step 7 triggers Act 3 card (the scary one)
  console.log('Act 3: Phishing attack...');
  await advanceStep(page, 10); // Step 7 -- Act 3 card captured for ~2.5s (dramatic!)
  await sleep(300);
  await capture(page, 4); // list_messages (phishing arrives)

  await advanceStep(page); // Step 8 -- read_email
  await sleep(300);
  await capture(page, 5); // Hold -- user reads the phishing email

  await advanceStep(page); // Step 9 -- post_message general
  await sleep(200);
  await capture(page, 3);

  await advanceStep(page); // Step 10 -- send_email PII leak
  await sleep(300);
  await capture(page, 6); // Hold long -- CRITICAL moment

  await advanceStep(page); // Step 11 -- send_email salary data
  await sleep(300);
  await capture(page, 6); // Hold long -- another CRITICAL

  // -- Act 4: Unauthorized refund (steps 12-14) --
  // Stepping from step 11 -> step 12 triggers Act 4 card
  console.log('Act 4: Unauthorized refund...');
  await advanceStep(page, 8); // Step 12 -- Act 4 card captured + dismissed
  await sleep(300);
  await capture(page, 4); // create_charge

  await advanceStep(page); // Step 13 -- create_refund
  await sleep(300);
  await capture(page, 6); // Hold long -- big refund

  await advanceStep(page); // Step 14 -- end
  await sleep(200);
  await capture(page, 3);

  // -- Shadow Report --
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
  await capture(page, 8); // Hold long on the report -- money shot

  console.log(`Captured ${frameNum} frames`);
  await browser.close();

  // -- Stitch frames into GIF with ffmpeg --
  console.log('Creating GIF with ffmpeg...');
  // 4 fps -- each "hold frame" = 250ms. So holdFrames=8 = 2 second pause
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
