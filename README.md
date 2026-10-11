# Fadhal (فضل): *Don’t Just Visit. Live It.*

Experience-driven local commerce for Sharjah. Guests discover and book five living traditions (farms, beekeeping, pottery, coastal life, and oud & fragrance), step inside each venue in interactive 3D, and then **keep buying from the people they met**: produce boxes, honey by batch, commissioned ceramics and their own saved fragrance formula.

> Demo build for the Sharjah Tourism Innovation Hackathon. All hosts, prices, reviews and metrics are fictional and clearly labelled. 3D venues are illustrative previews. Payments are simulated. No API keys, no backend, no internet needed: everything runs in the browser.

---

## Run it

Requires Node 18+.

```bash
npm install
npm run dev          # http://localhost:5173
```

For the live pitch, use the production build. Downloads are smaller, and the 3D engine only loads on pages that show a venue:

```bash
npm run demo         # builds, then serves http://localhost:4173
```

Demo state (bookings, orders, stamps, subscriptions) is saved in the browser. **Demo → Reset demo data** in the navbar restores the starting point.

## Deploy

The repo is ready for [Vercel](https://vercel.com): import it and the settings in `vercel.json` take over (Vite framework, `npm run build`, output in `dist`).

- Deep links such as `/p/ghaf-grove-farmstay` are client-side routes, so every path that isn't a built file is rewritten to `index.html`.
- Hashed files under `/assets/` are served with a one-year immutable cache.

Any other static host works too, as long as it falls back to `index.html` for unknown paths.

## The 5-minute pitch route

Open **Demo** in the navbar (flask icon on phones). It holds a guided route, time travel and a host check-in shortcut.

| # | Where | What to show |
|---|---|---|
| 1 | `/` | Five traditions, one promise. The Day Composer preview is computed live. |
| 2 | `/c/farm` | Live availability, open dates, stays / dining / harvesting at a glance. |
| 3 | `/p/ghaf-grove-farmstay` | The page opens straight onto the farm in 3D, with no loading screen. Orbit it, then pick a place from the list or the chip row to fly there and open the host’s own records: photos, capacity, prices, open dates. |
| 4 | `/book/ghaf-family` | Family Farm Day, AED 450: date → guests & add-ons → review → pay (simulated). |
| 5 | `/me` | Demo console → *Host check-in* completes the visit → **Farm Explorer** stamp. |
| 6 | `/p/ghaf-grove-farmstay/shop` | Subscribe to the AED 120 weekly box. Demo console → **+4 weeks** fulfils deliveries. |
| 7 | `/host` | The farmer’s view: bookings, stays, tourism vs produce revenue, subscribers, net earnings, prepaid obligations. |
| 8 | `/host/intelligence` | **Harvest & Demand Intelligence**: 30 kg tomato forecast vs ≈35 kg committed → ≈5 kg short → verified supplier or farmer-approved menu swap. Apply both and watch the gap close. |
| 9 | `/impact` | Visit → Experience → Purchase → Subscribe → Repeat: AED 450 + 4 × AED 120 = AED 930, and the four revenue streams. |

Also worth a minute:

- `/compose`: describe a day in plain English (*“Romantic evening: make a perfume then dinner”*, *“we have no car, something in the city with kids”*). The mic button uses the browser’s own speech recognition where available. Click any planned stop to open that host’s venue page.
- `/p/oud-lane-atelier#blend-studio`: tune a maker-approved formula within its allowed ranges and watch it fill a 3D crystal bottle, then book the workshop to make it.
- `/me/blends`: the saved Signature Blend, reorderable in three sizes or as a gift.
- `/host/bookings`: other (fictional) guests are already booked. Tap a demo check-in code to verify a visit and issue their stamp.
- Guest checkout: sign out from the account menu, book anything, then turn the booking into an account from the confirmation page.

## How the brief maps to the product

- **Five categories, 15 fictional providers** (`src/data/catalog/*`). Everything (cards, pages, hotspots, shops, dashboards) is driven by these records, so verified operators can replace them without code changes.
- **Interactive 3D venues**: React Three Fiber, procedural PBR materials, instancing, post-processing, adaptive quality, and shader programs compiled in parallel before the first frame (each venue opens in under two seconds). `src/three/scenes/{farm,apiary,pottery,harbour,atelier}`. Hotspots and their panels (photos, prices, live open dates) read from provider records.
- **Venue pages lead with 3D**: every venue page opens on the 3D explorer under a compact title, filling the first screen. The scene has no pins or labels; places are picked from the list beside the viewer (below it on phones) or the chip row, and the camera flies there. The chip row scrolls sideways with the mouse wheel or arrow buttons and follows the active place. The photo gallery follows in the page body as *A look around*. `src/pages/Provider.tsx`, `src/components/three/ExperienceViewer.tsx`.
- **Instant venues**: the camera opens on one of two fixed poses (wide for viewers at 1.2:1 and above, tall below). A still of each venue at each pose lives in `public/posters/` (30 WebP files), so the venue appears straight away, even before the 3D code downloads, and fades into the live scene once it is ready. `src/components/three/VenuePoster.tsx`.
- **Booking engine**: deterministic availability, 10-minute holds, VAT-inclusive AED pricing, guest checkout or account, booking references, `.ics` export. `src/services/availability.ts`, `pricing.ts`, `src/store/app.ts`.
- **After the visit**: per-host storefronts, subscriptions with capacity caps, reorder-by-batch honey, pottery commissions with kiln stages, Signature Blends limited to the maker’s approved formulas.
- **Fadhal Passport**: stamps only for host-verified check-ins; challenges and rewards with a named funder and a hard cap. No XP, no leaderboard.
- **Business model**: 12% experience commission, 10% product commission, optional AED 199/month Pro plan, and capped prepaid experiences (customer-funded, refundable, tracked as obligations, never as profit). All rates live in `src/config/economics.ts`.
- **AI, without a chatbot**: *Fadhal Intelligence* runs on-device.
  - **Day Composer** parses a request into explicit constraints and plans over live slots, drive times, midday heat and budget, explaining every choice.
  - **Harvest & Demand Intelligence** uses deterministic inventory maths; language is used only to explain and recommend. No invented accuracy figures.

## Brand

The logo (an arch emblem beside the bilingual فضل / FADHAL wordmark, in olive, terracotta and sand) appears across the app:

- **Navbar**: reversed over the home hero, green ink on the cream bar.
- **Footer**: the reversed logo, which already carries the Arabic name.
- **Sign-in modal and passport identity page**: the emblem. The passport cover carries it as a brass foil stamp.
- **Confirmation email preview, favicon, home-screen and PWA icons**: the emblem on a paper tile.

The master artwork lives in `src/assets/brand/source/fadhal-logo.jpg`. Running `python scripts/brand-assets.py` (needs Pillow, numpy and scipy) rebuilds the transparent cut-outs in `src/assets/brand/` and the favicon and app icons in `public/`.

## Configuration

- Product name, Arabic name and tagline: `src/config/brand.ts`
- Commission, Pro price, VAT, hold time, presale guard-rails: `src/config/economics.ts`
- Logo components (`<Logo>`, `<LogoMark>`, `<LogoIcon>`): `src/components/brand/Logo.tsx`
- Hosting (rewrites, cache headers): `vercel.json`

## Tech

Vite · React 18 · TypeScript · Tailwind · Zustand · Framer Motion · Three.js / React Three Fiber / drei / postprocessing · d3-shape. Photography is free-licence Unsplash, saved in `public/photos/` so the app works offline, and labelled as illustrative.

## QA scripts

Headless-Chrome checks used during development (run with the dev server on :5173; they use your installed Chrome):

| Script | What it checks |
|---|---|
| `node scripts/flow.mjs <outDir>` | The full pitch journey end to end, with screenshots and console errors |
| `node scripts/guest-flow.mjs <outDir> [--mobile]` | Guest checkout of a licensed boat trip, then converting the guest into an account |
| `node scripts/overflow.mjs <path>` | Horizontal overflow at 390 px (phone) |
| `node scripts/hotspots.mjs <provider-slug> <outDir> [--mobile]` | Opens every 3D hotspot and screenshots its panel |
| `node scripts/scene-timing.mjs [baseUrl] <slug>…` | Time until each 3D venue is interactive |
| `node scripts/composer-test.mjs ["prompt"…]` | Runs plain-English prompts through the Day Composer |
| `node scripts/download-photos.mjs [--force]` | Saves every photo in `src/data/photos.ts` to `public/photos/` (run it after adding photos) |
| `node scripts/render-posters.mjs [providerId…]` | Re-renders the opening stills in `public/posters/` (all 15 hosts, or the ones named) |
| `node scripts/shot.mjs <path> <out.png> [--mobile] [--pages N]` | Screenshot any route (prints 3D renderer stats on `/dev/scene/*`) |
