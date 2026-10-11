/**
 * Saves every photo in src/data/photos.ts to public/photos/ so the app runs without internet.
 * Each photo is stored uncropped at two widths (the <img> uses object-fit: cover, so crops happen in CSS):
 *   public/photos/<id>-800.avif      cards and thumbnails
 *   public/photos/<id>-1600.avif    full-width heroes and galleries
 *
 *   node scripts/download-photos.mjs          (skips files that already exist; --force re-downloads)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WIDTHS = [800, 1600];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/photos');
const force = process.argv.includes('--force');

const source = fs.readFileSync(path.join(ROOT, 'src/data/photos.ts'), 'utf8');
const ids = [...new Set([...source.matchAll(/"id":\s*"([^"]+)"/g)].map((m) => m[1]))];
fs.mkdirSync(OUT, { recursive: true });

const jobs = ids.flatMap((id) => WIDTHS.map((w) => ({ id, w, file: path.join(OUT, `${id}-${w}.avif`) })));
const todo = jobs.filter((j) => force || !fs.existsSync(j.file));
console.log(`${ids.length} photos, ${jobs.length} files, ${todo.length} to download`);

let failed = 0;
async function worker() {
  for (let job = todo.shift(); job; job = todo.shift()) {
    const url = `https://images.unsplash.com/${job.id}?fm=avif&w=${job.w}&q=50`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(job.file, Buffer.from(await res.arrayBuffer()));
    } catch (err) {
      failed++;
      console.error(`failed ${job.id} @${job.w}: ${err.message}`);
    }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

const bytes = fs.readdirSync(OUT).reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`done, ${failed} failed, public/photos is ${(bytes / 1e6).toFixed(1)} MB`);
process.exitCode = failed ? 1 : 0;
