import { useEffect, useRef } from 'react';
import { gsap, SCRUB, EASE_GSAP, whenFontsReady } from '@/lib/landingMotion';

const STEPS = [
  {
    title: 'Draw the hall',
    body: 'The organizer lays stands out on a snap-to-grid plan, labels them, and saves. Overlaps are rejected on the way in, so the layout everyone else works from is a valid one.',
  },
  {
    title: 'Open applications',
    body: 'Companies apply with their profile, products and documents. The organizer works one queue — approve, reject, or come back to it — instead of an inbox.',
  },
  {
    title: 'Stands get claimed',
    body: 'Approved exhibitors reserve a stand straight off the live plan. Availability changes for everyone watching it at that moment, not on the next refresh.',
  },
  {
    title: 'Doors open',
    body: 'Attendees browse the plan and the schedule, bookmark the sessions they want, and message an exhibitor from the stand they are standing in front of.',
  },
];

export function HowItWorks() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current) return;

    let ctx: gsap.Context | undefined;
    let cancelled = false;

    whenFontsReady().then(() => {
      if (cancelled || !root.current) return;

      ctx = gsap.context((self) => {
        const rule = self.selector?.('[data-rule]')?.[0] as HTMLElement | undefined;
        const markers = (self.selector?.('[data-marker]') ?? []) as HTMLElement[];
        const list = self.selector?.('[data-steps]')?.[0] as HTMLElement | undefined;
        if (!rule || !list || !markers.length) return;

        const mm = gsap.matchMedia();

        mm.add(
          {
            animated: '(prefers-reduced-motion: no-preference)',
            reduced: '(prefers-reduced-motion: reduce)',
          },
          (context) => {
            if (context.conditions?.reduced) {
              gsap.set(rule, { scaleY: 1 });
              gsap.set(markers, { backgroundColor: 'var(--color-primary)', scale: 1 });
              return;
            }

            gsap.set(rule, { scaleY: 0, transformOrigin: 'top center' });
            gsap.set(markers, { backgroundColor: 'var(--color-border)', scale: 0.75 });

            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: list,
                start: 'top 80%',
                end: 'bottom 65%',
                scrub: SCRUB,
              },
            });

            tl.to(rule, { scaleY: 1, ease: 'none', duration: 1 }, 0);

            const listRect = list.getBoundingClientRect();
            markers.forEach((marker) => {
              const rect = marker.getBoundingClientRect();
              const at = Math.min(
                0.98,
                Math.max(0, (rect.top + rect.height / 2 - listRect.top) / listRect.height)
              );
              tl.to(
                marker,
                {
                  backgroundColor: 'var(--color-primary)',
                  scale: 1,
                  duration: 0.06,
                  ease: EASE_GSAP,
                },
                at
              );
            });

            return () => {
              tl.scrollTrigger?.kill();
              tl.kill();
            };
          }
        );
      }, root);
    });

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  return (
    <section
      ref={root}
      className="container-page grid gap-10 py-20 sm:py-28 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16"
    >
      <div>
        <h2 className="text-balance text-title">From an empty hall to open doors.</h2>
        <p className="mt-4 text-pretty text-body text-muted-foreground">
          Four steps, in the order they actually happen. Each one is a screen in the product, not a stage in a
          sales process.
        </p>
      </div>

      <ol data-steps className="relative">
        <span
          aria-hidden="true"
          className="absolute left-[7px] top-2 bottom-2 w-px bg-border"
        />
        <span
          data-rule
          aria-hidden="true"
          className="absolute left-[7px] top-2 bottom-2 w-px bg-primary"
        />

        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="relative grid grid-cols-[16px_minmax(0,1fr)] gap-x-5 pb-10 last:pb-0 sm:gap-x-6"
          >
            <span
              data-marker
              aria-hidden="true"
              className="mt-1.5 size-4 rounded-full ring-4 ring-background"
            />

            <div className="max-w-prose">
              <p className="text-meta font-mono text-muted-foreground">Step {i + 1}</p>
              <h3 className="mt-1 text-section">{step.title}</h3>
              <p className="mt-2 text-body text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
