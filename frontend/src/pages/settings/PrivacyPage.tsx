import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, ShieldAlert, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { ApiError, http } from '@/lib/api';
import { SettingsSection } from '@/components/shared/SettingsSection';
import { ROLE_LABELS } from '@/types';

interface DeletionCheck {
  canDelete: boolean;
  blockers: { reason: string; message: string; expos?: { id: string; title: string }[] }[];
}

/** mirrors privacyService.exportUserData — kept in step with it deliberately. */
const STORED = [
  { what: 'Your name, email and role', why: 'To sign you in and show who you are to people you message.' },
  { what: 'Your consent record and the date you registered', why: 'To show we asked before storing anything.' },
  { what: 'Email notification preference', why: 'To decide whether reminders reach you outside the app.' },
  { what: 'Sessions you registered for or bookmarked', why: 'To build your schedule and send reminders.' },
  { what: 'Messages you have sent', why: 'So conversations you started still read for the other person.' },
  { what: 'Feedback you have submitted', why: 'So organizers can act on it.' },
  { what: 'Notifications addressed to you', why: 'To show what changed while you were away.' },
  { what: 'Your exhibitor profile, if you have one', why: 'To list your company and stand at an expo.' },
];

export default function PrivacyPage() {
  const { user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const check = useQuery({
    queryKey: ['users', 'me', 'deletion-check'],
    queryFn: () => http.get<DeletionCheck>('/users/me/deletion-check'),
  });

  const emailOn = user?.notificationPrefs?.email ?? true;

  const toggleEmail = async (next: boolean) => {
    setSaving(true);
    try {
      await updateProfile({ notificationPrefs: { email: next } });
      toast.success(next ? 'Email notifications on' : 'Email notifications off');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not save that preference');
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const blob = await http.download('/users/me/export');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eventsphere-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Your data is downloading');
    } catch {
      toast.error('Could not prepare your data just now. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      const result = await http.delete<{ retentionDays: number }>('/users/me');
      toast.success('Account deleted', {
        description: `Your details have been removed. The remaining record is erased after ${result.retentionDays} days.`,
      });
      setTimeout(() => window.location.assign('/'), 1200);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not delete your account');
      setDeleting(false);
    }
  };

  const blockers = check.data?.blockers ?? [];
  const canDelete = check.data?.canDelete ?? false;

  return (
    <div>
      <SettingsSection
        title="What EventSphere stores about you"
        hint="Written against the database itself, not a summary of it. Everything named here appears in the export below."
        footnote={user ? `Signed in as ${user.email} · ${ROLE_LABELS[user.role]}` : undefined}
      >
        <dl className="divide-y divide-border rounded-xl border border-border bg-card">
          {STORED.map((row) => (
            <div key={row.what} className="grid gap-1 p-4 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:gap-6">
              <dt className="text-body font-medium">{row.what}</dt>
              <dd className="text-body text-muted-foreground">{row.why}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>

      {/* email preference */}
      <SettingsSection title="Email" hint="One switch, for messages that reach you outside the app.">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4">
          <Checkbox
            checked={emailOn}
            disabled={saving}
            onCheckedChange={(value) => toggleEmail(value === true)}
            aria-describedby="email-pref-hint"
          />
          <span>
            <span className="text-body font-medium">Send me email about my expos</span>
            <span id="email-pref-hint" className="mt-1 block text-body text-muted-foreground">
              Session reminders, booth confirmations and application decisions. Password resets are always
              sent — turning this off cannot lock you out of your own account.
            </span>
          </span>
        </label>
      </SettingsSection>

      {/* export */}
      <SettingsSection
        title="Take a copy"
        hint="A JSON file with everything above. Messages other people sent you are not included — that is their writing, not your data."
      >
        <Button onClick={exportData} loading={exporting}>
          <Download className="size-4" aria-hidden="true" />
          Download my data
        </Button>
      </SettingsSection>

      {/* deletion */}
      <SettingsSection
        title="Delete your account"
        hint="Irreversible. Read what stays behind before you do it."
      >
        <Card className="border-destructive/40 shadow-sm">
          <CardContent className="space-y-4 p-5">
            <p className="text-body text-muted-foreground">
              Your name, email and picture are removed immediately and you are signed out. Anything other
              people can still see — a message thread you were part of, feedback an organizer is working
              through — stays, without your name on it. The remaining record is erased after 30 days.
            </p>

            {check.isPending && (
              <p className="flex items-center gap-2 text-body text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Checking whether anything blocks this…
              </p>
            )}

            {blockers.map((blocker) => (
              <div
                key={blocker.reason}
                role="status"
                className="rounded-lg border border-warning/40 bg-warning/10 p-4"
              >
                <p className="flex items-center gap-2 text-body font-medium">
                  <ShieldAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />
                  You cannot delete this account yet
                </p>
                <p className="mt-1.5 text-body text-muted-foreground">{blocker.message}</p>
                {blocker.expos && blocker.expos.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {blocker.expos.map((expo) => (
                      <li key={expo.id}>
                        <Badge variant="muted">{expo.title}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {!check.isPending && canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Delete my account</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                    Delete your account?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This cannot be undone. Your details are removed straight away and you will be signed out.
                  </AlertDialogDescription>

                  <div className="grid gap-2 py-2">
                    <Label htmlFor="confirm-delete">
                      Type <span className="font-mono font-semibold">DELETE</span> to confirm
                    </Label>
                    <Input
                      id="confirm-delete"
                      value={confirmText}
                      onChange={(event) => setConfirmText(event.target.value)}
                      autoComplete="off"
                    />
                  </div>

                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmText('')}>Keep my account</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={confirmText !== 'DELETE' || deleting}
                      onClick={(event) => {
                        event.preventDefault();
                        deleteAccount();
                      }}
                    >
                      {deleting ? 'Deleting…' : 'Delete permanently'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      </SettingsSection>
    </div>
  );
}
