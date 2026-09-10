import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { MessageSquarePlus, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useSubmitFeedback } from '@/hooks/useFeedback';
import { useExpos } from '@/hooks/useExpos';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { FEEDBACK_CATEGORY_LABELS, type FeedbackCategory } from '@/types';

/** mirrors backend/src/validators/feedbackValidators.js. */
const feedbackSchema = z.object({
  content: z
    .string()
    .trim()
    .min(10, 'Tell us a little more — at least 10 characters')
    .max(4000, 'That is longer than we can accept'),
  category: z.enum(['general', 'session', 'exhibitor', 'venue', 'technical']),
});

type FeedbackValues = z.infer<typeof feedbackSchema>;

const CATEGORIES = Object.keys(FEEDBACK_CATEGORY_LABELS) as FeedbackCategory[];

/** feedback is open to every role. */
export function FeedbackDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [expoRef, setExpoRef] = useState<string>('');

  const submit = useSubmitFeedback();
  const { data: expos } = useExpos({ limit: 50 });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FeedbackValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { content: '', category: 'general' },
  });

  const category = watch('category');
  const options = expos?.items ?? [];

  const onSubmit = handleSubmit(async (values) => {
    try {
      await submit.mutateAsync({
        content: values.content,
        category: values.category,
        // feedback not tied to an expo is still accepted.
        ...(expoRef ? { expoRef } : {}),
        ...(rating > 0 ? { rating } : {}),
      });

      toast.success('Thanks — your feedback has been sent', {
        description: 'The organizers can see it in their inbox.',
      });

      reset();
      setRating(0);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not send your feedback');
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <MessageSquarePlus className="size-4" aria-hidden="true" />
            Give feedback
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share your feedback</DialogTitle>
          <DialogDescription>
            Tell the organizers what worked and what did not. They see every submission.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="contents">
          <DialogBody className="space-y-5">
            {options.length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="feedback-expo">Which expo?</Label>
                <Select value={expoRef} onValueChange={setExpoRef}>
                  <SelectTrigger id="feedback-expo">
                    <SelectValue placeholder="Choose an expo (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((expo) => (
                      <SelectItem key={expo.id} value={expo.id}>
                        {expo.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Field id="feedback-category" label="What is it about?" error={errors.category?.message}>
              {(props) => (
                <Select value={category} onValueChange={(v) => setValue('category', v as FeedbackCategory)}>
                  <SelectTrigger id={props.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {FEEDBACK_CATEGORY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-body font-medium">How would you rate it?</legend>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(rating === value ? 0 : value)}
                    aria-label={`${value} out of 5`}
                    aria-pressed={rating >= value}
                    className="rounded-md p-1 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Star
                      className={cn(
                        'size-6 transition-colors',
                        rating >= value ? 'fill-primary text-primary' : 'text-muted-foreground'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
              <p className="text-meta text-muted-foreground">Optional</p>
            </fieldset>

            <Field id="feedback-content" label="Your feedback" error={errors.content?.message}>
              {(props) => (
                <Textarea
                  {...props}
                  {...register('content')}
                  rows={5}
                  placeholder="The robotics hall was excellent, but the signage getting there was hard to follow."
                />
              )}
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Send feedback
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
