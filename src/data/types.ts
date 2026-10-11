/* ------------------------------------------------------------------ */
/*  LocalDays domain model                                             */
/*  Everything the UI renders is derived from these records so real    */
/*  verified operators can replace the fictional demo data later.      */
/* ------------------------------------------------------------------ */

export type CategoryId = 'farm' | 'honey' | 'pottery' | 'coastal' | 'fragrance';
export type SceneId = 'farm' | 'apiary' | 'pottery' | 'harbour' | 'atelier';

export type RegionId =
  | 'sharjah-city'
  | 'al-hamriyah'
  | 'al-dhaid'
  | 'mleiha'
  | 'al-madam'
  | 'wadi-al-helo'
  | 'kalba'
  | 'khor-fakkan'
  | 'dibba-al-hisn';

export interface ImageRef {
  /** Topic key in the image registry (see data/images.ts) */
  key: string;
  /** Index inside the topic list */
  i?: number;
  alt: string;
}

export interface Region {
  id: RegionId;
  name: string;
  arabic: string;
  zone: 'Central' | 'West coast' | 'East coast';
  blurb: string;
  /** Position on the schematic Sharjah map (0–100 box) */
  map: { x: number; y: number };
}

export interface CategoryTheme {
  accent: string;
  accentSoft: string;
  deep: string;
  ink: string;
  gradient: string;
}

export interface Category {
  id: CategoryId;
  name: string;
  shortName: string;
  arabic: string;
  arabicLatin: string;
  tagline: string;
  description: string;
  sceneId: SceneId;
  theme: CategoryTheme;
  image: ImageRef;
  heroImage: ImageRef;
  stamp: { title: string; motto: string };
  commerce: {
    model: 'subscription' | 'reorder' | 'commission' | 'experiences' | 'formula';
    headline: string;
    summary: string;
  };
}

export type ExperienceKind =
  | 'stay'
  | 'dining'
  | 'tour'
  | 'workshop'
  | 'tasting'
  | 'package'
  | 'boat'
  | 'demonstration';

export type PriceUnit = 'per_guest' | 'per_booking' | 'per_night';
export type TimeOfDay = 'morning' | 'midday' | 'afternoon' | 'evening' | 'overnight';

export interface AddOn {
  id: string;
  name: string;
  price: number;
  unit: 'per_booking' | 'per_guest';
  description?: string;
}

export interface Experience {
  id: string;
  providerId: string;
  categoryId: CategoryId;
  title: string;
  kind: ExperienceKind;
  summary: string;
  description: string;
  durationMins: number;
  price: number;
  childPrice?: number;
  priceUnit: PriceUnit;
  /** For per_booking prices: guests covered by the base price */
  includedGuests?: number;
  extraGuestPrice?: number;
  minGuests: number;
  maxGuests: number;
  /** Guests per timed slot, or units per night for stays */
  capacity: number;
  schedule: { days: number[]; times: string[] };
  includes: string[];
  addOns: AddOn[];
  minAge?: number;
  familyFriendly: boolean;
  indoor: boolean;
  timeOfDay: TimeOfDay;
  stampEligible: boolean;
  tags: string[];
  image: ImageRef;
  hotspotId?: string;
  safety?: string[];
  requiresLicense?: boolean;
  seasonal?: string;
  stay?: { checkIn: string; checkOut: string; maxNights: number; sleeps: number };
  menu?: { course: string; items: string[] }[];
  dietary?: string[];
}

export type ProductKind =
  | 'ready'
  | 'made_to_order'
  | 'commission'
  | 'formula_refill'
  | 'subscription_box'
  | 'pass';

export type Frequency = 'weekly' | 'fortnightly' | 'monthly';

export interface SubscriptionPlan {
  frequencies: Frequency[];
  price: number;
  label: string;
  /** Max subscribers the host has approved for reliable fulfilment */
  capacity: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  providerId: string;
  categoryId: CategoryId;
  name: string;
  kind: ProductKind;
  description: string;
  price: number;
  unit: string;
  image: ImageRef;
  stock?: number;
  leadTimeDays?: number;
  seasonal?: string;
  origin: { type: 'own' | 'partner'; partnerName?: string; note?: string };
  subscription?: SubscriptionPlan;
  variants?: ProductVariant[];
  reorderable: boolean;
  /** e.g. signature blend refills only after a completed workshop */
  requiresBlend?: boolean;
  tags: string[];
  hotspotId?: string;
}

export interface HotspotRecord {
  id: string;
  title: string;
  kicker: string;
  summary: string;
  facts: { label: string; value: string }[];
  bullets?: string[];
  /** Illustrative photos of the space (e.g. farmhouse interiors) */
  photos?: ImageRef[];
  experienceIds?: string[];
  productIds?: string[];
}

export interface Review {
  id: string;
  providerId: string;
  experienceId?: string;
  author: string;
  origin: string;
  rating: number;
  text: string;
  monthsAgo: number;
}

export interface PresaleOffer {
  id: string;
  providerId: string;
  experienceId: string;
  title: string;
  regularPrice: number;
  presalePrice: number;
  totalUnits: number;
  soldUnits: number;
  redeemedUnits: number;
  expiresInDays: number;
  approvedCapacityNote: string;
  terms: string[];
}

export interface Provider {
  id: string;
  slug: string;
  categoryId: CategoryId;
  name: string;
  arabicName?: string;
  hostName: string;
  hostRole: string;
  hostInitials: string;
  regionId: RegionId;
  locationLabel: string;
  tagline: string;
  story: string[];
  highlights: string[];
  facilities: string[];
  languages: string[];
  familyFriendly: boolean;
  overnight: boolean;
  rating: number;
  reviewCount: number;
  hero: ImageRef;
  gallery: ImageRef[];
  scene: { id: SceneId; variant: 'golden' | 'morning' | 'dusk'; hotspots: HotspotRecord[]; features?: string[] };
  experienceIds: string[];
  productIds: string[];
  cancellation: { summary: string; rules: string[] };
  safety: string[];
  licences: { label: string; note: string }[];
  sustainability: string[];
  badges: string[];
  responseTime: string;
  flagship?: boolean;
}

/* ------------------------------ Transactions ------------------------------ */

export interface Guests {
  adults: number;
  children: number;
}

export interface PriceLine {
  label: string;
  amount: number;
  muted?: boolean;
}

export interface PriceBreakdown {
  lines: PriceLine[];
  subtotal: number;
  discount: number;
  total: number;
  vatIncluded: number;
}

export interface Customer {
  name: string;
  email: string;
  phone?: string;
  userId?: string;
}

export interface Booking {
  ref: string;
  createdAt: string;
  customer: Customer;
  experienceId: string;
  providerId: string;
  categoryId: CategoryId;
  date: string;
  time?: string;
  nights?: number;
  guests: Guests;
  addOnIds: string[];
  price: PriceBreakdown;
  status: 'confirmed' | 'completed' | 'cancelled';
  checkInCode: string;
  payment: { method: string; label: string; paidAt: string };
  voucherId?: string;
  rewardId?: string;
  source: 'web' | 'composer' | 'seed';
  completedAt?: string;
}

export interface OrderLine {
  productId: string;
  variantId?: string;
  qty: number;
  unitPrice: number;
}

export interface Order {
  ref: string;
  createdAt: string;
  customer: Customer;
  lines: OrderLine[];
  total: number;
  status: 'placed' | 'preparing' | 'out_for_delivery' | 'delivered';
  deliveryDate: string;
  isReorder: boolean;
  providerIds: string[];
  rewardId?: string;
  discount: number;
  source: 'web' | 'seed' | 'subscription';
}

export interface Subscription {
  id: string;
  productId: string;
  providerId: string;
  frequency: Frequency;
  price: number;
  startedAt: string;
  nextDelivery: string;
  status: 'active' | 'paused' | 'cancelled';
  deliveries: number;
  customer: Customer;
  sourceBookingRef?: string;
  /** Host-funded Passport reward: a lower price for the first N deliveries */
  promo?: { price: number; remaining: number; rewardId: string };
}

export interface PassportStamp {
  id: string;
  categoryId: CategoryId;
  providerId: string;
  experienceId: string;
  bookingRef: string;
  regionId: RegionId;
  earnedAt: string;
}

export interface SignatureBlend {
  id: string;
  providerId: string;
  formulaId: string;
  name: string;
  createdAt: string;
  bookingRef: string;
  accords: { noteId: string; share: number }[];
  approvedBy: string;
  consent: true;
  reference: string;
}

export interface PresaleVoucher {
  id: string;
  offerId: string;
  providerId: string;
  experienceId: string;
  purchasedAt: string;
  pricePaid: number;
  regularPrice: number;
  expiresAt: string;
  status: 'active' | 'redeemed' | 'refunded' | 'expired';
  redeemedBookingRef?: string;
  /** Buyer's email — vouchers are personal and non-transferable */
  ownerEmail?: string;
}

export type CartItem =
  | {
      type: 'experience';
      id: string;
      experienceId: string;
      date: string;
      time?: string;
      nights?: number;
      guests: Guests;
      addOnIds: string[];
      holdExpiresAt: string;
      voucherId?: string;
      rewardId?: string;
      source?: 'web' | 'composer';
    }
  | {
      type: 'product';
      id: string;
      productId: string;
      variantId?: string;
      qty: number;
      subscribe?: Frequency;
      rewardId?: string;
    }
  | {
      type: 'presale';
      id: string;
      offerId: string;
      qty: number;
    };

/* ------------------------------ Passport ------------------------------ */

export interface Reward {
  id: string;
  title: string;
  description: string;
  value: { type: 'percent' | 'fixed' | 'access' | 'priority'; amount?: number };
  fundedBy: { type: 'host' | 'platform'; name: string; providerId?: string };
  budget: { cap: number; used: number; unit: 'redemptions' | 'AED' };
  unlock: { type: 'stamp'; categoryId: CategoryId } | { type: 'challenge'; challengeId: string };
  appliesTo: { providerId?: string; categoryId?: CategoryId; scope: 'products' | 'experiences' | 'both' | 'event' };
  rules: string[];
  validDays: number;
}

export type ChallengeRule =
  | { type: 'distinct_categories'; count: number }
  | { type: 'family_experience' }
  | { type: 'distinct_regions'; count: number }
  | { type: 'tag'; tag: string };

export interface Challenge {
  id: string;
  title: string;
  description: string;
  rule: ChallengeRule;
  rewardId: string;
}

/* ------------------------------ Fragrance ------------------------------ */

export interface FragranceNote {
  id: string;
  name: string;
  family: 'woody' | 'floral' | 'amber' | 'citrus' | 'spice' | 'musk' | 'smoky' | 'green';
  tier: 'top' | 'heart' | 'base';
  color: string;
}

export interface Formula {
  id: string;
  providerId: string;
  name: string;
  type: 'perfume_oil' | 'bukhoor';
  description: string;
  /** Approved accords and the min/max share (percent) the maker allows */
  accords: { noteId: string; min: number; max: number; default: number }[];
  sizes: string[];
  mood: string[];
}

/* ------------------------------ Farm intelligence ------------------------------ */

export interface Crop {
  id: string;
  name: string;
  unit: 'kg';
  color: string;
  /** Forecast harvest for the next 7 days (kg) */
  forecastKg: number;
  /** Range derived from the host's last 6 weekly harvests (not a model accuracy claim) */
  range: [number, number];
  pricePerKg: number;
}

export interface Supplier {
  id: string;
  name: string;
  regionId: RegionId;
  distanceKm: number;
  status: 'demo-verified';
  offers: { cropId: string; availableKg: number; pricePerKg: number }[];
  note: string;
}
