import { useState } from 'react';
import {
  Building2,
  CalendarPlus,
  Check,
  FileText,
  Globe,
  Mail,
  Package,
  Phone,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FilterTabs } from '@/components/shared/FilterTabs';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { ExpoPicker } from '@/components/organizer/ExpoPicker';
import { ReviewDecisionDialog } from '@/components/organizer/ReviewDecisionDialog';
import { useExhibitors } from '@/hooks/useExhibitors';
import { useExpos } from '@/hooks/useExpos';
import { ApiError } from '@/lib/api';
import { formatBytes, formatRelative } from '@/lib/format';
import { APPROVAL_LABELS, APPROVAL_VARIANTS, type ApprovalStatus, type ExhibitorProfile } from '@/types';

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

function ApplicationCard({
  profile,
  onDecide,
}: {
  profile: ExhibitorProfile;
  onDecide: (decision: 'approved' | 'rejected') => void;
}) {
  const applicant = typeof profile.userRef === 'string' ? null : profile.userRef;
  const isPending = profile.approvalStatus === 'pending';

  return (
    <li>
      <Card className="shadow-sm transition-colors hover:border-primary/40">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start gap-4">
            <Avatar className="size-12 shrink-0 rounded-lg">
              {profile.logoUrl && <AvatarImage src={profile.logoUrl} alt="" />}
              <AvatarFallback className="rounded-lg">{initials(profile.companyName)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-item">{profile.companyName}</h3>
                <Badge variant={APPROVAL_VARIANTS[profile.approvalStatus]}>
                  {APPROVAL_LABELS[profile.approvalStatus]}
                </Badge>
                <Badge variant="outline">{profile.category}</Badge>
              </div>
              <p className="mt-1 text-body text-muted-foreground">
                {applicant ? `${applicant.name} · ${applicant.email}` : 'Applicant'} · applied{' '}
                {formatRelative(profile.createdAt)}
              </p>
            </div>
          </div>

          <p className="text-body text-muted-foreground">{profile.description}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {profile.products.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-body font-semibold text-foreground">
                  <Package className="size-3.5" aria-hidden="true" />
                  Products & services
                </h4>
                <ul className="mt-2 space-y-1 text-body">
                  {profile.products.map((product, i) => (
                    <li key={product._id ?? i}>
                      <span className="font-medium">{product.name}</span>
                      <span className="text-muted-foreground"> · {product.category}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {profile.staff.length > 0 && (
              <div>
                <h4 className="flex items-center gap-2 text-body font-semibold text-foreground">
                  <Users className="size-3.5" aria-hidden="true" />
                  Booth staff
                </h4>
                <ul className="mt-2 space-y-1 text-body">
                  {profile.staff.map((member, i) => (
                    <li key={member._id ?? i}>
                      <span className="font-medium">{member.name}</span>
                      {member.role && <span className="text-muted-foreground"> · {member.role}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {profile.documents.length > 0 && (
            <div>
              <h4 className="flex items-center gap-2 text-body font-semibold text-foreground">
                <FileText className="size-3.5" aria-hidden="true" />
                Supporting documents
              </h4>
              <ul className="mt-2 flex flex-wrap gap-2">
                {profile.documents.map((doc) => (
                  <li key={doc._id}>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-body transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="max-w-48 truncate">{doc.filename}</span>
                      <span className="text-meta text-muted-foreground">{formatBytes(doc.bytes)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(profile.contact.email || profile.contact.phone || profile.contact.website) && (
            <dl className="flex flex-wrap gap-x-5 gap-y-2 text-body text-muted-foreground">
              {profile.contact.email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="size-3.5" aria-hidden="true" />
                  <dt className="sr-only">Email</dt>
                  <dd>{profile.contact.email}</dd>
                </div>
              )}
              {profile.contact.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="size-3.5" aria-hidden="true" />
                  <dt className="sr-only">Phone</dt>
                  <dd>{profile.contact.phone}</dd>
                </div>
              )}
              {profile.contact.website && (
                <div className="flex items-center gap-1.5">
                  <Globe className="size-3.5" aria-hidden="true" />
                  <dt className="sr-only">Website</dt>
                  <dd>
                    <a href={profile.contact.website} target="_blank" rel="noreferrer noopener" className="hover:text-foreground hover:underline">
                      {profile.contact.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          )}

          {profile.reviewNote && !isPending && (
            <p className="rounded-lg border-l-2 border-border bg-muted px-4 py-3 text-body">
              <span className="font-medium">Your note: </span>
              <span className="text-muted-foreground">{profile.reviewNote}</span>
            </p>
          )}

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {isPending ? (
              <>
                <Button size="sm" onClick={() => onDecide('approved')}>
                  <Check className="size-4" aria-hidden="true" />
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => onDecide('rejected')}>
                  <X className="size-4" aria-hidden="true" />
                  Reject
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDecide(profile.approvalStatus === 'approved' ? 'rejected' : 'approved')}
              >
                {profile.approvalStatus === 'approved' ? 'Withdraw approval' : 'Approve after all'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

const TABS: { value: ApprovalStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ExhibitorsPage() {
  const [expoId, setExpoId] = useState('');
  const [tab, setTab] = useState<ApprovalStatus>('pending');
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [reviewing, setReviewing] = useState<ExhibitorProfile | null>(null);

  const { data: expoList, isPending: exposPending } = useExpos({ mine: true, limit: 50 });
  const { data, isPending, isError, error, refetch } = useExhibitors(
    expoId ? { expoRef: expoId, approvalStatus: tab, limit: 50 } : { approvalStatus: tab, limit: 50 }
  );

  const applications = data?.items ?? [];
  const counts = data?.counts ?? { pending: 0, approved: 0, rejected: 0 };
  const hasExpos = (expoList?.items.length ?? 0) > 0;

  const openDecision = (profile: ExhibitorProfile, next: 'approved' | 'rejected') => {
    setReviewing(profile);
    setDecision(next);
  };

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Exhibitor applications"
        description="Review who wants to exhibit, then approve or reject. Either way they are emailed the decision."
      />

      {!exposPending && !hasExpos && (
        <EmptyState
          icon={CalendarPlus}
          title="Create an expo first"
          description="Exhibitors apply to a specific expo. Publish one and applications will land here."
        />
      )}

      {hasExpos && (
        <div className="flex flex-col gap-5">
          <ExpoPicker value={expoId} onChange={setExpoId} />

          <FilterTabs
            label="Filter applications by status"
            value={tab}
            onChange={setTab}
            tabs={TABS.map((option) => ({
              value: option.value,
              label: option.label,
              count: counts[option.value],
            }))}
          />
        </div>
      )}

      {hasExpos && isPending && (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      )}
      
      {isError && !data && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {error instanceof ApiError ? error.message : 'Could not load applications'}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {hasExpos && !isPending && !isError && applications.length === 0 && (
        <EmptyState
          icon={Building2}
          title={`No ${tab} applications`}
          description={
            tab === 'pending'
              ? 'When exhibitors apply to this expo, their applications will queue up here for review.'
              : `Nothing has been ${tab} for this expo yet.`
          }
        />
      )}

      {applications.length > 0 && (
        <ul className="space-y-4">
          {applications.map((profile) => (
            <ApplicationCard
              key={profile.id}
              profile={profile}
              onDecide={(next) => openDecision(profile, next)}
            />
          ))}
        </ul>
      )}

      <ReviewDecisionDialog
        open={Boolean(reviewing)}
        onOpenChange={(open) => !open && setReviewing(null)}
        profile={reviewing}
        decision={decision}
      />
    </div>
  );
}
