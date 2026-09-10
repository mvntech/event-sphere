import type { Transition, Variants } from 'motion/react';

export const EASE = [0.16, 1, 0.3, 1] as const;

export const EASE_CSS = `cubic-bezier(${EASE.join(', ')})`;

export const DURATION = {
  micro: 0.18,
  panel: 0.32,
  reveal: 0.6,
} as const;

export const transition = {
  micro: { duration: DURATION.micro, ease: EASE },
  panel: { duration: DURATION.panel, ease: EASE },
  reveal: { duration: DURATION.reveal, ease: EASE },
} satisfies Record<keyof typeof DURATION, Transition>;

export const signatureReveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: transition.reveal },
};

export const staggerChildren = (count: number): Transition => ({
  staggerChildren: Math.min(0.04, 0.24 / Math.max(count, 1)),
});
