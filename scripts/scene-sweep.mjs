/**
 * Visual sweep of every 3D venue: the home view plus every hotspot camera, each captured
 * twice ~1.2 s apart so animation glitches (clipping, popping, sliding) show up.
 *
 *   node scripts/scene-sweep.mjs <outDir> [scene:provider ...] [--variant golden] [--pins]
 *
 * Defaults to all five venues with their flagship providers plus the date estate (tents).
 * Writes <scene>-<provider>-<hotspot>-a.png / -b.png and prints renderer stats per venue.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const outDir = args[0] ?? '.';
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const variant = opt('variant', null);
const pins = args.includes('--pins');
const jobs = args.slice(1).filter((a) => a.includes(':') && !a.startsWith('--'));
const DEFAULT = ['farm:ghaf-grove', 'farm:rimal-dates', 'apiary:wadi-hives', 'pottery:fakhar-house', 'harbour:hamriyah-harbour', 'atelier:oud-lane'];
fs.mkdirSync(outDir, { recursive: true });

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({
  executablePath: exe,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--hide-scrollbars'],
  defaultViewport: { width: 1440, height: 900 },
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const job of jobs.length ? jobs : DEFAULT) {
  const [scene, provider] = job.split(':');
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text().slice(0, 200)));
  const q = new URLSearchParams({ provider, intro: '0', rotate: '0' });
  if (!pins) q.set('pins', '0');
  if (variant) q.set('variant', variant);
  await page.goto(`http://localhost:5173/dev/scene/${scene}?${q}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.waitForSelector('#scene-ready', { timeout: 90000 }).catch(() => errors.push('scene-ready timeout'));
  await sleep(2500);
  // hotspot ids come from the dev page's buttons (provider records), minus variants/home
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '').filter((t) => t && !['golden', 'morning', 'dusk', 'home'].includes(t)),
  );
  const shoot = async (name) => {
    const base = path.join(outDir, `${scene}-${provider}-${name}`);
    await page.screenshot({ path: `${base}-a.png` });
    await sleep(1200);
    await page.screenshot({ path: `${base}-b.png` });
  };
  await shoot('home');
  for (const id of ids) {
    await page.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === t)?.click(), id);
    await sleep(3800);
    await shoot(id);
  }
  const stats = await page.evaluate(() => document.getElementById('r3f-debug')?.textContent ?? '');
  console.log(`${scene}:${provider}`, 'hotspots:', ids.join(', '), '| stats:', stats.slice(0, 120), '| errors:', errors.slice(0, 3));
  await page.close();
}
await browser.close();
