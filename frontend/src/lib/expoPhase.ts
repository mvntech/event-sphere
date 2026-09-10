import type { Expo } from '@/types';

export type ExpoPhase = 'live' | 'upcoming' | 'past' | 'cancelled';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function phaseOf(expo: Pick<Expo, 'startDate' | 'endDate' | 'status'>): ExpoPhase {
  if (expo.status === 'cancelled') return 'cancelled';
  if (expo.status === 'ongoing') return 'live';

  const today = startOfToday();
  const start = new Date(expo.startDate).setHours(0, 0, 0, 0);
  const end = new Date(expo.endDate).setHours(23, 59, 59, 999);

  if (end < today) return 'past';
  if (start <= today) return 'live';
  return 'upcoming';
}

/** the only condition under which --live may be spent on an expo. */
export const isRunningNow = (expo: Pick<Expo, 'startDate' | 'endDate' | 'status'>) =>
  phaseOf(expo) === 'live';

/** whole days until an expo opens. negative once it has started. */
export const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).setHours(0, 0, 0, 0) - startOfToday()) / 864e5);

/** "Opens tomorrow" / "Opens in 5 days" / "Opens in 3 weeks". */
export function opensIn(iso: string): string {
  const days = daysUntil(iso);
  if (days <= 0) return 'Open now';
  if (days === 1) return 'Opens tomorrow';
  if (days < 14) return `Opens in ${days} days`;
  return `Opens in ${Math.round(days / 7)} weeks`;
}
