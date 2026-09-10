import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarDays, MapPin, Search, TriangleAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import { WhenChip } from '@/components/shared/WhenChip';
import { FilterTabs } from '@/components/shared/FilterTabs';
import { ExpoCover } from '@/components/marketing/ExpoCover';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';
import { useExpos } from '@/hooks/useExpos';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ApiError } from '@/lib/api';
import { phaseOf } from '@/lib/expoPhase';
import { formatDateRange } from '@/lib/format';
import { DURATION, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { Expo } from '@/types';

type When = 'all' | 'live' | 'upcoming';
const ALL_THEMES = '__all__';
const PLAN_CELL = 56;

function PlanGround() {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-80 overflow-hidden">
      <InteractiveGridPattern
        width={PLAN_CELL}
        height={PLAN_CELL}
        squares={[40, 6]}
        className="mask-[linear-gradient(to_bottom,var(--color-background)_0%,transparent_80%)]"
        squaresClassName="stroke-border"
      />
    </div>
  );
}

const PHASE_RANK = { live: 0, upcoming: 1, past: 2, cancelled: 3 } as const;

function byRelevance(a: Expo, b: Expo) {
  const rank = PHASE_RANK[phaseOf(a)] - PHASE_RANK[phaseOf(b)];
  if (rank !== 0) return rank;

  const start = (expo: Expo) => new Date(expo.startDate).getTime();
  return phaseOf(a) === 'past' ? start(b) - start(a) : start(a) - start(b);
}
function ExpoCard({ expo, feature = false }: { expo: Expo; feature?: boolean }) {
  return (
    <li className={cn('flex', feature && 'sm:col-span-2')}>
      <article
        className={cn(
          'group relative flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs',
          'transition-colors hover:border-primary/40',
          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
          feature && 'sm:flex-row'
        )}
      >
        <ExpoCover
          theme={expo.theme}
          className={cn(
            'shrink-0',
            feature ? 'aspect-video sm:aspect-auto sm:w-2/5' : 'aspect-video w-full'
          )}
        />

        <div className={cn('flex flex-1 flex-col gap-3 p-5', feature && 'sm:justify-center sm:p-6')}>
          <div className="flex items-start justify-between gap-3">
            <h2 className={cn('text-item', feature && 'sm:text-section')}>
              <Link
                to={`/expos/${expo.id}`}
                className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
              >
                {expo.title}
              </Link>
            </h2>
            <WhenChip expo={expo} />
          </div>

          <dl className="flex flex-col gap-1.5 text-body text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
              <dt className="sr-only">Dates</dt>
              <dd>{formatDateRange(expo.startDate, expo.endDate)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <dt className="sr-only">Location</dt>
              <dd className="truncate">{expo.location}</dd>
            </div>
          </dl>

          <p className={cn('text-body text-muted-foreground', feature ? 'line-clamp-4' : 'line-clamp-3')}>
            {expo.description}
          </p>

          {expo.theme && (
            <p className={cn('text-meta text-muted-foreground', !feature && 'mt-auto')}>{expo.theme}</p>
          )}
        </div>
      </article>
    </li>
  );
}

export default function PublicExposPage() {
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState<string>(ALL_THEMES);
  const [when, setWhen] = useState<When>('all');
  const reduceMotion = useReducedMotion();

  const debounced = useDebouncedValue(search, 300);
  const { data, isPending, isError, error, refetch } = useExpos({ limit: 50 });

  const all = useMemo(() => data?.items ?? [], [data]);

  // themes come from what is actually listed, so the filter can never offer a
  // choice that returns nothing.
  const themes = useMemo(
    () => [...new Set(all.map((expo) => expo.theme).filter(Boolean))].sort(),
    [all]
  );

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return all
      .filter((expo) => (theme === ALL_THEMES ? true : expo.theme === theme))
      .filter((expo) => {
        if (when === 'all') return true;
        return phaseOf(expo) === when;
      })
      .filter((expo) =>
        q
          ? [expo.title, expo.theme, expo.location, expo.description]
              .filter(Boolean)
              .some((field) => field.toLowerCase().includes(q))
          : true
      )
      .sort(byRelevance);
  }, [all, debounced, theme, when]);

  const filtered = Boolean(debounced || theme !== ALL_THEMES || when !== 'all');
  const clear = () => {
    setSearch('');
    setTheme(ALL_THEMES);
    setWhen('all');
  };

  return (
    <div className="relative">
      <PlanGround />

      <div className="container-page relative py-12 sm:py-16">
      <header className="max-w-2xl">
        <h1 className="text-title">What's on</h1>
        <p className="mt-2 text-lede text-muted-foreground">
          Every expo running on EventSphere. Browse the floor, the schedule and who is exhibiting — no account
          needed to look.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Try a city, a theme, or an expo name"
            aria-label="Search expos"
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <FilterTabs
            label="Filter expos by when they run"
            value={when}
            onChange={setWhen}
            tabs={[
              { value: 'all', label: 'All' },
              { value: 'live', label: 'On now' },
              { value: 'upcoming', label: 'Upcoming' },
            ]}
          />

          {themes.length > 1 && (
            <FilterTabs
              label="Filter expos by theme"
              value={theme}
              onChange={setTheme}
              tabs={[
                { value: ALL_THEMES, label: 'Any theme' },
                ...themes.map((value) => ({ value, label: value })),
              ]}
            />
          )}
        </div>

        {filtered && (
          <div className="flex items-center gap-2 text-body text-muted-foreground">
            <span>
              {results.length} expo{results.length === 1 ? '' : 's'}
              {debounced && ` for “${debounced}”`}
            </span>
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-meta" onClick={clear}>
              <X className="size-3.5" aria-hidden="true" />
              Clear
            </Button>
          </div>
        )}
      </div>

      {isPending && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={cn('h-72 w-full rounded-xl', i === 0 && 'sm:col-span-2')} />
          ))}
        </div>
      )}

      {isError && (
        <Card className="mt-8 border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 text-body font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {error instanceof ApiError ? error.message : 'Could not load what is on'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && results.length === 0 && (
        <div className="mt-8">
          <EmptyState
            icon={CalendarDays}
            title={filtered ? 'Nothing matches those filters' : 'No expos published yet'}
            description={
              filtered
                ? 'Try a different word, or clear the filters to see everything that is on.'
                : 'Once an organizer publishes an expo it will be listed here.'
            }
            action={filtered ? <Button variant="outline" onClick={clear}>Clear filters</Button> : undefined}
          />
        </div>
      )}

      {results.length > 0 && (
        <motion.ul
          key={`${debounced}|${theme}|${when}`}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.panel, ease: EASE }}
          className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {results.map((expo, i) => (
            <ExpoCard key={expo.id} expo={expo} feature={!filtered && i === 0} />
          ))}
        </motion.ul>
      )}
      </div>
    </div>
  );
}
