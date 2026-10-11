/** Runs a batch of natural-language prompts through the Day Composer and prints the plans. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const prompts = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'Romantic evening: make a perfume then dinner',
      'A slow Saturday with my parents — dates, the sea, under AED 800',
      'Family of 4 this weekend, hands-on and morning only',
      'Bees and pottery tomorrow, no boats, budget 600',
      'Group of 8 colleagues next week, heritage and seafood',
      'solo day in Kalba, something with nature',
      'we have no car, something in the city with kids',
    ];
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ executablePath: exe, headless: 'new', defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
for (const q of prompts) {
  await page.goto(`http://localhost:5173/compose?q=${encodeURIComponent(q)}`, { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 3500));
  const res = await page.evaluate(() => {
    const items = [...document.querySelectorAll('ol li')].map((li) => li.textContent?.replace(/\s+/g, ' ').trim().slice(0, 170));
    const chips = [...document.querySelectorAll('section')][0]?.querySelectorAll('button, span');
    const understood = [...(chips ?? [])].map((c) => c.textContent?.trim()).filter((t) => t && t.length < 40).slice(0, 14);
    return { items, understood };
  });
  console.log(`\n## ${q}\n  understood: ${res.understood.join(' | ')}`);
  res.items.forEach((i) => console.log('  - ' + i));
}
await browser.close();
