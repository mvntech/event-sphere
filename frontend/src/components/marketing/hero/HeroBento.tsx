import { useEffect, useRef } from 'react';
import { BentoGrid, BentoTile } from '@/components/ui/bento-grid';
import { Duotone } from '@/components/marketing/Duotone';
import { gsap, EASE_GSAP, GSAP_DURATION, whenFontsReady } from '@/lib/landingMotion';
import { cn } from '@/lib/utils';

const TILES = [
  { src: '/gallery/06.jpg', area: 'col-span-3 sm:col-span-3 row-span-1', depth: 1.0 },
  { src: '/gallery/07.jpg', area: 'col-span-3 sm:col-span-3 row-span-1', depth: 0.6 },
  { src: '/gallery/08.jpg', area: 'col-span-2 sm:col-span-2 row-span-2', depth: 1.4 },
  { src: '/gallery/09.jpg', area: 'col-span-2 sm:col-span-2 row-span-1', depth: 0.8 },
  { src: '/gallery/10.jpg', area: 'col-span-2 sm:col-span-2 row-span-1', depth: 1.2 },
  { src: '/gallery/11.jpg', area: 'col-span-4 sm:col-span-4 row-span-1', depth: 0.5 },
] as const;

const DRIFT = 10;

export function HeroBento({ className }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current) return;

    let ctx: gsap.Context | undefined;
    let cancelled = false;

    whenFontsReady().then(() => {
      if (cancelled || !root.current) return;

      ctx = gsap.context((self) => {
        const grid = root.current!;
        const tiles = (self.selector?.('[data-tile]') ?? []) as HTMLElement[];
        if (!tiles.length) return;

        const mm = gsap.matchMedia();

        mm.add(
          {
            animated: '(prefers-reduced-motion: no-preference)',
            reduced: '(prefers-reduced-motion: reduce)',
          },
          (context) => {
            if (context.conditions?.reduced) return;

            gsap.from(tiles, {
              opacity: 0,
              scale: 0.9,
              duration: GSAP_DURATION.reveal,
              ease: EASE_GSAP,
              stagger: { from: 'center', amount: 0.45 },
              delay: 0.12,
              force3D: true,
            });

            const setSpotX = gsap.quickTo(grid, '--spot-x', { duration: 0.5, ease: 'power3' });
            const setSpotY = gsap.quickTo(grid, '--spot-y', { duration: 0.5, ease: 'power3' });
            const setOpacity = gsap.quickTo(grid, '--spot-opacity', { duration: 0.4, ease: 'power2' });
            const movers = tiles.map((t) => ({
              x: gsap.quickTo(t, 'x', { duration: 0.7, ease: 'power3' }),
              y: gsap.quickTo(t, 'y', { duration: 0.7, ease: 'power3' }),
              depth: Number(t.dataset.depth ?? 1),
            }));

            const onMove = (e: PointerEvent) => {
              const r = grid.getBoundingClientRect();
              const px = e.clientX - r.left;
              const py = e.clientY - r.top;

              setSpotX((px / r.width) * 100);
              setSpotY((py / r.height) * 100);
              setOpacity(1);
              const nx = (px / r.width - 0.5) * 2;
              const ny = (py / r.height - 0.5) * 2;
              movers.forEach((m) => {
                m.x(-nx * DRIFT * m.depth);
                m.y(-ny * DRIFT * m.depth);
              });
            };

            const onLeave = () => {
              setOpacity(0);
              movers.forEach((m) => {
                m.x(0);
                m.y(0);
              });
            };

            grid.addEventListener('pointermove', onMove);
            grid.addEventListener('pointerleave', onLeave);

            return () => {
              grid.removeEventListener('pointermove', onMove);
              grid.removeEventListener('pointerleave', onLeave);
              gsap.set(tiles, { clearProps: 'transform' });
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
      aria-hidden="true"
      className={cn('relative isolate', className)}
      style={
        {
          '--spot-x': '50%',
          '--spot-y': '50%',
          '--spot-opacity': 0,
        } as React.CSSProperties
      }
    >
      <BentoGrid className="aspect-[6/5] grid-cols-6 grid-rows-3 gap-3 sm:grid-cols-6">
        {TILES.map((tile, i) => (
          <BentoTile
            key={tile.src}
            flush
            span="third"
            data-tile
            data-depth={tile.depth}
            className={cn('h-full will-change-transform', tile.area)}
          >
            <Duotone src={tile.src} className="size-full" loading={i === 0 ? 'eager' : 'lazy'} />
          </BentoTile>
        ))}
      </BentoGrid>

      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
        style={{
          opacity: 'var(--spot-opacity)',
          background:
            'radial-gradient(240px circle at var(--spot-x) var(--spot-y),' +
            ' color-mix(in oklch, var(--color-primary) 22%, transparent), transparent 70%)',
        }}
      />
    </div>
  );
}
