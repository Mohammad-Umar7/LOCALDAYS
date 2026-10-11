import type { Booking, Challenge, PassportStamp, Reward } from '@/data/types';
import { CHALLENGES, REWARDS } from '@/data/passport';
import { EXPERIENCE_BY_ID } from '@/data/catalog';

export interface ChallengeProgress {
  challenge: Challenge;
  progress: number;
  target: number;
  complete: boolean;
}

/** Challenges only count host-verified (completed) experiences. */
export function evaluateChallenges(stamps: PassportStamp[], bookings: Booking[]): ChallengeProgress[] {
  const completed = bookings.filter((b) => b.status === 'completed');
  return CHALLENGES.map((c) => {
    const r = c.rule;
    let progress = 0;
    let target = 1;
    if (r.type === 'distinct_categories') {
      target = r.count;
      progress = new Set(stamps.map((s) => s.categoryId)).size;
    } else if (r.type === 'distinct_regions') {
      target = r.count;
      progress = new Set(stamps.map((s) => s.regionId)).size;
    } else if (r.type === 'family_experience') {
      progress = completed.some((b) => b.guests.children > 0 && EXPERIENCE_BY_ID[b.experienceId]?.familyFriendly) ? 1 : 0;
    } else if (r.type === 'tag') {
      progress = completed.some((b) => EXPERIENCE_BY_ID[b.experienceId]?.tags.includes(r.tag)) ? 1 : 0;
    }
    return { challenge: c, progress: Math.min(progress, target), target, complete: progress >= target };
  });
}

export function unlockedRewards(stamps: PassportStamp[], bookings: Booking[]): Reward[] {
  const cats = new Set(stamps.map((s) => s.categoryId));
  const done = new Set(evaluateChallenges(stamps, bookings).filter((c) => c.complete).map((c) => c.challenge.id));
  return REWARDS.filter((r) => (r.unlock.type === 'stamp' ? cats.has(r.unlock.categoryId) : done.has(r.unlock.challengeId)));
}

/**
 * A reward's budget including redemptions made in this demo session. `ledger` is the store's
 * usedRewards list (`owner|rewardId` entries) across every customer.
 */
export function liveBudget(r: Reward, ledger: string[] = []) {
  const n = ledger.filter((e) => (e.includes('|') ? e.slice(e.indexOf('|') + 1) : e) === r.id).length;
  const used = Math.min(r.budget.cap, r.budget.used + n * (r.budget.unit === 'AED' ? r.value.amount ?? 0 : 1));
  return { used, cap: r.budget.cap, left: r.budget.cap - used, unit: r.budget.unit };
}

/** Rewards that can be applied to a given experience booking right now. */
export function rewardsForExperience(experienceId: string, available: Reward[], used: string[], ledger: string[] = []) {
  const e = EXPERIENCE_BY_ID[experienceId];
  if (!e) return [];
  return available.filter((r) => {
    if (used.includes(r.id)) return false;
    if (!(r.appliesTo.scope === 'experiences' || r.appliesTo.scope === 'both')) return false;
    if (r.value.type !== 'percent' && r.value.type !== 'fixed') return false;
    if (r.appliesTo.providerId && r.appliesTo.providerId !== e.providerId) return false;
    if (r.appliesTo.categoryId && r.appliesTo.categoryId !== e.categoryId) return false;
    if (liveBudget(r, ledger).left <= 0) return false;
    return true;
  });
}

export function rewardsForProducts(providerId: string, available: Reward[], used: string[], ledger: string[] = []) {
  return available.filter(
    (r) =>
      !used.includes(r.id) &&
      (r.appliesTo.scope === 'products' || r.appliesTo.scope === 'both') &&
      (!r.appliesTo.providerId || r.appliesTo.providerId === providerId) &&
      (r.value.type === 'percent' || r.value.type === 'fixed') &&
      liveBudget(r, ledger).left > 0,
  );
}
