import { useEffect, useRef } from 'react';
import { CalendarDays, LayoutGrid, MessagesSquare, Sparkles } from 'lucide-react';
import { gsap, ScrollTrigger, SCRUB, EASE_GSAP, whenFontsReady } from '@/lib/landingMotion';

const FEATURES = [
  {
    icon: LayoutGrid,
    title: 'Live floor plans',
    body: 'Drag stands onto a snap-to-grid layout and save it. Exhibitors reserve straight off that plan, and availability changes for everyone watching at the same moment — no refresh, no second copy.',
  },
  {
    icon: CalendarDays,
    title: 'Schedules that hold up',
    body: 'Sessions, speakers, rooms and capacity in one builder. Capacity is enforced when someone registers rather than stored and ignored, so a full session says so.',
  },
  {
    icon: MessagesSquare,
    title: 'One inbox for the floor',
    body: 'Attendees reach exhibitors, exhibitors reach organizers, and neighbouring stands find each other. One thread per conversation, delivered live.',
  },
  {
    icon: Sparkles,
    title: 'AI where it earns its place',
    body: 'A personalised itinerary from the real schedule, natural-language exhibitor search, and feedback triaged as it lands. Each one falls back to the plain version if the model is unavailable.',
  },
];

const NAV_OFFSET = 96;
const LIP = 14;

export function FeatureStack() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current) return;

    let ctx: gsap.Context | undefined;
    let cancelled = false;

    whenFontsReady().then(() => {
      if (cancelled || !root.current) return;

      ctx = gsap.context((self) => {
        const cards = (self.selector?.('[data-card]') ?? []) as HTMLElement[];
        const list = self.selector?.('[data-stack]')?.[0] as HTMLElement | undefined;
        if (!cards.length || !list) return;

        const mm = gsap.matchMedia();

        mm.add(
          {
            animated: '(prefers-reduced-motion: no-preference)',
            reduced: '(prefers-reduced-motion: reduce)',
          },
          (context) => {
            if (context.conditions?.reduced) return;

            const triggers: ScrollTrigger[] = [];

            cards.forEach((card, i) => {
              const top = NAV_OFFSET + i * LIP;
              const next = cards[i + 1];
              if (!next) return;
              const body = card.querySelector('[data-card-body]');
              const tween = gsap.to(card, {
                scale: 0.94,
                ease: EASE_GSAP,
                scrollTrigger: {
                  trigger: next,
                  start: 'top bottom',
                  end: `top ${top + LIP}`,
                  scrub: SCRUB,
                },
              });
              if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);

              if (body) {
                const fade = gsap.to(body, {
                  opacity: 0.25,
                  ease: EASE_GSAP,
                  scrollTrigger: {
                    trigger: next,
                    start: 'top bottom',
                    end: `top ${top + LIP}`,
                    scrub: SCRUB,
                  },
                });
                if (fade.scrollTrigger) triggers.push(fade.scrollTrigger);
              }
            });

            return () => {
              triggers.forEach((t) => t.kill());
              gsap.set(cards, { clearProps: 'transform' });
              cards.forEach((c) => {
                const body = c.querySelector('[data-card-body]');
                if (body) gsap.set(body, { clearProps: 'opacity' });
              });
            };
          }
        );

        ScrollTrigger.refresh();
      }, root);
    });

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  return (
    <section ref={root} className="container-page py-20 sm:py-28">
      <div className="max-w-2xl">
        <h2 className="text-balance text-title">Everything an expo needs, nothing it doesn&rsquo;t.</h2>
        <p className="mt-4 text-pretty text-lede text-muted-foreground">
          Built around how expos actually run &mdash; applications, stands, sessions, conversations &mdash;
          instead of a generic admin panel with a logo on it.
        </p>
      </div>

      {/*
        Block flow, not flex.

        The first version was `flex flex-col gap-6`, and the pins silently did
        nothing: GSAP pins by setting `position: fixed`, which takes the card out
        of flex flow, so its siblings reflow upward and the trigger's own
        measurements stop describing the layout. Measured, every card scrolled
        straight past its pin point — tops went to -260, -1460 — while the scale
        tweens (which do not depend on flow) kept working, which is what made it
        look half-right.

        In normal block flow a fixed child leaves its space governed by the
        margins on its siblings, so the pin holds and `pinSpacing: false` can do
        its job.
      */}
      <div data-stack className="mt-12">
        {FEATURES.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <article
              key={feature.title}
              data-card
              className="sticky mb-6 origin-top rounded-xl border border-border bg-card p-7 shadow-sm will-change-transform last:mb-0 motion-safe:mb-64 motion-reduce:static sm:p-10"
              style={{ top: NAV_OFFSET + i * LIP, zIndex: i + 1 }}
            >
              <div data-card-body>
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-meta text-muted-foreground">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                </div>

                <h3 className="mt-4 text-section">{feature.title}</h3>
                <p className="mt-3 max-w-prose text-body text-muted-foreground">{feature.body}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
