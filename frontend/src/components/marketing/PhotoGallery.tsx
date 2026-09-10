import { useEffect, useRef } from 'react';
import { Duotone } from '@/components/marketing/Duotone';
import { gsap, SCRUB, whenFontsReady } from '@/lib/landingMotion';

const GALLERY = [
  { src: '/gallery/01.jpg', span: 'sm:col-span-2', ratio: 'aspect-[4/3]' },
  { src: '/gallery/02.jpg', span: 'sm:col-span-2', ratio: 'aspect-[4/3]' },
  { src: '/gallery/03.jpg', span: 'sm:col-span-2', ratio: 'aspect-[4/3]' },
  { src: '/gallery/04.jpg', span: 'sm:col-span-3', ratio: 'aspect-[16/9]' },
  { src: '/gallery/05.jpg', span: 'sm:col-span-3', ratio: 'aspect-[16/9]' },
] as const;

const DRIFT = 5;

export function PhotoGallery() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current) return;

    let ctx: gsap.Context | undefined;
    let cancelled = false;

    whenFontsReady().then(() => {
      if (cancelled || !root.current) return;

      ctx = gsap.context((self) => {
        const frames = (self.selector?.('[data-photo]') ?? []) as HTMLElement[];
        if (!frames.length) return;

        const mm = gsap.matchMedia();

        mm.add(
          {
            animated: '(prefers-reduced-motion: no-preference)',
            reduced: '(prefers-reduced-motion: reduce)',
          },
          (context) => {
            if (context.conditions?.reduced) {
              frames.forEach((frame) => {
                gsap.set(frame, { clipPath: 'inset(0% 0% 0% 0%)' });
                const img = frame.querySelector('img');
                if (img) gsap.set(img, { clearProps: 'transform' });
              });
              return;
            }

            frames.forEach((frame, i) => {
              gsap.fromTo(
                frame,
                { clipPath: 'inset(0% 0% 100% 0%)' },
                {
                  clipPath: 'inset(0% 0% 0% 0%)',
                  ease: 'none',
                  scrollTrigger: {
                    trigger: frame,
                    start: 'top 88%',
                    end: 'top 55%',
                    scrub: SCRUB,
                  },
                }
              );

              const img = frame.querySelector('img');
              if (!img) return;

              const dir = i % 2 === 0 ? 1 : -1;
              gsap.fromTo(
                img,
                { yPercent: -DRIFT * dir },
                {
                  yPercent: DRIFT * dir,
                  ease: 'none',
                  scrollTrigger: {
                    trigger: frame,
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: SCRUB,
                  },
                }
              );
            });
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
    <section ref={root} aria-hidden="true" className="container-page py-20 sm:py-28">
      <div className="grid gap-4 sm:grid-cols-6">
        {GALLERY.map((photo) => (
          <div key={photo.src} data-photo className={photo.span}>
            <Duotone
              src={photo.src}
              className={`${photo.ratio} w-full rounded-xl shadow-sm`}
              imgClassName="scale-110"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
