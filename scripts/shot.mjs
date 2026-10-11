/**
 * Visual QA harness — renders a page of the running dev server in headless
 * Chrome (GPU via ANGLE/D3D11) and saves a PNG.
 *
 *   node scripts/shot.mjs /dev/scene/farm?intro=0 out.png --w 1440 --h 900 --wait 9000
 *   node scripts/shot.mjs / home.png --mobile --full
 *
 * Prints console errors and (for /dev/scene pages) renderer stats.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const args = process.argv.slice(2);
let path = args[0] ?? '/';
// Git Bash (MSYS) rewrites "/foo" into "C:/Program Files/Git/foo" — undo that.
const msys = path.match(/^[A-Za-z]:[\\/].*?[\\/]Git([\\/].*)?$/);
if (msys) path = (msys[1] ?? '/').replace(/\\/g, '/');
if (!path.startsWith('/')) path = `/${path}`;
const out = args[1] ?? 'shot.png';
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);
const base = opt('base', 'http://localhost:5173');
const mobile = flag('mobile');
const width = Number(opt('w', mobile ? 390 : 1440));
const height = Number(opt('h', mobile ? 844 : 900));
const wait = Number(opt('wait', 6000));
const scrollTo = opt('scroll', null);
const clickSel = opt('click', null);

const candidates = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];
const executablePath = candidates.find((p) => fs.existsSync(p));

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars', '--no-first-run'],
  defaultViewport: { width, height, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile },
});

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`.slice(0, 400));
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`.slice(0, 400)));
  await page.goto(base + path, { waitUntil: 'networkidle2', timeout: 90000 });
  if (path.includes('/dev/scene')) {
    await page.waitForSelector('#scene-ready', { timeout: 90000 }).catch(() => errors.push('[shot] scene-ready timeout'));
  }
  if (clickSel) {
    await page.click(clickSel).catch((e) => errors.push(`[shot] click failed ${e.message}`));
  }
  if (scrollTo) {
    await page.evaluate((y) => window.scrollTo(0, Number(y)), scrollTo);
  }
  await new Promise((r) => setTimeout(r, wait));
  const pages = Number(opt('pages', 0));
  if (pages > 0) {
    // Scroll through the page one viewport at a time so in-view animations trigger
    const step = Number(opt('step', height * 0.92));
    for (let k = 0; k < pages; k++) {
      await page.evaluate((y) => window.scrollTo(0, y), k * step);
      await new Promise((r) => setTimeout(r, Number(opt('pagewait', 1400))));
      await page.screenshot({ path: out.replace(/\.png$/, `-${k + 1}.png`) });
    }
  } else {
    await page.screenshot({ path: out, fullPage: flag('full') });
  }
  const stats = await page.evaluate(() => document.getElementById('r3f-debug')?.textContent ?? null);
  console.log(JSON.stringify({ out, stats: stats ? JSON.parse(stats) : null, errors: errors.filter((e) => !e.includes('React Router Future')).slice(0, 15) }, null, 1));
} finally {
  await browser.close();
}
