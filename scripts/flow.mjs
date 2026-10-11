/**
 * End-to-end demo journey (the pitch story), driven in headless Chrome.
 *   node scripts/flow.mjs <outDir> [--mobile]
 * Visit → book Family Farm Day → pay → host check-in → stamp → subscribe →
 * time travel → farmer dashboard → Harvest & Demand AI actions.
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const out = process.argv[2] ?? '.';
const mobile = process.argv.includes('--mobile');
const base = 'http://localhost:5173';
fs.mkdirSync(out, { recursive: true });
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
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const shot = async (name) => {
  n++;
  await page.screenshot({ path: `${out}/${String(n).padStart(2, '0')}-${name}.png` });
  console.log('shot', name, page.url().replace(base, ''));
};
/** Click the first visible element whose text includes `text`. */
const click = async (text, selector = 'button, a') => {
  const ok = await page.evaluate(
    (t, sel) => {
      const els = [...document.querySelectorAll(sel)].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (e.textContent ?? '').replace(/\s+/g, ' ').includes(t) && !e.disabled;
      });
      const el = els[els.length > 1 ? els.length - 1 : 0];
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    },
    text,
    selector,
  );
  if (!ok) throw new Error(`Could not click "${text}" on ${page.url()}`);
  await sleep(700);
};
const clickFirst = async (text, selector = 'button, a') => {
  const ok = await page.evaluate(
    (t, sel) => {
      const el = [...document.querySelectorAll(sel)].find((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (e.textContent ?? '').replace(/\s+/g, ' ').includes(t) && !e.disabled;
      });
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    },
    text,
    selector,
  );
  if (!ok) throw new Error(`Could not click "${text}" on ${page.url()}`);
  await sleep(700);
};

try {
  await page.goto(base + '/', { waitUntil: 'networkidle2' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + '/book/ghaf-family', { waitUntil: 'networkidle2' });
  await sleep(1200);
  await shot('book-date');
  await clickFirst('Continue');
  await shot('book-guests');
  await clickFirst('Continue');
  await shot('book-review');
  await clickFirst(mobile ? 'Hold & checkout' : 'Hold spots & check out');
  await sleep(1200);
  await shot('checkout');
  await clickFirst('Pay AED');
  await sleep(3500);
  await shot('confirmation');

  await page.goto(base + '/me', { waitUntil: 'networkidle2' });
  await sleep(1000);
  await clickFirst('Check in at the venue');
  await clickFirst('Fill demo code');
  await clickFirst('Verify & complete visit');
  await sleep(1800);
  await shot('stamp-earned');
  await click('Shop from'); // the modal button (last in DOM)
  await sleep(1800);
  await shot('storefront');
  await clickFirst('Subscribe', 'button');
  await sleep(900);
  await shot('cart');
  await clickFirst('Checkout', 'button');
  await sleep(1200);
  await clickFirst('Pay AED');
  await sleep(3500);
  await shot('subscription-confirmed');

  await page.goto(base + '/', { waitUntil: 'networkidle2' });
  await sleep(800);
  await page.evaluate(() => document.querySelector('[aria-label="Demo console"]')?.click());
  await sleep(700);
  await clickFirst('+4 weeks');
  await sleep(900);
  await shot('time-travel');

  await page.goto(base + '/host/commerce', { waitUntil: 'networkidle2' });
  await sleep(1200);
  await clickFirst('Subscribers', 'button');
  await shot('host-subscribers');
  await page.goto(base + '/host', { waitUntil: 'networkidle2' });
  await sleep(1500);
  await shot('host-overview');
  await page.goto(base + '/host/intelligence', { waitUntil: 'networkidle2' });
  await sleep(3000);
  await shot('harvest-before');
  await clickFirst('Apply', 'button');
  await sleep(800);
  await clickFirst('Apply', 'button');
  await sleep(2500);
  await shot('harvest-after');
} catch (e) {
  console.log('FLOW ERROR:', e.message);
  await shot('error');
} finally {
  console.log(JSON.stringify({ errors: errors.filter((e) => !e.includes('React Router Future')).slice(0, 10) }, null, 1));
  await browser.close();
}
