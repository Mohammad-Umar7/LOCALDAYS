/** Time from scrolling a provider's 3D section into view until its loading veil is gone.
 *   node scripts/scene-timing.mjs [base] slug...  */
import puppeteer from 'puppeteer-core';
const args = process.argv.slice(2);
const base = args[0]?.startsWith('http') ? args.shift() : 'http://localhost:5173';
const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1440, height: 900 } });
for (const slug of args) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/p/${slug}`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => document.getElementById('explore-3d')?.scrollIntoView({ block: 'start' }));
  const t0 = Date.now();
  let ms = -1;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 250));
    const veil = await page.evaluate(() => [...document.querySelectorAll('[data-viewer] div')].some((d) => d.textContent?.startsWith('Building an interactive 3D preview')));
    if (!veil) { ms = Date.now() - t0; break; }
  }
  console.log(slug.padEnd(28), ms < 0 ? 'TIMEOUT' : `${(ms / 1000).toFixed(1)} s`, errors.length ? errors.slice(0, 2) : '');
  await page.close();
}
await browser.close();
