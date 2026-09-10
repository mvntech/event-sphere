import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';
import { EASE } from '@/lib/motion';

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

export { gsap, ScrollTrigger, SplitText };

export const TRIGGER = {
  reveal: { start: 'top 75%', end: 'top 45%' },
  through: { start: 'top bottom', end: 'bottom top' },
  pinned: { start: 'top top', end: '+=100%' },
} as const;

export const SCRUB = 0.6;
export const EASE_GSAP = CustomEase.create(
  'landing',
  `M0,0 C${EASE[0]},${EASE[1]} ${EASE[2]},${EASE[3]} 1,1`
);

export const GSAP_DURATION = {
  micro: 0.18,
  panel: 0.32,
  reveal: 0.6,
} as const;

export function whenFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return Promise.resolve();
  return document.fonts.ready.then(() => undefined).catch(() => undefined);
}
