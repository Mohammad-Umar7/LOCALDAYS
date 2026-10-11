/**
 * Screenshots host-dashboard sections for several demo hosts.
 *   node scripts/host-shots.mjs out-dir wadi-hives:studio fakhar-house:studio ...
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2] ?? '.';
const jobs = process.argv.slice(3).map((j) => j.split(':'));
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--hide-scrollbars'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
for (const [provider, section = 'overview', pages = '2'] of jobs) {
  // Switch host through the real UI: open the switcher, pick the provider by name
  await page.goto('http://localhost:5173/host', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(() => document.querySelector('aside button')?.click());
  await new Promise((r) => setTimeout(r, 500));
  const ok = await page.evaluate((name) => {
    const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent?.toLowerCase().includes(name.toLowerCase()));
    b?.click();
    return !!b;
  }, provider.replace(/-/g, ' '));
  if (!ok) errors.push(`provider not found: ${provider}`);
  await new Promise((r) => setTimeout(r, 600));
  await page.goto(`http://localhost:5173/host${section === 'overview' ? '' : `/${section}`}`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2500));
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let i = 0; i < Number(pages); i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * 780);
    await new Promise((r) => setTimeout(r, 900));
    const file = path.join(outDir, `host-${provider}-${section}-${i + 1}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file, 'height', h);
    if ((i + 1) * 780 > h) break;
  }
}
console.log('errors', errors.slice(0, 6));
await browser.close();
