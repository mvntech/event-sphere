import { useState } from 'react';
import { Building2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { ApplicationForm } from '@/components/exhibitor/ApplicationForm';
import { ProfileEditor } from '@/components/exhibitor/ProfileEditor';
import { useMyApplications } from '@/hooks/useExhibitors';
import { useExpos } from '@/hooks/useExpos';
import { ApiError } from '@/lib/api';
import { APPROVAL_VARIANTS } from '@/types';

export default function ProfilePage() {
  const applications = useMyApplications();
  // only published expos take applications, which is what the server enforces too.
  const expos = useExpos({ status: 'published', limit: 50 });

  const [activeId, setActiveId] = useState<string>('');

  const items = applications.data?.items ?? [];
  const appliedExpoIds = items.map((item) =>
    typeof item.expoRef === 'string' ? item.expoRef : (item.expoRef?.id ?? '')
  );

  const active = items.find((item) => item.id === activeId) ?? items[0];

  return (
    <div className="mx-auto max-w-full space-y-8">
      <PageHeader
        title="Company profile"
        description="Apply to exhibit at an expo, then keep your company details, products and documents up to date."
      />

      {applications.isPending && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}

      {applications.isError && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start gap-3 p-6">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              {applications.error instanceof ApiError
                ? applications.error.message
                : 'Could not load your applications'}
            </p>
            <Button variant="outline" size="sm" onClick={() => applications.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {!applications.isPending && !applications.isError && (
        <>
          {items.length > 1 && (
            <Tabs value={active?.id} onValueChange={setActiveId}>
              <TabsList>
                {items.map((item) => (
                  <TabsTrigger key={item.id} value={item.id}>
                    {typeof item.expoRef === 'string' || !item.expoRef ? item.companyName : item.expoRef.title}
                    <Badge variant={APPROVAL_VARIANTS[item.approvalStatus]} className="ml-1">
                      {item.approvalStatus}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {active && <ProfileEditor key={active.id} profile={active} />}

          {items.length === 0 && (expos.data?.items.length ?? 0) === 0 && (
            <EmptyState
              icon={Building2}
              title="No expos are open for applications"
              description="Once an organizer publishes an expo, you will be able to apply to exhibit at it from here."
            />
          )}

          {(expos.data?.items.length ?? 0) > 0 && (
            <ApplicationForm expos={expos.data?.items ?? []} appliedExpoIds={appliedExpoIds} />
          )}
        </>
      )}
    </div>
  );
}
