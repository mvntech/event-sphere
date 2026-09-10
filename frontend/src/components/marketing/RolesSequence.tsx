import { useEffect, useRef, useState } from 'react';
import { gsap, SCRUB, EASE_GSAP, whenFontsReady } from '@/lib/landingMotion';
import { cn } from '@/lib/utils';

const ROLES = [
  {
    id: 'organizers',
    label: 'Organizers',
    line: 'The whole canvas.',
    body: 'Place and resize every stand, work one application queue, build the schedule, and watch what people actually engage with once the doors open.',
  },
  {
    id: 'exhibitors',
    label: 'Exhibitors',
    line: 'One stand, yours.',
    body: 'Claim a stand off the live plan, publish what you are showing, and answer enquiries from the people standing in front of it.',
  },
  {
    id: 'attendees',
    label: 'Attendees',
    line: 'A route through the day.',
    body: 'Find the stands worth your time, book the sessions around them, and get told before each one starts.',
  },
] as const;

const COLS = 10;
const ROWS = 6;

function Hall({ dim = false }: { dim?: boolean }) {
  const cells = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      cells.push(
        <rect
          key={`${x}-${y}`}
          x={x + 0.12}
          y={y + 0.12}
          width={0.76}
          height={0.76}
          rx={0.12}
          fill="none"
          stroke="var(--color-sidebar-border)"
          strokeWidth={0.03}
          opacity={dim ? 0.5 : 1}
        />
      );
    }
  }
  return <g>{cells}</g>;
}

const PLACED = [
  [1, 1], [3, 1], [5, 1], [7, 1],
  [1, 3], [3, 3], [5, 3], [7, 3],
  [1, 4], [3, 4], [5, 4], [7, 4],
];

const ROUTE = [
  [1, 1], [5, 1], [3, 3], [7, 4],
];

function Panel({ role }: { role: (typeof ROLES)[number]['id'] }) {
  return (
    <svg
      viewBox={`0 0 ${COLS} ${ROWS}`}
      className="h-auto w-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <Hall dim={role !== 'organizers'} />

      {role === 'organizers' &&
        PLACED.map(([x, y]) => (
          <rect
            key={`p-${x}-${y}`}
            x={x + 0.12}
            y={y + 0.12}
            width={0.76}
            height={0.76}
            rx={0.12}
            fill="var(--color-sidebar-primary)"
            opacity={0.28}
            stroke="var(--color-sidebar-primary)"
            strokeWidth={0.04}
          />
        ))}

      {role === 'exhibitors' && (
        <>
          {PLACED.map(([x, y]) => (
            <rect
              key={`c-${x}-${y}`}
              x={x + 0.12}
              y={y + 0.12}
              width={0.76}
              height={0.76}
              rx={0.12}
              fill="var(--color-sidebar-foreground)"
              opacity={0.12}
            />
          ))}
          {/* The one stand. Scale marks it, not a second colour. */}
          <rect
            x={4.9}
            y={2.9}
            width={1.2}
            height={1.2}
            rx={0.16}
            fill="var(--color-sidebar-primary)"
            opacity={0.9}
          />
          <rect
            x={4.6}
            y={2.6}
            width={1.8}
            height={1.8}
            rx={0.22}
            fill="none"
            stroke="var(--color-sidebar-primary)"
            strokeWidth={0.05}
            opacity={0.55}
          />
        </>
      )}

      {role === 'attendees' && (
        <>
          {PLACED.map(([x, y]) => (
            <rect
              key={`c-${x}-${y}`}
              x={x + 0.12}
              y={y + 0.12}
              width={0.76}
              height={0.76}
              rx={0.12}
              fill="var(--color-sidebar-foreground)"
              opacity={0.12}
            />
          ))}
          <polyline
            points={ROUTE.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(' ')}
            fill="none"
            stroke="var(--color-sidebar-primary)"
            strokeWidth={0.07}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />
          {ROUTE.map(([x, y], i) => (
            <circle
              key={`r-${x}-${y}`}
              cx={x + 0.5}
              cy={y + 0.5}
              r={i === 0 ? 0.22 : 0.16}
              fill="var(--color-sidebar-primary)"
            />
          ))}
        </>
      )}
    </svg>
  );
}

export function RolesSequence() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!root.current) return;

    let ctx: gsap.Context | undefined;
    let cancelled = false;

    whenFontsReady().then(() => {
      if (cancelled || !root.current) return;

      ctx = gsap.context((self) => {
        const panels = (self.selector?.('[data-panel]') ?? []) as HTMLElement[];
        if (!panels.length) return;

        const mm = gsap.matchMedia();

        mm.add(
          {
            animated: '(prefers-reduced-motion: no-preference)',
            reduced: '(prefers-reduced-motion: reduce)',
          },
          (context) => {
            if (context.conditions?.reduced) return;

            gsap.set(panels, { opacity: 0 });
            gsap.set(panels[0], { opacity: 1 });

            const tl = gsap.timeline({
              scrollTrigger: {
                trigger: root.current,
                start: 'top top',
                end: 'bottom bottom',
                scrub: SCRUB,
                onUpdate: (st) => {
                  const i = Math.min(ROLES.length - 1, Math.floor(st.progress * ROLES.length));
                  setActive((prev) => (prev === i ? prev : i));
                },
              },
            });

            tl.to({}, { duration: 1 }, 0);

            const FADE = 0.08;
            for (let i = 1; i < panels.length; i += 1) {
              const at = i / ROLES.length - FADE / 2;
              tl.to(panels[i - 1], { opacity: 0, duration: FADE, ease: EASE_GSAP }, at)
                .to(panels[i], { opacity: 1, duration: FADE, ease: EASE_GSAP }, at);
            }

            return () => {
              tl.scrollTrigger?.kill();
              tl.kill();
              setActive(0);
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
    <div
      ref={root}
      className="relative motion-reduce:h-auto"
      style={{ height: `${ROLES.length * 100}vh` }}
    >
      <div className="sticky top-0 flex min-h-dvh items-center overflow-hidden border-y border-sidebar-border bg-sidebar motion-reduce:static motion-reduce:min-h-0">
      <div className="container-page grid w-full items-center gap-10 py-20 sm:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h2 className="text-balance text-title text-sidebar-foreground">Three jobs, one floor.</h2>

          <ol className="mt-8 flex flex-col gap-6 motion-reduce:gap-8">
            {ROLES.map((role, i) => (
              <li
                key={role.id}
                data-role={role.id}
                className={cn(
                  'border-s-2 ps-5 transition-opacity duration-300 motion-reduce:opacity-100',
                  i === active
                    ? 'border-sidebar-primary opacity-100'
                    : 'border-sidebar-border opacity-55'
                )}
              >
                <p className="text-item text-sidebar-foreground">
                  {role.label} &mdash;{' '}
                  <span className="text-sidebar-foreground/70">{role.line}</span>
                </p>
                <p className="mt-1.5 max-w-prose text-body text-sidebar-foreground/70">{role.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative motion-reduce:grid motion-reduce:grid-cols-3 motion-reduce:gap-3">
          <div aria-hidden="true" className="invisible motion-reduce:hidden">
            <Panel role="organizers" />
          </div>

          {ROLES.map((role) => (
            <div
              key={role.id}
              data-panel={role.id}
              className="absolute inset-0 motion-reduce:static motion-reduce:opacity-100"
            >
              <Panel role={role.id} />
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
