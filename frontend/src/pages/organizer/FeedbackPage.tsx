import { useState } from 'react';
import { MessageSquare, Sparkles, Star, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterTabs } from '@/components/shared/FilterTabs';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { useFeedbackInbox, useUpdateFeedback } from '@/hooks/useFeedback';
import { useAiTriage } from '@/hooks/useAi';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatRelative } from '@/lib/format';
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_VARIANTS,
  type Feedback,
  type FeedbackStatus,
} from '@/types';

const TABS: FeedbackStatus[] = ['new', 'reviewed', 'resolved'];

const SENTIMENT_VARIANTS: Record<string, 'success' | 'muted' | 'destructive'> = {
  positive: 'success',
  neutral: 'muted',
  negative: 'destructive',
};

function Rating({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn('size-3.5', n <= value ? 'fill-primary text-primary' : 'text-muted-foreground/40')}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function FeedbackCard({ item }: { item: Feedback }) {
  const update = useUpdateFeedback();
  const triage = useAiTriage();
  const author = typeof item.userRef === 'object' && item.userRef ? item.userRef : null;
  const expo = typeof item.expoRef === 'object' && item.expoRef ? item.expoRef : null;

  const runTriage = async () => {
    try {
      const result = await triage.mutateAsync({ feedbackRef: item.id });
      toast.success(
        result.source === 'ai' ? `Tagged as ${result.sentiment}` : `Tagged as ${result.sentiment} without AI`,
        { description: result.summary || undefined }
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not tag that feedback');
    }
  };

  const setStatus = async (status: FeedbackStatus) => {
    try {
      await update.mutateAsync({ id: item.id, status });
      toast.success(`Marked as ${FEEDBACK_STATUS_LABELS[status].toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not update that feedback');
    }
  };

  return (
    <li>
      <Card className="shadow-sm transition-colors hover:border-primary/40">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-body font-semibold">
                {author?.name ?? 'Someone'}
                {author?.role && <span className="font-normal text-muted-foreground"> · {author.role}</span>}
              </p>
              <p className="mt-0.5 text-meta text-muted-foreground">
                {expo?.title ? `${expo.title} · ` : ''}
                {formatRelative(item.createdAt)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {item.rating && <Rating value={item.rating} />}
              <Badge variant="outline">{FEEDBACK_CATEGORY_LABELS[item.category]}</Badge>
              <Badge variant={FEEDBACK_STATUS_VARIANTS[item.status]}>{FEEDBACK_STATUS_LABELS[item.status]}</Badge>
            </div>
          </div>

          <p className="whitespace-pre-wrap text-body leading-relaxed">{item.content}</p>

          {item.aiSentiment && (
            <p className="flex flex-wrap items-center gap-2 text-meta">
              <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="text-muted-foreground">AI read this as</span>
              <Badge variant={SENTIMENT_VARIANTS[item.aiSentiment] ?? 'muted'}>{item.aiSentiment}</Badge>
              {item.aiCategory && <Badge variant="outline">{item.aiCategory}</Badge>}
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {!item.aiSentiment && (
              <Button variant="outline" size="sm" loading={triage.isPending} onClick={runTriage}>
                <Sparkles className="size-4" aria-hidden="true" />
                Tag with AI
              </Button>
            )}
            {TABS.filter((status) => status !== item.status).map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                loading={update.isPending}
                onClick={() => setStatus(status)}
              >
                Mark {FEEDBACK_STATUS_LABELS[status].toLowerCase()}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

export default function OrganizerFeedbackPage() {
  const [tab, setTab] = useState<FeedbackStatus>('new');
  const { data, isPending, isError, error, refetch } = useFeedbackInbox({ status: tab });

  const items = data?.items ?? [];
  const counts = data?.counts ?? { new: 0, reviewed: 0, resolved: 0 };

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Feedback inbox"
        description="Everything attendees, exhibitors and staff have told you about your expos."
      />

      <FilterTabs
        label="Filter feedback by status"
        value={tab}
        onChange={setTab}
        tabs={TABS.map((status) => ({
          value: status,
          label: FEEDBACK_STATUS_LABELS[status],
          count: counts[status],
        }))}
      />

      {isPending && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      )}

      {isError && !data && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {error instanceof ApiError ? error.message : 'Could not load the feedback inbox'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!isPending && !isError && items.length === 0 && (
        <EmptyState
          icon={MessageSquare}
          title={`No ${FEEDBACK_STATUS_LABELS[tab].toLowerCase()} feedback`}
          description={
            tab === 'new'
              ? 'When someone submits feedback on one of your expos, it will land here.'
              : `Nothing has been marked ${FEEDBACK_STATUS_LABELS[tab].toLowerCase()} yet.`
          }
        />
      )}

      {items.length > 0 && (
        <ul className="space-y-4">
          {items.map((item) => (
            <FeedbackCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
