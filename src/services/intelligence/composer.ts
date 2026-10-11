import type { CategoryId, Experience, PassportStamp, RegionId } from '@/data/types';
import { EXPERIENCES, PROVIDER_BY_ID } from '@/data/catalog';
import { CATEGORY_BY_ID } from '@/data/categories';
import { REGIONS, REGION_BY_ID, driveMinutes } from '@/data/regions';
import { addDaysISO, upcomingWeekend, weekdayOf } from '@/lib/dates';
import { getSlots, type AvailabilityCtx } from '../availability';
import { priceExperience } from '../pricing';

/* ================================================================== */
/*  Day Composer — on-device "intelligence":                           */
/*  1) parse a natural-language request into explicit constraints,    */
/*  2) plan an itinerary over LIVE slots with drive times, heat and   */
/*     budget, 3) explain every choice. It never invents hosts,       */
/*  prices or availability — it only plans with real records.         */
/* ================================================================== */

export type DayPart = 'morning' | 'afternoon' | 'evening';

export interface ComposerIntent {
  raw: string;
  date: string;
  dateLabel: string;
  adults: number;
  children: number;
  seniors: boolean;
  budget: number | null;
  budgetPerPerson: boolean;
  interests: Partial<Record<CategoryId, number>>;
  parts: DayPart[];
  pace: 'relaxed' | 'balanced' | 'packed';
  avoid: CategoryId[];
  avoidBoats: boolean;
  romantic: boolean;
  group: boolean;
  region: RegionId | null;
  noCar: boolean;
  vegetarian: boolean;
  meals: ('breakfast' | 'lunch' | 'dinner')[];
  handsOn: boolean;
  /** "seafood" asked for: favour a coastal meal */
  seafood?: boolean;
  /** true when no interests were given and we spread them evenly */
  interestsInferred?: boolean;
  understood: string[];
}

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, couple: 2 };
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const INTEREST_WORDS: Record<CategoryId, string[]> = {
  farm: ['farm', 'date', 'dates', 'palm', 'harvest', 'vegetable', 'garden', 'organic', 'farm-to-table', 'greenhouse', 'falaj', 'picking', 'grow'],
  honey: ['bee', 'bees', 'honey', 'hive', 'hives', 'apiary', 'sidr', 'beekeeper', 'beekeeping'],
  pottery: ['pottery', 'clay', 'ceramic', 'ceramics', 'wheel', 'mug', 'kiln', 'potter', 'craft', 'crafts', 'make something', 'hands-on'],
  coastal: ['sea', 'fishing', 'fish', 'boat', 'dhow', 'coast', 'coastal', 'harbour', 'harbor', 'net', 'nets', 'mangrove', 'beach', 'sunset sail', 'seafood'],
  fragrance: ['oud', 'bukhoor', 'perfume', 'fragrance', 'scent', 'attar', 'incense', 'smell'],
};

function word(n: string) {
  return NUM[n] ?? (Number.isFinite(Number(n)) ? Number(n) : NaN);
}

export function parseIntent(input: string, todayISO: string, hasCompleted: CategoryId[] = []): ComposerIntent {
  const s = ` ${input.toLowerCase().replace(/[’']/g, "'")} `;
  const understood: string[] = [];

  /* ---------- date ---------- */
  let date = '';
  let dateLabel = '';
  const todayDow = weekdayOf(todayISO);
  if (/\btoday\b|\btonight\b/.test(s)) {
    date = todayISO;
    dateLabel = 'Today';
  } else if (/\btomorrow\b/.test(s)) {
    date = addDaysISO(todayISO, 1);
    dateLabel = 'Tomorrow';
  } else {
    const dm = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/) || s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/);
    if (dm) {
      const dayN = Number(dm[1].match(/\d/) ? dm[1] : dm[2]);
      const mon = MONTHS.indexOf((dm[1].match(/\d/) ? dm[2] : dm[1]).slice(0, 3));
      const y = Number(todayISO.slice(0, 4));
      let d = new Date(y, mon, dayN);
      if (d < new Date(todayISO)) d = new Date(y + 1, mon, dayN);
      date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dateLabel = '';
    } else {
      const dayIdx = DAYS.findIndex((d) => new RegExp(`\\b(${d}|${d.slice(0, 3)})\\b`).test(s));
      if (dayIdx >= 0) {
        let diff = (dayIdx - todayDow + 7) % 7;
        if (/\bnext\b/.test(s) && diff < 7) diff += diff === 0 ? 7 : 0;
        date = addDaysISO(todayISO, diff);
        dateLabel = diff === 0 ? 'Today' : DAYS[dayIdx][0].toUpperCase() + DAYS[dayIdx].slice(1);
      } else if (/\bweekend\b/.test(s)) {
        const w = upcomingWeekend(todayISO);
        // Saturday is the classic family day out
        date = weekdayOf(w.start) === 5 && w.start !== todayISO ? addDaysISO(w.start, 1) : w.start;
        dateLabel = 'This weekend';
      } else if (/\bnext week\b/.test(s)) {
        date = addDaysISO(todayISO, ((6 - todayDow + 7) % 7) + 7);
        dateLabel = 'Next week';
      }
    }
  }
  if (!date) {
    const w = upcomingWeekend(todayISO);
    date = weekdayOf(w.start) === 5 && w.start !== todayISO ? addDaysISO(w.start, 1) : w.start;
    dateLabel = '';
  } else understood.push('date');

  /* ---------- party ---------- */
  let adults = 2;
  let children = 0;
  let seniors = false;
  let group = false;
  let romantic = false;
  const famOf = s.match(/family of (\w+)/);
  const kids = s.match(/(\w+)\s+(kids|children|child|boys|girls|little ones|toddlers)/);
  const ofUs = s.match(/(\w+)\s+of us/) || s.match(/for (\w+)(?: people| adults| guests)?\b/) || s.match(/(\w+)\s+(people|adults|guests|friends|colleagues)/);
  if (famOf && word(famOf[1])) {
    const n = word(famOf[1]);
    adults = 2;
    children = Math.max(0, n - 2);
    understood.push('party');
  }
  if (kids && word(kids[1])) {
    children = word(kids[1]);
    understood.push('party');
  } else if (/\b(kid|kids|children|son|daughter|toddler|little ones)\b/.test(s) && children === 0) {
    children = /\bson\b.*\bdaughter\b|\bdaughter\b.*\bson\b|\bkids\b|\bchildren\b/.test(s) ? 2 : 1;
    understood.push('party');
  }
  if (ofUs && word(ofUs[1]) && !famOf) {
    const n = word(ofUs[1]);
    if (n > 0 && n < 30) {
      adults = Math.max(1, n - children);
      understood.push('party');
    }
  }
  if (/\b(solo|alone|just me|by myself)\b/.test(s)) {
    adults = 1;
    understood.push('party');
  }
  if (/\b(my wife|my husband|my partner|couple|anniversary|romantic|date night|honeymoon)\b/.test(s)) {
    romantic = /\b(romantic|anniversary|date night|honeymoon)\b/.test(s);
    if (!ofUs && !famOf) adults = Math.max(2, adults);
    understood.push('party');
  }
  if (/\b(my parents|grandparents|my mum|my mom|my dad|elderly)\b/.test(s)) {
    seniors = true;
    if (/\bmy parents\b|\bgrandparents\b/.test(s) && !ofUs) adults = adults + 2 - (/\bwith my parents\b/.test(s) ? 1 : 0);
    understood.push('party');
  }
  if (/\b(group|team|colleagues|friends)\b/.test(s)) {
    group = true;
    if (adults < 4 && !ofUs) adults = 6;
  }

  /* ---------- budget ---------- */
  let budget: number | null = null;
  let budgetPerPerson = false;
  const bm = s.match(/(?:under|below|less than|max|maximum|budget(?: of)?|up to|within)\s*(?:aed|dhs|dirhams?)?\s*([\d,]{2,6})/) || s.match(/(?:aed|dhs)\s*([\d,]{2,6})/) || s.match(/([\d,]{3,6})\s*(?:aed|dhs|dirhams?)/);
  if (bm) {
    budget = Number(bm[1].replace(/,/g, ''));
    budgetPerPerson = /per (person|head|guest)|each\b/.test(s);
    understood.push('budget');
  } else if (/\b(cheap|affordable|budget|low cost|inexpensive)\b/.test(s)) {
    budget = 120 * (adults + children);
    budgetPerPerson = false;
    understood.push('budget');
  }

  /* ---------- interests ---------- */
  const interests: Partial<Record<CategoryId, number>> = {};
  // "no boats", "without the bees" must not count as interest in boats or bees
  const positive = s.replace(/\b(no|not|avoid|without|hate|allergic to|afraid of|scared of)\s+(the\s+|a\s+|any\s+)?[a-z-]+/g, ' ');
  (Object.keys(INTEREST_WORDS) as CategoryId[]).forEach((c) => {
    const hits = INTEREST_WORDS[c].filter((w) => positive.includes(` ${w}`) || positive.includes(`${w} `) || positive.includes(`${w},`)).length;
    if (hits) interests[c] = Math.min(3, hits);
  });
  const seafood = /\bseafood\b/.test(positive);
  if (/\b(food|foodie|farm-to-table)\b/.test(s)) interests.farm = (interests.farm ?? 0) + 1;
  const meals: ComposerIntent['meals'] = [];
  if (/\bbreakfast\b/.test(s)) meals.push('breakfast');
  if (/\blunch\b/.test(s)) meals.push('lunch');
  if (/\b(dinner|supper)\b/.test(s)) meals.push('dinner');
  if (meals.length) understood.push('meals');
  const handsOn = /\b(make|making|hands-on|hands on|create|craft|build|learn to)\b/.test(s);
  if (/\b(heritage|traditional|culture|history)\b/.test(s)) {
    interests.coastal = (interests.coastal ?? 0) + 0.5;
    interests.fragrance = (interests.fragrance ?? 0) + 0.5;
  }
  if (/\b(nature|outdoors|outdoor)\b/.test(s)) {
    interests.farm = (interests.farm ?? 0) + 0.5;
    interests.honey = (interests.honey ?? 0) + 0.5;
  }
  if (Object.keys(interests).length) understood.push('interests');

  /* ---------- avoid ---------- */
  const avoid: CategoryId[] = [];
  if (/\b(no|not|avoid|without|allergic to|afraid of|scared of)\s+(the\s+)?(bee|bees|honey)/.test(s)) avoid.push('honey');
  if (/\b(no|not|avoid|without)\s+(the\s+)?(pottery|clay)/.test(s)) avoid.push('pottery');
  if (/\b(no|not|avoid|without|hate)\s+(the\s+)?(perfume|fragrance|smoke|incense|oud)/.test(s)) avoid.push('fragrance');
  if (/\b(no|not|avoid|without)\s+(the\s+)?(farm|farms)/.test(s)) avoid.push('farm');
  const avoidBoats = /\b(no|not|avoid|without)\s+(a\s+|the\s+)?(boat|boats|sea|sailing)|seasick/.test(s);
  avoid.forEach((c) => delete interests[c]);
  if (avoid.length || avoidBoats) understood.push('avoid');

  /* ---------- time of day & pace ---------- */
  const parts: DayPart[] = [];
  if (/\bmorning\b|\bsunrise\b|\bearly\b/.test(s)) parts.push('morning');
  if (/\bafternoon\b|\bmidday\b|\blunch\b/.test(s)) parts.push('afternoon');
  if (/\bevening\b|\bsunset\b|\bdinner\b|\bnight\b/.test(s)) parts.push('evening');
  if (/\bmorning only\b|\bjust the morning\b/.test(s)) parts.splice(0, parts.length, 'morning');
  if (parts.length) understood.push('time');
  const pace: ComposerIntent['pace'] = /\b(slow|relaxed|easy|chill|lazy|gentle)\b/.test(s) ? 'relaxed' : /\b(packed|busy|full day|as much as|everything)\b/.test(s) ? 'packed' : 'balanced';
  if (pace !== 'balanced') understood.push('pace');

  /* ---------- region ---------- */
  let region: RegionId | null = null;
  for (const r of REGIONS) if (s.includes(r.name.toLowerCase())) region = r.id;
  if (!region && /\beast coast\b/.test(s)) region = 'khor-fakkan';
  if (!region && /\b(city|downtown|heart of sharjah|old town)\b/.test(s)) region = 'sharjah-city';
  if (region) understood.push('region');
  const noCar = /\b(no car|don't have a car|without a car|taxi|public transport)\b/.test(s);
  const vegetarian = /\b(vegetarian|vegan|plant-based)\b/.test(s);

  // Encourage new stamps gently if no interests were given
  const interestsInferred = !Object.keys(interests).length;
  if (interestsInferred) {
    (Object.keys(INTEREST_WORDS) as CategoryId[]).forEach((c) => {
      if (!avoid.includes(c)) interests[c] = hasCompleted.includes(c) ? 0.6 : 1;
    });
  }

  return {
    raw: input,
    date,
    dateLabel,
    adults: Math.max(1, adults),
    children: Math.max(0, children),
    seniors,
    budget,
    budgetPerPerson,
    interests,
    parts,
    pace,
    avoid,
    avoidBoats,
    romantic,
    group,
    region,
    noCar,
    vegetarian,
    meals,
    handsOn,
    seafood,
    interestsInferred,
    understood: [...new Set(understood)],
  };
}

/* ============================== Planning ============================== */

export interface PlanStop {
  experience: Experience;
  time: string;
  end: string;
  price: number;
  driveMins: number;
  fromRegion?: RegionId;
  reasons: string[];
  score: number;
}

export interface DayPlan {
  intent: ComposerIntent;
  stops: PlanStop[];
  total: number;
  withinBudget: boolean;
  regions: RegionId[];
  newStamps: CategoryId[];
  notes: string[];
  stats: { experiences: number; slots: number; eligible: number; routes: number };
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function partOf(t: string): DayPart {
  const m = toMin(t);
  return m < 12 * 60 ? 'morning' : m < 16 * 60 + 30 ? 'afternoon' : 'evening';
}

interface Cand {
  e: Experience;
  start: number;
  end: number;
  time: string;
  price: number;
  base: number;
  reasons: string[];
  meal: boolean;
}

export function composeDay(intent: ComposerIntent, ctx: AvailabilityCtx, stamps: PassportStamp[], variation = 0): DayPlan {
  const guests = intent.adults + intent.children;
  const stamped = new Set(stamps.map((s) => s.categoryId));
  const cands: Cand[] = [];
  let slotCount = 0;

  for (const e of EXPERIENCES) {
    if (e.priceUnit === 'per_night') continue;
    const prov = PROVIDER_BY_ID[e.providerId];
    for (const slot of getSlots(e, intent.date, ctx)) {
      slotCount++;
      if (slot.remaining < guests || !slot.time) continue;
      if (intent.avoid.includes(e.categoryId)) continue;
      if (intent.avoidBoats && e.kind === 'boat') continue;
      if (intent.children > 0 && (!e.familyFriendly || (e.minAge ?? 0) > 8)) continue;
      // Sessions built for children only make sense when children are coming
      const kidsOnly = /\b(little|kids|ages \d)/i.test(e.title);
      if (!intent.children && kidsOnly) continue;
      if (guests < e.minGuests || guests > e.maxGuests) continue;
      // "Evening" plans may start late afternoon; "morning" means before midday
      const lateAfternoon = intent.parts.includes('evening') && toMin(slot.time) >= 15 * 60 + 30;
      if (intent.parts.length && !intent.parts.includes(partOf(slot.time)) && !lateAfternoon) continue;
      const price = priceExperience(e, { guests: { adults: intent.adults, children: intent.children } }).total;
      const reasons: string[] = [];
      const interest = intent.interests[e.categoryId] ?? 0;
      let base = Math.min(interest, 2) * 2.6;
      if (interest >= 1 && !intent.interestsInferred) reasons.push(`Matches “${CATEGORY_BY_ID[e.categoryId].shortName.toLowerCase()}”`);
      if (intent.children && e.familyFriendly) {
        base += 1.2;
        reasons.push('Designed for kids');
      }
      if (!intent.children && /^family\b/i.test(e.title)) base -= intent.seniors ? 0.4 : 1.6;
      if (intent.romantic && e.tags.includes('romantic')) {
        base += 1.5;
        reasons.push('Romantic pick');
      }
      if (intent.group && (e.tags.includes('group') || e.maxGuests >= 12)) base += 0.8;
      if (intent.seniors && (e.indoor || e.kind === 'tasting' || e.kind === 'dining')) {
        base += 0.9;
        reasons.push('Gentle pace, seated');
      }
      // UAE climate: outdoor activities early or late, indoor at midday
      const part = partOf(slot.time);
      if (!e.indoor && part === 'afternoon') base -= 1.2;
      if (e.indoor && part === 'afternoon') {
        base += 0.8;
        reasons.push(toMin(slot.time) < 15 * 60 ? 'Indoors during the midday heat' : 'Indoors through the afternoon heat');
      }
      if (!e.indoor && part !== 'afternoon') base += 0.4;
      if (!stamped.has(e.categoryId)) {
        base += 0.7;
        reasons.push('New Passport stamp');
      }
      if (prov.flagship) base += 0.3;
      base += (prov.rating - 4.6) * 1.5;
      if (e.tags.includes('bestseller')) base += 0.4;
      const mealOf = (t: string) => (toMin(t) < 10 * 60 + 30 ? 'breakfast' : toMin(t) < 15 * 60 ? 'lunch' : 'dinner');
      const isMeal = e.kind === 'dining' || (e.kind === 'package' && /breakfast/i.test(e.title));
      if (isMeal && intent.meals.includes(mealOf(slot.time))) {
        base += 4.5;
        const m = mealOf(slot.time);
        reasons.unshift(`${m[0].toUpperCase()}${m.slice(1)}, as requested`);
      } else if (isMeal && intent.meals.length) base -= 1.5;
      else if (intent.seafood && e.kind === 'dining' && e.categoryId === 'coastal') {
        base += 3;
        reasons.unshift('Seafood, as requested');
      }
      if (intent.handsOn && e.kind === 'workshop') {
        base += 1;
        reasons.push('Hands-on');
      }
      if (intent.region && prov.regionId === intent.region) {
        base += 3.2;
        reasons.push(`In ${REGION_BY_ID[prov.regionId].name}`);
      } else if (intent.region) base -= 1;
      if (intent.vegetarian && e.kind === 'dining') reasons.push(e.dietary?.some((d) => /vegetarian|vegan/i.test(d)) ? 'Vegetarian option' : 'Check dietary options');
      if (slot.remaining - guests <= 3) reasons.push('Almost full');
      // deterministic jitter for "show me another"
      base += variation ? ((e.id.charCodeAt(1) * 7 + e.id.length * 13 + variation * 31) % 17) / 17 - 0.5 : 0;
      cands.push({ e, start: toMin(slot.time), end: toMin(slot.time) + e.durationMins, time: slot.time, price, base, reasons, meal: isMeal });
    }
  }
  cands.sort((a, b) => a.start - b.start);
  // A named place is a constraint, not a nudge: plan there whenever it can host a real day
  if (intent.region) {
    const local = cands.filter((c) => PROVIDER_BY_ID[c.e.providerId].regionId === intent.region);
    if (new Set(local.map((c) => c.e.providerId)).size >= 2) cands.splice(0, cands.length, ...local);
  }

  const maxStops = intent.pace === 'relaxed' ? 2 : intent.pace === 'packed' ? 4 : 3;
  const budget = intent.budget ? (intent.budgetPerPerson ? intent.budget * guests : intent.budget) : null;

  interface Path {
    stops: Cand[];
    score: number;
    cost: number;
  }
  let beam: Path[] = [{ stops: [], score: 0, cost: 0 }];
  let explored = 0;
  const finished: Path[] = [];
  for (let depth = 0; depth < maxStops; depth++) {
    const next: Path[] = [];
    for (const path of beam) {
      const last = path.stops[path.stops.length - 1];
      for (const c of cands) {
        if (path.stops.some((s) => s.e.id === c.e.id || s.e.providerId === c.e.providerId)) continue;
        const drive = last ? driveMinutes(PROVIDER_BY_ID[last.e.providerId].regionId, PROVIDER_BY_ID[c.e.providerId].regionId) : 0;
        if (last && c.start < last.end + drive + 25) continue;
        if (intent.noCar && last && PROVIDER_BY_ID[last.e.providerId].regionId !== PROVIDER_BY_ID[c.e.providerId].regionId) continue;
        const cost = path.cost + c.price;
        if (budget && cost > budget) continue;
        explored++;
        const sameCat = path.stops.filter((s) => s.e.categoryId === c.e.categoryId).length;
        const wanted = (Object.keys(intent.interests) as CategoryId[]).filter((k) => (intent.interests[k] ?? 0) >= 1);
        const focus = wanted.length <= 1;
        const covers = !intent.interestsInferred && wanted.includes(c.e.categoryId) && !path.stops.some((s) => s.e.categoryId === c.e.categoryId);
        // One sit-down meal per day unless several were asked for
        const extraMeal = c.meal && path.stops.some((s) => s.meal) && intent.meals.length < 2 ? 5 : 0;
        // Cover every tradition the guest asked for before repeating one
        const diversity = sameCat ? (focus ? -0.9 * sameCat : -3.6) : 0.6 + (covers ? 2.4 : 0);
        // Long cross-emirate drives eat the day — penalise them progressively
        const drivePenalty = drive / 45 + (drive > 60 ? (drive - 60) / 30 : 0);
        const gap = last ? (c.start - last.end - drive) / 60 : 0;
        const gapPenalty = gap > 3 ? (gap - 3) * 0.35 : 0;
        next.push({ stops: [...path.stops, c], score: path.score + c.base + diversity - drivePenalty - gapPenalty - extraMeal + 1.1, cost });
      }
    }
    if (!next.length) break;
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, 40);
    finished.push(...beam.slice(0, 10));
  }
  finished.sort((a, b) => b.score - a.score || a.cost - b.cost);
  // If a meal was asked for, prefer plans that actually include it
  const withMeal = intent.meals.length || intent.seafood ? finished.filter((p) => p.stops.some((st) => st.reasons.some((r) => r.endsWith('as requested')))) : [];
  const best = withMeal[0] ?? finished[0] ?? { stops: [], score: 0, cost: 0 };

  const stops: PlanStop[] = best.stops.map((c, i) => {
    const prev = best.stops[i - 1];
    const fromRegion = prev ? PROVIDER_BY_ID[prev.e.providerId].regionId : undefined;
    const driveMins = prev ? driveMinutes(fromRegion!, PROVIDER_BY_ID[c.e.providerId].regionId) : 0;
    return { experience: c.e, time: c.time, end: toTime(c.end), price: c.price, driveMins, fromRegion, reasons: c.reasons.slice(0, 3), score: c.base };
  });

  const notes: string[] = [];
  if (stops.some((s) => s.experience.kind === 'boat')) notes.push('Boat trips run only with a licensed captain and depend on sea state — full refund if cancelled for weather.');
  if (stops.some((s) => s.experience.categoryId === 'honey')) notes.push('Bee experiences: veils provided; only the beekeeper opens hives. Tell the host about any sting allergy.');
  if (intent.children && stops.length) notes.push(`Every stop accepts children; ${stops.filter((s) => s.experience.childPrice !== undefined && s.experience.childPrice < s.experience.price).length} offer child pricing.`);
  if (budget && best.cost <= budget) notes.push(`Leaves ${Math.round(budget - best.cost)} AED of your budget for lunch or the host shops.`);
  if (intent.region && stops.length && !stops.some((s) => PROVIDER_BY_ID[s.experience.providerId].regionId === intent.region))
    notes.push(`Nothing in ${REGION_BY_ID[intent.region].name} fits every constraint on this date, so this plan stays in ${REGION_BY_ID[PROVIDER_BY_ID[stops[0].experience.providerId].regionId].name}.`);
  if (intent.noCar && stops.length > 1) notes.push('No driving between stops — everything is in one area.');
  if (!stops.length) notes.push('No combination fits every constraint on this date. Try another day, a bigger budget or fewer filters.');

  return {
    intent,
    stops,
    total: best.cost,
    withinBudget: !budget || best.cost <= budget,
    regions: [...new Set(stops.map((s) => PROVIDER_BY_ID[s.experience.providerId].regionId))],
    newStamps: [...new Set(stops.map((s) => s.experience.categoryId).filter((c) => !stamped.has(c)))],
    notes,
    stats: { experiences: EXPERIENCES.length, slots: slotCount, eligible: cands.length, routes: explored },
  };
}

/** Alternatives for one stop, keeping the rest of the plan feasible. */
export function alternativesFor(plan: DayPlan, index: number, ctx: AvailabilityCtx): PlanStop[] {
  const guests = plan.intent.adults + plan.intent.children;
  const prev = plan.stops[index - 1];
  const next = plan.stops[index + 1];
  const out: PlanStop[] = [];
  for (const e of EXPERIENCES) {
    if (e.priceUnit === 'per_night' || plan.stops.some((s) => s.experience.providerId === e.providerId)) continue;
    if (plan.intent.children && !e.familyFriendly) continue;
    if (plan.intent.avoid.includes(e.categoryId) || (plan.intent.avoidBoats && e.kind === 'boat')) continue;
    for (const slot of getSlots(e, plan.intent.date, ctx)) {
      if (!slot.time || slot.remaining < guests) continue;
      const start = toMin(slot.time);
      const end = start + e.durationMins;
      const region = PROVIDER_BY_ID[e.providerId].regionId;
      const dIn = prev ? driveMinutes(PROVIDER_BY_ID[prev.experience.providerId].regionId, region) : 0;
      if (prev && start < toMin(prev.end) + dIn + 25) continue;
      if (next && end + driveMinutes(region, PROVIDER_BY_ID[next.experience.providerId].regionId) + 25 > toMin(next.time)) continue;
      const price = priceExperience(e, { guests: { adults: plan.intent.adults, children: plan.intent.children } }).total;
      out.push({ experience: e, time: slot.time, end: toTime(end), price, driveMins: dIn, fromRegion: prev ? PROVIDER_BY_ID[prev.experience.providerId].regionId : undefined, reasons: [], score: plan.intent.interests[e.categoryId] ?? 0 });
      break;
    }
  }
  return out.sort((a, b) => b.score - a.score || a.price - b.price).slice(0, 4);
}
