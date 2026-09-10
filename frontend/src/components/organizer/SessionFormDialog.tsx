import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateSession, useUpdateSession } from '@/hooks/useSessions';
import { ApiError } from '@/lib/api';
import { toDateTimeLocal } from '@/lib/format';
import type { Session } from '@/types';

/** mirrors backend/src/validators/sessionValidators.js. */
const sessionFormSchema = z
  .object({
    title: z.string().trim().min(3, 'Give the session a title').max(160),
    speaker: z.string().trim().min(2, 'Who is presenting?').max(120),
    topic: z.string().trim().min(2, 'What is the topic?').max(120),
    location: z.string().trim().min(2, 'Which room or stage?').max(160),
    description: z.string().trim().max(2000).optional(),
    startTime: z.string().min(1, 'Pick a start time'),
    endTime: z.string().min(1, 'Pick an end time'),
    // blank means unlimited seats.
    capacity: z
      .string()
      .optional()
      .refine((v) => !v || (Number(v) >= 1 && Number.isInteger(Number(v))), 'Capacity must be a whole number of 1 or more'),
  })
  .refine((v) => new Date(v.endTime) > new Date(v.startTime), {
    path: ['endTime'],
    message: 'End time must be after the start time',
  });

type SessionFormValues = z.infer<typeof sessionFormSchema>;

const emptyValues: SessionFormValues = {
  title: '',
  speaker: '',
  topic: '',
  location: '',
  description: '',
  startTime: '',
  endTime: '',
  capacity: '',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expoId: string;
  /** sensible default start time — the expo's first day at 9am. */
  defaultStart?: string;
  session?: Session | null;
}

export function SessionFormDialog({ open, onOpenChange, expoId, defaultStart, session }: Props) {
  const isEdit = Boolean(session);
  const createSession = useCreateSession(expoId);
  const updateSession = useUpdateSession(expoId);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SessionFormValues>({ resolver: zodResolver(sessionFormSchema), defaultValues: emptyValues });

  useEffect(() => {
    if (!open) return;
    reset(
      session
        ? {
            title: session.title,
            speaker: session.speaker,
            topic: session.topic,
            location: session.location,
            description: session.description ?? '',
            startTime: toDateTimeLocal(session.startTime),
            endTime: toDateTimeLocal(session.endTime),
            capacity: session.capacity == null ? '' : String(session.capacity),
          }
        : { ...emptyValues, startTime: defaultStart ?? '' }
    );
  }, [open, session, defaultStart, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      title: values.title,
      speaker: values.speaker,
      topic: values.topic,
      location: values.location,
      description: values.description ?? '',
      startTime: new Date(values.startTime).toISOString(),
      endTime: new Date(values.endTime).toISOString(),
      capacity: values.capacity ? Number(values.capacity) : null,
    };

    try {
      if (session) {
        await updateSession.mutateAsync({ id: session.id, ...payload });
        toast.success('Session updated');
      } else {
        await createSession.mutateAsync(payload);
        toast.success('Session added to the schedule');
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        error.fieldErrors.forEach((fieldError) => {
          if (fieldError.field in emptyValues) {
            setError(fieldError.field as keyof SessionFormValues, { message: fieldError.message });
          }
        });
        toast.error(error.message);
      } else {
        toast.error('Could not save the session');
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit session' : 'Add a session'}</DialogTitle>
          <DialogDescription>
            Sessions must start and end inside the expo's own dates.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="contents">
          <DialogBody className="space-y-5">
            <Field id="session-title" label="Title" error={errors.title?.message}>
              {(props) => <Input {...props} {...register('title')} placeholder="Designing for Accessibility" autoFocus />}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="session-speaker" label="Speaker" error={errors.speaker?.message}>
                {(props) => <Input {...props} {...register('speaker')} placeholder="Rina Malhotra" />}
              </Field>

              <Field id="session-topic" label="Topic" error={errors.topic?.message}>
                {(props) => <Input {...props} {...register('topic')} placeholder="Inclusive design" />}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="session-location" label="Location" error={errors.location?.message}>
                {(props) => <Input {...props} {...register('location')} placeholder="Workshop Room B" />}
              </Field>

              <Field
                id="session-capacity"
                label="Capacity"
                error={errors.capacity?.message}
                hint="Leave blank for unlimited seats"
              >
                {(props) => <Input {...props} type="number" min={1} {...register('capacity')} placeholder="40" />}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="session-start" label="Starts" error={errors.startTime?.message}>
                {(props) => <Input {...props} type="datetime-local" {...register('startTime')} />}
              </Field>

              <Field id="session-end" label="Ends" error={errors.endTime?.message}>
                {(props) => <Input {...props} type="datetime-local" {...register('endTime')} />}
              </Field>
            </div>

            <Field id="session-description" label="Description" error={errors.description?.message} hint="Optional">
              {(props) => (
                <Textarea {...props} {...register('description')} rows={3} placeholder="What attendees will take away." />
              )}
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isEdit ? 'Save changes' : 'Add session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
