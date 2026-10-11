/** Lists elements wider than a 390px viewport — mobile overflow hunting.  node scripts/overflow.mjs /path */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

let path = process.argv[2] ?? '/';
const msys = path.match(/^[A-Za-z]:[\\/].*?[\\/]Git([\\/].*)?$/);
if (msys) path = (msys[1] ?? '/').replace(/\\/g, '/');
if (!path.startsWith('/')) path = `/${path}`;
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu'], defaultViewport: { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
const page = await browser.newPage();
await page.goto('http://localhost:5173' + path, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 3000));
const res = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 && r.width > 0) {
      let p = el.parentElement;
      let clipped = false;
      while (p && p !== document.body && p !== document.documentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX === 'hidden' || cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflow === 'hidden') {
          const pr = p.getBoundingClientRect();
          if (pr.right <= vw + 1) {
            clipped = true;
            break;
          }
        }
        p = p.parentElement;
      }
      if (!clipped) out.push({ tag: el.tagName.toLowerCase(), cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 90), right: Math.round(r.right), w: Math.round(r.width) });
    }
  }
  const inHeader = (o) => false;
  return { scrollWidth: document.documentElement.scrollWidth, vw, offenders: out.filter((o) => !o.cls.includes('fixed inset-x-0') && !o.cls.startsWith('shell flex h-[64px]')).sort((a, b) => b.w - a.w).slice(0, 14) };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
