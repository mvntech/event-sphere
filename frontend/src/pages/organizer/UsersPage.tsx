import { useState } from 'react';
import { Check, Search, ShieldCheck, TriangleAlert, UserCog, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterTabs } from '@/components/shared/FilterTabs';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { useChangeRole, useReviewOrganizer, useUserDirectory } from '@/hooks/useUsers';
import { useAuth } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import {
  ORGANIZER_APPROVAL_LABELS,
  ORGANIZER_APPROVAL_VARIANTS,
  ROLE_LABELS_PLURAL,
  type ManagedUser,
  type Role,
} from '@/types';

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const ROLES: Role[] = ['organizer', 'exhibitor', 'attendee'];
type Tab = 'pending' | Role;

function RoleCell({ person, isSelf }: { person: ManagedUser; isSelf: boolean }) {
  const changeRole = useChangeRole();

  const setRole = async (role: Role) => {
    try {
      const result = await changeRole.mutateAsync({ id: person.id, role });
      toast.success(`${result.user.name} is now a ${role}`);
    } catch (error) {
      // a 409 here explains what blocks the change (expos owned, last organizer).
      toast.error(error instanceof ApiError ? error.message : 'Could not change that role');
    }
  };

  return (
    <Select
      value={person.role}
      onValueChange={(value) => setRole(value as Role)}
      disabled={isSelf || changeRole.isPending}
    >
      <SelectTrigger className="w-36" aria-label={`Role for ${person.name}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {role[0].toUpperCase() + role.slice(1)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** true when this organizer account is still waiting on a decision. */
const isPending = (person: ManagedUser) =>
  person.role === 'organizer' && person.organizerApprovalStatus === 'pending';

export default function UsersPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('pending');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);

  const params = tab === 'pending' ? { status: 'pending' as const } : { role: tab };
  const directory = useUserDirectory({ ...params, search: debounced || undefined });

  const [reviewing, setReviewing] = useState<ManagedUser | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | undefined>();

  const review = useReviewOrganizer();

  const items = directory.data?.items ?? [];
  const counts = directory.data?.counts;

  const openReview = (person: ManagedUser, next: 'approved' | 'rejected') => {
    setReviewing(person);
    setDecision(next);
    setNote('');
    setNoteError(undefined);
  };

  const submitReview = async () => {
    if (!reviewing) return;

    // the server requires a reason on refusal; check here to save a round trip.
    if (decision === 'rejected' && note.trim().length < 5) {
      setNoteError('Give a short reason so they know why');
      return;
    }

    try {
      await review.mutateAsync({
        id: reviewing.id,
        organizerApprovalStatus: decision,
        reviewNote: note.trim() || undefined,
      });
      toast.success(
        decision === 'approved' ? `${reviewing.name} can now sign in` : `${reviewing.name} was refused`,
        { description: 'They have been emailed the decision.' }
      );
      setReviewing(null);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Could not save that decision';
      setNoteError(message);
      toast.error(message);
    }
  };

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="People"
        description="Everyone with an account. Organizer accounts stay inactive until an existing organizer approves them."
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          label="Filter people by role"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'pending' as Tab, label: 'Awaiting approval', count: counts?.pendingOrganizers },
            ...ROLES.map((role) => ({
              value: role as Tab,
              label: ROLE_LABELS_PLURAL[role],
              count: counts?.[role],
            })),
          ]}
        />

        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search people"
            className="pl-10"
          />
        </div>
      </div>

      {directory.isError && !directory.data && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 text-body font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {directory.error instanceof ApiError ? directory.error.message : 'Could not load the directory'}
            </p>
            <Button variant="outline" size="sm" onClick={() => directory.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!directory.isError && (
        <DataTable
          rows={items}
          rowKey={(person) => person.id}
          isLoading={directory.isPending}
          caption="People registered on EventSphere"
          highlight={isPending}
          empty={{
            icon: tab === 'pending' ? ShieldCheck : Users,
            title: tab === 'pending' ? 'Nobody is waiting' : `No ${tab}s${debounced ? ' match that search' : ''}`,
            description:
              tab === 'pending'
                ? 'New organizer accounts appear here for approval before they can sign in.'
                : 'Accounts show up here as people register.',
          }}
          columns={[
            {
              header: 'Person',
              cell: (person) => (
                <div className="flex items-center gap-3">
                  <Avatar className="size-8 shrink-0">
                    {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
                    <AvatarFallback className="text-meta">{initials(person.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {person.name}
                      {person.id === user?.id && <Badge variant="muted">You</Badge>}
                    </p>
                    <p className="truncate text-meta text-muted-foreground">{person.email}</p>
                  </div>
                </div>
              ),
            },
            {
              header: 'Status',
              secondary: true,
              cell: (person) =>
                person.organizerApprovalStatus ? (
                  <Badge variant={ORGANIZER_APPROVAL_VARIANTS[person.organizerApprovalStatus]}>
                    {ORGANIZER_APPROVAL_LABELS[person.organizerApprovalStatus]}
                  </Badge>
                ) : (
                  <span className="text-meta text-muted-foreground">—</span>
                ),
            },
            {
              header: 'Joined',
              secondary: true,
              cell: (person) => (
                <span className="text-meta text-muted-foreground">{formatDate(person.createdAt)}</span>
              ),
            },
            {
              header: '',
              align: 'end',
              cell: (person) =>
                isPending(person) ? (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => openReview(person, 'approved')}>
                      <Check className="size-4" aria-hidden="true" />
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openReview(person, 'rejected')}>
                      <X className="size-4" aria-hidden="true" />
                      Refuse
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <RoleCell person={person} isSelf={person.id === user?.id} />
                  </div>
                ),
            },
          ]}
        />
      )}

      <Dialog open={Boolean(reviewing)} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {decision === 'approved' ? 'Approve' : 'Refuse'} {reviewing?.name}?
            </DialogTitle>
            <DialogDescription>
              {decision === 'approved'
                ? 'They will be able to sign in and will have the same powers you do — creating expos, approving exhibitors and reviewing other organizers.'
                : 'They will be emailed the decision and will not be able to sign in.'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Field
              id="organizer-review-note"
              label={decision === 'approved' ? 'Note (optional)' : 'Reason for refusing'}
              error={noteError}
            >
              {(props) => (
                <Textarea
                  {...props}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteError(undefined);
                  }}
                  rows={3}
                  placeholder={
                    decision === 'approved'
                      ? 'Welcome aboard — you are running the robotics hall.'
                      : 'This address is not part of the events team.'
                  }
                />
              )}
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReviewing(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={decision === 'rejected' ? 'destructive' : 'default'}
              loading={review.isPending}
              onClick={submitReview}
            >
              {decision === 'approved' ? 'Approve account' : 'Refuse account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
