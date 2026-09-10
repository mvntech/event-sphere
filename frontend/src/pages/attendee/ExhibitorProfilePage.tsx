import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Globe, LayoutGrid, Mail, MapPin, MessageSquare, Phone, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { NewConversationDialog } from '@/components/messaging/NewConversationDialog';
import { ApiError, http } from '@/lib/api';
import { cn } from '@/lib/utils';
import { BOOTH_STATUS_LABELS, BOOTH_STATUS_VARIANTS, type Booth, type ExhibitorProfile } from '@/types';

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

interface ExhibitorDetail {
  profile: ExhibitorProfile;
  booth: Booth | null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border pt-6">
      <h2 className="text-section">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ExhibitorProfilePage() {
  const { exhibitorId } = useParams<{ exhibitorId: string }>();
  const navigate = useNavigate();

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['exhibitors', 'detail', exhibitorId],
    queryFn: () => http.get<ExhibitorDetail>(`/exhibitors/${exhibitorId}`),
    enabled: Boolean(exhibitorId),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-full space-y-8">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-full">
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 text-body font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {error instanceof ApiError ? error.message : 'Could not load that exhibitor'}
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/attendee/exhibitors">Back to the directory</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, booth } = data;
  const expo = typeof profile.expoRef === 'object' && profile.expoRef ? profile.expoRef : null;
  const owner = typeof profile.userRef === 'object' && profile.userRef ? profile.userRef : null;
  const contact = profile.contact;
  const hasContact = Boolean(contact.email || contact.phone || contact.website);

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title={profile.companyName}
        description={expo ? `Exhibiting at ${expo.title}` : undefined}
        actions={
          owner && expo ? (
            <NewConversationDialog
              onStarted={(threadId) => navigate(`/attendee/messages?thread=${threadId}`)}
              presetRecipient={{ userId: owner.id, name: profile.companyName, expoId: expo.id }}
              trigger={
                <Button>
                  <MessageSquare className="size-4" aria-hidden="true" />
                  Message this exhibitor
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        {/* reading column: no card chrome */}
        <div className="min-w-0 space-y-6">
          <div className="flex gap-4">
            {profile.logoUrl ? (
              <img
                src={profile.logoUrl}
                alt=""
                className="size-16 shrink-0 rounded-xl border border-border object-contain"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-16 shrink-0 place-items-center rounded-xl border border-border font-mono text-body text-muted-foreground"
              >
                {initials(profile.companyName)}
              </span>
            )}

            <div className="min-w-0">
              {profile.category && <p className="text-meta text-muted-foreground">{profile.category}</p>}
              <p className="mt-1.5 text-body text-muted-foreground">{profile.description}</p>
            </div>
          </div>

          {profile.products.length > 0 && (
            <Section title="Products and services">
              <dl className="space-y-4">
                {profile.products.map((product, i) => (
                  <div key={product._id ?? i} className="border-l-2 border-border pl-4">
                    <dt className="text-item">
                      {product.name}
                      {product.category && (
                        <span className="ml-2 text-meta font-normal text-muted-foreground">
                          {product.category}
                        </span>
                      )}
                    </dt>
                    {product.description && (
                      <dd className="mt-1 text-body text-muted-foreground">{product.description}</dd>
                    )}
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {profile.staff.length > 0 && (
            <Section title="Who you will meet">
              <ul className="flex flex-wrap gap-x-6 gap-y-3">
                {profile.staff.map((member, i) => (
                  <li key={member._id ?? i}>
                    <p className="text-body font-medium">{member.name}</p>
                    {member.role && <p className="text-meta text-muted-foreground">{member.role}</p>}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* action rail: the only card on the page */}
        <aside className="lg:sticky lg:top-24">
          <Card className="shadow-sm">
            <CardContent className="space-y-5 p-5">
              <div>
                <h2 className="flex items-center gap-2 text-item">
                  <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
                  Where to find them
                </h2>

                {booth ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'rounded-lg bg-primary px-4 py-2.5 font-mono text-section text-primary-foreground'
                        )}
                      >
                        {booth.label}
                      </span>
                      <Badge variant={BOOTH_STATUS_VARIANTS[booth.status]}>
                        {BOOTH_STATUS_LABELS[booth.status]}
                      </Badge>
                    </div>

                    {expo && (
                      <Button asChild variant="outline" size="sm" className="w-full">
                        <Link to={`/attendee/floor-plan?expo=${expo.id}&booth=${booth.id}`}>
                          <LayoutGrid className="size-4" aria-hidden="true" />
                          Show on the floor plan
                        </Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-body text-muted-foreground">
                    They have not been allocated a booth yet. Check back closer to the event.
                  </p>
                )}
              </div>

              {hasContact && (
                <div className="border-t border-border pt-5">
                  <h2 className="text-item">Contact</h2>
                  <dl className="mt-3 space-y-2 text-body text-muted-foreground">
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                        <dt className="sr-only">Email</dt>
                        <dd className="truncate">{contact.email}</dd>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                        <dt className="sr-only">Phone</dt>
                        <dd>{contact.phone}</dd>
                      </div>
                    )}
                    {contact.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="size-3.5 shrink-0" aria-hidden="true" />
                        <dt className="sr-only">Website</dt>
                        <dd className="truncate">
                          <a
                            href={contact.website}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="hover:text-foreground hover:underline"
                          >
                            {contact.website.replace(/^https?:\/\//, '')}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
