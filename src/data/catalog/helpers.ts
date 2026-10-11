import type { CategoryId, Experience, Product } from '../types';

export const SUN = 0;
export const MON = 1;
export const TUE = 2;
export const WED = 3;
export const THU = 4;
export const FRI = 5;
export const SAT = 6;
export const EVERY_DAY = [SUN, MON, TUE, WED, THU, FRI, SAT];
/** Sharjah's public-sector weekend runs Friday to Sunday */
export const WEEKEND = [FRI, SAT, SUN];

type ExpInput = Omit<
  Experience,
  'categoryId' | 'addOns' | 'includes' | 'tags' | 'minGuests' | 'stampEligible' | 'indoor' | 'familyFriendly'
> &
  Partial<Pick<Experience, 'addOns' | 'includes' | 'tags' | 'minGuests' | 'stampEligible' | 'indoor' | 'familyFriendly'>>;

export function experience(categoryId: CategoryId, e: ExpInput): Experience {
  return {
    addOns: [],
    includes: [],
    tags: [],
    minGuests: 1,
    stampEligible: true,
    indoor: false,
    familyFriendly: true,
    ...e,
    categoryId,
  };
}

type ProdInput = Omit<Product, 'categoryId' | 'reorderable' | 'tags' | 'origin'> &
  Partial<Pick<Product, 'reorderable' | 'tags' | 'origin'>>;

export function product(categoryId: CategoryId, p: ProdInput): Product {
  return {
    reorderable: true,
    tags: [],
    origin: { type: 'own' },
    ...p,
    categoryId,
  };
}
