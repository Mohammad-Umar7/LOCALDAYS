/**
 * Opens each 3D hotspot on a provider page and screenshots the details panel.
 *   node scripts/hotspots.mjs ghaf-grove out-dir [--mobile]
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const slug = process.argv[2] ?? 'ghaf-grove';
const outDir = process.argv[3] ?? '.';
const mobile = process.argv.includes('--mobile');
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'],
  defaultViewport: mobile ? { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { width: 1440, height: 900 },
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:5173/p/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise((r) => setTimeout(r, 2500));
// scroll the viewer into view
await page.evaluate(() => document.getElementById('explore-3d')?.scrollIntoView({ block: 'start' }));
await page.waitForSelector('[data-hotspot-chip]', { timeout: 60000 }).catch(() => errors.push('no chips'));
await page.evaluate(() => window.scrollBy(0, -80));
await new Promise((r) => setTimeout(r, 9000));
let labels = [];
for (let t = 0; t < 20 && !labels.length; t++) {
  labels = await page.evaluate(() => [...document.querySelectorAll('[data-hotspot-chip]')].map((b) => b.getAttribute('data-hotspot-chip')));
  if (!labels.length) await new Promise((r) => setTimeout(r, 1000));
}
console.log('chips:', labels);
await page.evaluate(() => document.querySelector('[data-viewer]')?.scrollIntoView({ block: 'center' }));
await new Promise((r) => setTimeout(r, 6000));
await page.screenshot({ path: path.join(outDir, `${slug}-hs-0-home${mobile ? '-m' : ''}.png`) });
if (process.argv.includes('--home-only')) {
  console.log('errors', errors.slice(0, 8));
  await browser.close();
  process.exit(0);
}
let i = 0;
for (const id of labels) {
  await page.click(`[data-hotspot-chip="${id}"]`).catch((e) => errors.push(`click ${id}: ${e.message}`));
  await new Promise((r) => setTimeout(r, 2600));
  const file = path.join(outDir, `${slug}-hs-${++i}-${id}.png`);
  await page.screenshot({ path: file });
  console.log('saved', file);
}
console.log('errors', errors.slice(0, 8));
await browser.close();
