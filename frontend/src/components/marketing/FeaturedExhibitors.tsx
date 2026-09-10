import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Marquee } from '@/components/ui/marquee';
import { Skeleton } from '@/components/ui/skeleton';
import { useExhibitors } from '@/hooks/useExhibitors';
import type { ExhibitorProfile } from '@/types';

const SHOWN = 14;

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function Tile({ profile }: { profile: ExhibitorProfile }) {
  return (
    <span
      title={profile.companyName}
      className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-card p-2 shadow-xs"
    >
      {profile.logoUrl ? (
        <img
          src={profile.logoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-contain"
        />
      ) : (
        <span className="font-mono text-meta text-muted-foreground">
          {initials(profile.companyName)}
        </span>
      )}
    </span>
  );
}

export function FeaturedExhibitors() {
  const { data, isPending, isError } = useExhibitors({ limit: SHOWN });

  const items = data?.items ?? [];
  const total = data?.pagination?.total ?? 0;

  // nothing real to show means no section. See the note above on empty walls.
  if (isError || (!isPending && items.length === 0)) return null;

  return (
    <section className="border-t border-border py-20 sm:py-28">
      <div className="container-page">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="text-balance text-title">On the floor already.</h2>
          {!isPending && total > 0 && (
            <p className="text-body text-muted-foreground">
              {total} compan{total === 1 ? 'y' : 'ies'} approved across every published expo
            </p>
          )}
        </div>
      </div>

      {isPending ? (
        <div className="container-page mt-10">
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="size-16 rounded-xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="relative mt-10 motion-reduce:hidden">
            <Marquee pauseOnHover aria-hidden="true" className="[--duration:48s] [--gap:0.75rem]">
              {items.map((profile) => (
                <Tile key={profile.id} profile={profile} />
              ))}
            </Marquee>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent"
            />
          </div>

          <div className="container-page mt-10 hidden motion-reduce:block">
            <ul className="flex flex-wrap gap-3">
              {items.map((profile) => (
                <li key={profile.id}>
                  <Tile profile={profile} />
                </li>
              ))}
            </ul>
          </div>

          <ul className="sr-only">
            {items.map((profile) => (
              <li key={profile.id}>{profile.companyName}</li>
            ))}
          </ul>
        </>
      )}

      <div className="container-page mt-10">
        <Button asChild variant="outline">
          <Link to="/expos">
            See what&rsquo;s on <ArrowRight />
          </Link>
        </Button>
      </div>
    </section>
  );
}
