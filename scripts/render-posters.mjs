/**
 * Renders the venue posters shown while each 3D scene builds (public/posters/<provider>-<framing>.webp).
 * Each still uses the exact pose the live viewer opens on:
 *   wide — aspect 2.4, for viewers at least 1.2 wide (desktop); rendered at high quality
 *   tall — aspect 1.2, for narrower viewers (phones); rendered at medium quality, like phones
 * Posters are wider than the boxes they fill, so object-fit: cover is an exact centre crop.
 *
 *   node scripts/render-posters.mjs [providerId ...]      (dev server on :5173)
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const PROVIDERS = {
  'ghaf-grove': 'farm', 'sidr-valley': 'farm', 'rimal-dates': 'farm',
  'wadi-hives': 'apiary', 'golden-samar': 'apiary', 'dhaid-bee-garden': 'apiary',
  'fakhar-house': 'pottery', 'kf-clay': 'pottery', 'kalba-earth': 'pottery',
  'hamriyah-harbour': 'harbour', 'kalba-coast': 'harbour', 'dibba-sea-line': 'harbour',
  'oud-lane': 'atelier', 'mabkhara-house': 'atelier', 'saffron-smoke': 'atelier',
};
const FRAMINGS = [
  { framing: 'wide', width: 2400, height: 1000, quality: 'high' },
  { framing: 'tall', width: 1200, height: 1000, quality: 'medium' },
];
const only = process.argv.slice(2);
const outDir = path.join(process.cwd(), 'public', 'posters');
fs.mkdirSync(outDir, { recursive: true });

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [provider, scene] of Object.entries(PROVIDERS)) {
  if (only.length && !only.includes(provider)) continue;
  for (const f of FRAMINGS) {
    const page = await browser.newPage();
    await page.setViewport({ width: f.width, height: f.height, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const q = new URLSearchParams({ provider, framing: f.framing, quality: f.quality, intro: '0', rotate: '0', pins: '0', ui: '0' });
    await page.goto(`http://localhost:5173/dev/scene/${scene}?${q}`, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForSelector('#scene-ready', { timeout: 120000 });
    await sleep(3000); // let water, foliage and lights settle
    const file = path.join(outDir, `${provider}-${f.framing}.webp`);
    await page.screenshot({ path: file, type: 'webp', quality: f.framing === 'wide' ? 66 : 72 });
    console.log(`${path.basename(file).padEnd(30)} ${Math.round(fs.statSync(file).size / 1024)} KB${errors.length ? '  errors: ' + errors.join(' | ') : ''}`);
    await page.close();
  }
}
await browser.close();
