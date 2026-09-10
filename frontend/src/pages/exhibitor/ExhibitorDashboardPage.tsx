import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Building2, LayoutGrid, MessageSquare, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NumberTicker } from '@/components/ui/number-ticker';
import { useAuth } from '@/hooks/useAuth';
import { useMyApplications } from '@/hooks/useExhibitors';
import { useThreads } from '@/hooks/useMessages';
import { isRunningNow, opensIn } from '@/lib/expoPhase';
import { DURATION, EASE } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { APPROVAL_LABELS, APPROVAL_VARIANTS } from '@/types';

export default function ExhibitorDashboardPage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();

  const applications = useMyApplications();
  const threads = useThreads();

  const items = applications.data?.items ?? [];
  // lead with an approved application if there is one, else the newest.
  const primary = items.find((item) => item.approvalStatus === 'approved') ?? items[0] ?? null;

  const approved = items.filter((item) => item.approvalStatus === 'approved').length;
  const unread = threads.data?.totalUnread ?? 0;

  const loading = applications.isPending;

  const expo = primary && typeof primary.expoRef === 'object' ? primary.expoRef : null;
  const expoTitle = expo?.title ?? null;
  // the one honest "happening now" an exhibitor has: the expo they are
  // approved for is physically open today, so their stand is live.
  const live = Boolean(expo && primary?.approvalStatus === 'approved' && isRunningNow(expo));

  const stats = [
    { label: 'Approved applications', value: approved, to: '/exhibitor/profile' },
    { label: 'Applications in total', value: items.length, to: '/exhibitor/profile' },
    { label: 'Unread messages', value: unread, to: '/exhibitor/messages' },
  ];

  const shortcuts = [
    { label: 'Company profile', to: '/exhibitor/profile', icon: Building2 },
    { label: 'Your booth', to: '/exhibitor/booth', icon: LayoutGrid },
    { label: 'Messages', to: '/exhibitor/messages', icon: MessageSquare },
    { label: 'AI copywriter', to: '/exhibitor/ai', icon: Sparkles },
  ];

  return (
    <div className="mx-auto max-w-full space-y-8">
      <header>
        <h1 className="text-title">{user ? `Hello, ${user.name.split(' ')[0]}` : 'Hello'}</h1>
        <p className="mt-2 text-body text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </header>

      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.reveal, ease: EASE }}
        aria-labelledby="application-status"
        className="overflow-hidden rounded-xl border border-border bg-card shadow-lg"
      >
        {loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : primary ? (
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-7">
            <div className="min-w-0 flex-1">
              <p
                id="application-status"
                className={cn('flex items-center gap-2 text-meta', live ? 'text-live' : 'text-muted-foreground')}
              >
                {live && <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />}
                {live ? 'Your stand is open now' : expo ? opensIn(expo.startDate) : 'Your application'}
              </p>
              <h2 className="mt-1 truncate text-section">{primary.companyName}</h2>
              <p className="mt-2 text-body text-muted-foreground">
                {expoTitle ?? 'Awaiting expo details'}
                {primary.approvalStatus === 'approved' && ' · you can reserve a booth'}
                {primary.approvalStatus === 'pending' && ' · waiting on the organizer'}
              </p>
              {primary.reviewNote && (
                <p className="mt-2 border-l-2 border-border pl-3 text-body italic text-muted-foreground">
                  {primary.reviewNote}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={APPROVAL_VARIANTS[primary.approvalStatus]}>
                {APPROVAL_LABELS[primary.approvalStatus]}
              </Badge>
              <Button asChild variant="outline" size="sm">
                <Link to={primary.approvalStatus === 'approved' ? '/exhibitor/booth' : '/exhibitor/profile'}>
                  {primary.approvalStatus === 'approved' ? 'Pick a booth' : 'View application'}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-7">
            <p id="application-status" className="text-meta text-muted-foreground">
              Not exhibiting yet
            </p>
            <h2 className="mt-1 text-section">Apply to an expo</h2>
            <p className="mt-2 max-w-lg text-body text-muted-foreground">
              Tell organizers about your company and what you are showing. Once approved you can reserve a booth on the
              live floor plan.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link to="/exhibitor/profile">
                Start an application
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      </motion.section>

      <section aria-label="Your activity" className="grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className={cn(
              'rounded-xl border border-border bg-card px-4 py-3.5 shadow-xs transition-colors',
              'hover:border-primary/40 hover:bg-accent',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
            )}
          >
            <div
              className={cn(
                'font-mono text-stat leading-none',
                !loading && stat.value === 0 && 'opacity-35'
              )}
            >
              {loading ? <Skeleton className="h-8 w-10" /> : reduceMotion ? stat.value : <NumberTicker value={stat.value} />}
            </div>
            <p className="mt-2 text-body text-muted-foreground">{stat.label}</p>
          </Link>
        ))}
      </section>

      <section aria-label="Jump to" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <Link
              key={shortcut.to}
              to={shortcut.to}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border border-border px-3.5 py-3 text-body font-medium transition-colors',
                'hover:border-primary hover:text-primary',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
              )}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {shortcut.label}
            </Link>
          );
        })}
      </section>
    </div>
  );
}
