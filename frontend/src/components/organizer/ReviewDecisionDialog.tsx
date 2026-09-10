import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import { useReviewExhibitor } from '@/hooks/useExhibitors';
import { ApiError } from '@/lib/api';
import type { ExhibitorProfile } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ExhibitorProfile | null;
  decision: 'approved' | 'rejected';
}

/** confirms an approve/reject and captures the note the exhibitor is emailed. */
export function ReviewDecisionDialog({ open, onOpenChange, profile, decision }: Props) {
  const review = useReviewExhibitor();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();

  const isRejection = decision === 'rejected';

  useEffect(() => {
    if (open) {
      setNote('');
      setError(undefined);
    }
  }, [open]);

  const submit = async () => {
    if (!profile) return;

    // the server requires a reason on rejection; check here so the user
    // finds out before a round trip.
    if (isRejection && note.trim().length < 5) {
      setError('Give the exhibitor a short reason for the rejection');
      return;
    }

    try {
      await review.mutateAsync({ id: profile.id, approvalStatus: decision, reviewNote: note.trim() });
      toast.success(
        isRejection ? `${profile.companyName} was rejected` : `${profile.companyName} is approved`,
        { description: 'They have been emailed the decision.' }
      );
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not save the decision';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRejection ? 'Reject' : 'Approve'} {profile?.companyName}?
          </DialogTitle>
          <DialogDescription>
            {isRejection
              ? 'They will be emailed the decision along with your reason.'
              : 'They will be emailed a confirmation and can then set up their booth.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Field
            id="review-note"
            label={isRejection ? 'Reason for rejection' : 'Note to the exhibitor'}
            error={error}
            hint={isRejection ? undefined : 'Optional — included in their confirmation email.'}
          >
            {(props) => (
              <Textarea
                {...props}
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  setError(undefined);
                }}
                rows={4}
                placeholder={
                  isRejection
                    ? 'The robotics hall is fully booked this year.'
                    : 'Great fit — we have placed you in the robotics hall.'
                }
              />
            )}
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={isRejection ? 'destructive' : 'default'}
            loading={review.isPending}
            onClick={submit}
          >
            {isRejection ? 'Reject application' : 'Approve application'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
