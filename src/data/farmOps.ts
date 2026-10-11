import type { Crop, Supplier } from './types';

/**
 * Ghaf Grove operational data used by Harvest & Demand Intelligence.
 * Forecasts come from the farmer's own weekly harvest log; the range is
 * simply min/max of the last six comparable weeks — not a model accuracy claim.
 */
export const CROPS: Crop[] = [
  { id: 'tomato', name: 'Vine tomatoes', unit: 'kg', color: '#D9442B', forecastKg: 30, range: [26, 34], pricePerKg: 12 },
  { id: 'cucumber', name: 'Cucumbers', unit: 'kg', color: '#5E8C3A', forecastKg: 44, range: [38, 47], pricePerKg: 8 },
  { id: 'okra', name: 'Okra', unit: 'kg', color: '#8AA43C', forecastKg: 16, range: [12, 17], pricePerKg: 16 },
  { id: 'aubergine', name: 'Aubergine', unit: 'kg', color: '#5B3360', forecastKg: 24, range: [19, 26], pricePerKg: 10 },
  { id: 'rocca', name: 'Rocca', unit: 'kg', color: '#4E7A2E', forecastKg: 8, range: [6, 10], pricePerKg: 30 },
  { id: 'mint', name: 'Mint', unit: 'kg', color: '#3E8E5A', forecastKg: 6, range: [5, 7], pricePerKg: 40 },
];

export const CROP_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c])) as Record<string, Crop>;

/** Contents of each subscription box (kg per box). */
export const BOX_CONTENTS: Record<string, Record<string, number>> = {
  'ghaf-box': { tomato: 1.0, cucumber: 1.0, okra: 0.4, aubergine: 0.6, rocca: 0.25, mint: 0.15 },
  'ghaf-family-box': { tomato: 1.6, cucumber: 1.6, okra: 0.6, aubergine: 1.0, rocca: 0.4, mint: 0.2 },
  'ghaf-herbs': { mint: 0.1, rocca: 0.1 },
};

/** Produce used per guest (or per night for stays) by each experience — set by the farmer. */
export const EXPERIENCE_USAGE: Record<string, { per: 'guest' | 'night'; kg: Record<string, number>; label: string }> = {
  'ghaf-dinner': { per: 'guest', label: 'Farm-to-table dinners', kg: { tomato: 0.12, cucumber: 0.1, okra: 0.08, aubergine: 0.1, rocca: 0.03, mint: 0.02 } },
  'ghaf-family': { per: 'guest', label: 'Family Farm Day lunches & baskets', kg: { tomato: 0.05, cucumber: 0.06, okra: 0.04, rocca: 0.01, mint: 0.01 } },
  'ghaf-harvest': { per: 'guest', label: 'Harvest take-home baskets', kg: { tomato: 0.04, cucumber: 0.05, mint: 0.01 } },
  'ghaf-breakfast': { per: 'guest', label: 'Farm breakfasts', kg: { tomato: 0.05, cucumber: 0.08, mint: 0.02 } },
  'ghaf-stay': { per: 'night', label: 'Farmhouse breakfast baskets', kg: { tomato: 0.4, cucumber: 0.5, mint: 0.05 } },
};

/** Farmer-approved substitutions the system may suggest (never invented by AI). */
export const APPROVED_SWAPS = [
  {
    id: 'swap-dinner-salad',
    cropOut: 'tomato',
    cropIn: 'aubergine',
    appliesTo: 'ghaf-dinner',
    title: 'Menu adjustment: charred aubergine & rocca salad',
    detail: 'Replace the tomato salad course with the approved charred aubergine & rocca salad on Saturday.',
    kgSavedPerGuest: 0.09,
    kgUsedPerGuest: 0.12,
    approvedBy: 'Mariam (head cook)',
  },
  {
    id: 'swap-box-cucumber',
    cropOut: 'tomato',
    cropIn: 'cucumber',
    appliesTo: 'ghaf-box',
    title: 'Box adjustment: +300 g cucumbers, −300 g tomatoes',
    detail: 'Adjust this week’s Seasonal Produce Boxes using the cucumber surplus. Subscribers are notified before packing.',
    kgSavedPerGuest: 0.3,
    kgUsedPerGuest: 0.3,
    approvedBy: 'Hamad (farmer)',
  },
] as const;

export const SUPPLIERS: Supplier[] = [
  {
    id: 'sup-sidr',
    name: 'Sidr Valley Farm',
    regionId: 'mleiha',
    distanceKm: 24,
    status: 'demo-verified',
    offers: [
      { cropId: 'tomato', availableKg: 12, pricePerKg: 11 },
      { cropId: 'rocca', availableKg: 4, pricePerKg: 28 },
    ],
    note: 'Partner farm on Fadhal · organic practices · delivers Wednesdays',
  },
  {
    id: 'sup-rimal',
    name: 'Rimal Date Estate',
    regionId: 'al-madam',
    distanceKm: 31,
    status: 'demo-verified',
    offers: [{ cropId: 'tomato', availableKg: 6, pricePerKg: 13 }],
    note: 'Partner farm on Fadhal · small greenhouse surplus',
  },
];

/** Weekly fixed operating costs used for “estimated net earnings” (illustrative). */
export const FARM_COSTS = {
  labourPerWeek: 2600,
  produceCostShare: 0.32,
  experienceVariableCostShare: 0.22,
  deliveryPerBox: 9,
};
