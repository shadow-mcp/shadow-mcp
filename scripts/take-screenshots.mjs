#!/usr/bin/env node

/**
 * Take clean screenshots of the Shadow Console at key demo moments.
 * Requires: Chrome installed, demo running on localhost:3000/3002
 */

import puppeteer from 'puppeteer-core';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'docs', 'screenshots');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CONSOLE_URL = 'http://localhost:3000/?ws=ws://localhost:3002';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--window-size=1400,900', '--no-sandbox'],
    defaultViewport: { width: 1400, height: 900 },
  });

  const page = await browser.newPage();

  // Navigate to console
  console.log('Loading Shadow Console...');
  await page.goto(CONSOLE_URL, { waitUntil: 'networkidle0', timeout: 15000 });
  await sleep(3000); // Let WS connect and events replay

  // Dismiss welcome splash if present
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

  // Dismiss any act card overlay
  try {
    const overlay = await page.$('.z-40');
    if (overlay) {
      await overlay.click();
      await sleep(500);
    }
  } catch {}

  // Helper: click next button N times
  async function stepTo(n) {
    // Find current step from the narration bar
    for (let i = 0; i < n; i++) {
      // Click the next (▶) button
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent?.trim(), btn);
        if (text === '\u25B6') {
          await btn.click();
          await sleep(300);
          // Dismiss act card if it appears
          try {
            const overlay = await page.$('.z-40');
            if (overlay) {
              await overlay.click();
              await sleep(300);
            }
          } catch {}
          break;
        }
      }
    }
    await sleep(500);
  }

  // Screenshot 1: Gmail inbox — Act 1 (step 1, list_messages)
  console.log('Screenshot 1: Gmail inbox (Act 1)...');
  await page.screenshot({ path: resolve(outDir, 'console-gmail.png'), type: 'png' });

  // Step to Act 2 — Slack with Dave's messages (step 5, get_channel_history)
  console.log('Screenshot 2: Slack world (Act 2)...');
  await stepTo(4); // Move from step 1 to step 5
  await sleep(500);
  await page.screenshot({ path: resolve(outDir, 'console-slack.png'), type: 'png' });

  // Step to Act 3 — Phishing attack, agent sending PII (step 11)
  console.log('Screenshot 3: Phishing attack (Act 3)...');
  await stepTo(6); // Move from step 5 to step 11
  await sleep(500);
  await page.screenshot({ path: resolve(outDir, 'console-phishing.png'), type: 'png' });

  // Screenshot 4: Shadow Report
  console.log('Screenshot 4: Shadow Report...');
  // Step to the end first so trust score is fully calculated
  await stepTo(4); // Move to step 15
  await sleep(500);
  // Click Shadow Report tab
  const tabs = await page.$$('button');
  for (const tab of tabs) {
    const text = await page.evaluate(el => el.textContent?.trim(), tab);
    if (text === 'Shadow Report') {
      await tab.click();
      await sleep(800);
      break;
    }
  }
  await page.screenshot({ path: resolve(outDir, 'console-report.png'), type: 'png' });

  console.log(`\nScreenshots saved to: ${outDir}/`);
  console.log('  console-gmail.png');
  console.log('  console-slack.png');
  console.log('  console-phishing.png');
  console.log('  console-report.png');

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
