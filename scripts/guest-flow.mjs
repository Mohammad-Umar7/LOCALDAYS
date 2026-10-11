/**
 * Guest journey: book a licensed boat trip without an account (safety acknowledgement,
 * guest details, simulated card) and land on the confirmation page.
 *   node scripts/guest-flow.mjs <outDir> [--mobile]
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const out = process.argv[2] ?? '.';
const mobile = process.argv.includes('--mobile');
const base = 'http://localhost:5173';
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--hide-scrollbars'],
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
const click = async (text, selector = 'button, a, label') => {
  const ok = await page.evaluate(
    (t, sel) => {
      const els = [...document.querySelectorAll(sel)].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (e.textContent ?? '').replace(/\s+/g, ' ').includes(t) && !e.disabled;
      });
      const el = els[els.length - 1];
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
  await page.goto(base + '/book/hh-sail', { waitUntil: 'networkidle2' });
  await sleep(1500);
  await shot('step1');
  await click('Continue');
  await click('Continue');
  await shot('review');
  // safety acknowledgement checkbox (boat trips)
  const acked = await page.evaluate(() => {
    const cb = [...document.querySelectorAll('input[type=checkbox]')].find((c) => c.closest('label')?.textContent?.includes('licensed'));
    if (cb && !cb.checked) cb.click();
    return !!cb;
  });
  console.log('ack checkbox found:', acked);
  await sleep(400);
  await click(mobile ? 'Hold & checkout' : 'Hold spots & check out');
  await sleep(1200);
  await click('Check out as a guest');
  await sleep(500);
  await page.type('input[placeholder="Full name"]', 'Sam Visitor');
  await page.type('input[type=email]', 'sam@example.com');
  await click('Simulated card payment');
  await shot('checkout-guest');
  await click('Pay AED');
  await sleep(3500);
  await shot('confirmation');
  const head = await page.evaluate(() => document.querySelector('h1')?.textContent);
  console.log('confirmation h1:', head);
  // Guest converts to an account from the confirmation page
  await click('Create my Passport');
  await sleep(600);
  const pre = await page.evaluate(() => [...document.querySelectorAll('[role=dialog] input')].map((i) => i.value));
  console.log('prefilled:', pre);
  await click('Email me a sign-in link');
  await click('Open the magic link');
  await sleep(800);
  await page.goto(base + '/me', { waitUntil: 'networkidle2' });
  await sleep(1500);
  await shot('account-after-signup');
  const trip = await page.evaluate(() => document.body.innerText.includes('Sunset on a Dhow'));
  console.log('trip visible in My LocalDays:', trip);
} catch (e) {
  console.log('FAILED:', e.message);
  await shot('failure');
}
console.log(JSON.stringify({ errors }, null, 1));
await browser.close();
