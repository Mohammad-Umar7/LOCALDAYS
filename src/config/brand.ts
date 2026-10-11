/**
 * Single source of truth for brand naming and platform-wide constants.
 * Rename the product here and it updates everywhere in the UI.
 */
export const BRAND = {
  name: 'Fadhal',
  nameArabic: 'فضل',
  tagline: "Don’t Just Visit. Live It.",
  taglineLead: "Don’t Just Visit.",
  taglineEmphasis: 'Live It.',
  promise:
    'Discover authentic experiences across Sharjah. Meet the people behind them, take part in local traditions, and support the businesses that keep them alive.',
  city: 'Sharjah',
  country: 'United Arab Emirates',
  currency: 'AED',
  locale: 'en-AE',
  supportEmail: 'hello@fadhal.demo',
  passportName: 'Fadhal Passport',
  proPlanName: 'Fadhal Pro',
  intelligenceName: 'Fadhal Intelligence',
  composerName: 'Day Composer',
  /** Shown wherever data is fictional so nothing is mistaken for a real partnership. */
  demoNotice:
    'Demo build for the Sharjah Tourism Innovation Hackathon. All hosts, prices, reviews and metrics are fictional and illustrative.',
} as const;

export type Brand = typeof BRAND;
