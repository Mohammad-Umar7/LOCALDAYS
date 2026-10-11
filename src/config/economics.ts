/**
 * Illustrative business-model assumptions. Every number here is adjustable and
 * is surfaced in the UI as an assumption — never as a guaranteed outcome.
 */
export const ECONOMICS = {
  /** A. Commission on experience bookings */
  experienceCommission: 0.12,
  /** B. Commission on eligible product orders and subscriptions */
  productCommission: 0.1,
  /** D. Commission on prepaid (presale) experiences */
  presaleCommission: 0.08,
  /** C. Optional business software subscription (AED / month) */
  proPlanMonthly: 199,
  /** Card processing cost passed through at cost (shown in host net earnings) */
  paymentProcessing: 0.025,
  /** UAE VAT — consumer prices are shown VAT-inclusive */
  vatRate: 0.05,
  /** Seat holds while a guest completes checkout */
  holdMinutes: 10,
  /** Presale guard-rails */
  presale: {
    maxShareOfCapacity: 0.25,
    defaultExpiryDays: 180,
    refundWindowDays: 14,
  },
} as const;

export const PRO_PLAN_FEATURES = [
  'Bookings, capacity and calendar management',
  'Product catalogue, inventory and recurring orders',
  'Customer relationships and post-visit follow-ups',
  'Harvest, batch and studio pipeline tools',
  'Financial reporting and payout reconciliation',
  'Fadhal Intelligence recommendations',
];
