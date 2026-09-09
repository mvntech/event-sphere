import { useEffect, useState } from 'react';

export interface Countdown {
  hours: number;
  minutes: number;
  seconds: number;
  elapsed: boolean;
  imminent: boolean;
}

function diff(target: number): Countdown {
  const ms = target - Date.now();
  const clamped = Math.max(ms, 0);
  const totalSeconds = Math.floor(clamped / 1000);

  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    elapsed: ms <= 0,
    imminent: ms > 0 && ms < 3_600_000,
  };
}

/**
 * ticks once a second toward `iso`.
 *
 * stops itself once the target passes, so a dashboard left open overnight is
 * not still running a timer against a session that finished hours ago.
 */
export function useCountdown(iso: string | null | undefined): Countdown | null {
  const target = iso ? new Date(iso).getTime() : null;
  const [, force] = useState(0);

  useEffect(() => {
    if (target === null || Number.isNaN(target) || target - Date.now() <= 0) return;

    const id = window.setInterval(() => force((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (target === null || Number.isNaN(target)) return null;
  return diff(target);
}
