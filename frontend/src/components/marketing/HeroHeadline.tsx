import { useEffect, useRef } from 'react';
import { gsap, SplitText, EASE_GSAP, GSAP_DURATION, whenFontsReady } from '@/lib/landingMotion';
import { cn } from '@/lib/utils';

export function HeroHeadline({
  text,
  accent,
  className,
}: {
  text: string;
  accent?: string;
  className?: string;
}) {
  const root = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    let ctx: gsap.Context | undefined;
    let cancelled = false;

    whenFontsReady().then(() => {
      if (cancelled || !root.current) return;

      ctx = gsap.context(() => {
        const target = root.current!.querySelector<HTMLElement>('[data-split]');
        if (!target) return;

        const mm = gsap.matchMedia();

        mm.add(
          {
            animated: '(prefers-reduced-motion: no-preference)',
            reduced: '(prefers-reduced-motion: reduce)',
          },
          (context) => {
            if (context.conditions?.reduced) {
              gsap.set(target, { opacity: 1 });
              return;
            }

            const split = new SplitText(target, {
              type: 'words',
              wordsClass: 'inline-block whitespace-pre will-change-transform',
            });

            gsap.set(target, { opacity: 1 });
            gsap.from(split.words, {
              opacity: 0,
              yPercent: 40,
              filter: 'blur(6px)',
              duration: GSAP_DURATION.reveal,
              ease: EASE_GSAP,
              stagger: { each: 0.06, from: 'start', amount: Math.min(0.45, 0.06 * split.words.length) },
            });

            return () => split.revert();
          }
        );
      }, root);
    });

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [text, accent]);

  return (
    <h1 ref={root} className={cn('text-display text-balance', className)}>
      <span className="sr-only">
        {text} {accent}
      </span>

      <span aria-hidden="true" data-split className="opacity-0">
        {text} {accent && <span className="text-primary">{accent}</span>}
      </span>
    </h1>
  );
}
