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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateExpo, useUpdateExpo } from '@/hooks/useExpos';
import { ApiError } from '@/lib/api';
import { toDateInput } from '@/lib/format';
import { EXPO_STATUS_LABELS, type Expo, type ExpoStatus } from '@/types';

/** mirrors backend/src/validators/expoValidators.js. */
const expoFormSchema = z
  .object({
    title: z.string().trim().min(3, 'Give the expo a name of at least 3 characters').max(140),
    description: z
      .string()
      .trim()
      .min(20, 'Give attendees at least a couple of sentences')
      .max(4000, 'That description is too long'),
    theme: z.string().trim().max(120).optional(),
    location: z.string().trim().min(3, 'Where is it happening?').max(200),
    startDate: z.string().min(1, 'Pick a start date'),
    endDate: z.string().min(1, 'Pick an end date'),
    status: z.enum(['draft', 'published', 'ongoing', 'completed', 'cancelled']),
  })
  .refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
    path: ['endDate'],
    message: 'End date must be on or after the start date',
  });

type ExpoFormValues = z.infer<typeof expoFormSchema>;

const STATUS_OPTIONS: ExpoStatus[] = ['draft', 'published', 'ongoing', 'completed', 'cancelled'];

const emptyValues: ExpoFormValues = {
  title: '',
  description: '',
  theme: '',
  location: '',
  startDate: '',
  endDate: '',
  status: 'draft',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** omit to create; pass an expo to edit it. */
  expo?: Expo | null;
}

export function ExpoFormDialog({ open, onOpenChange, expo }: Props) {
  const isEdit = Boolean(expo);
  const createExpo = useCreateExpo();
  const updateExpo = useUpdateExpo();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpoFormValues>({ resolver: zodResolver(expoFormSchema), defaultValues: emptyValues });

  // refill whenever the dialog opens, so a reopened form never shows stale data.
  useEffect(() => {
    if (!open) return;
    reset(
      expo
        ? {
            title: expo.title,
            description: expo.description,
            theme: expo.theme ?? '',
            location: expo.location,
            startDate: toDateInput(expo.startDate),
            endDate: toDateInput(expo.endDate),
            status: expo.status,
          }
        : emptyValues
    );
  }, [open, expo, reset]);

  const status = watch('status');

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      ...values,
      theme: values.theme ?? '',
      // send whole days as ISO so the server stores an unambiguous instant.
      startDate: new Date(`${values.startDate}T00:00:00`).toISOString(),
      endDate: new Date(`${values.endDate}T23:59:59`).toISOString(),
    };

    try {
      if (expo) {
        await updateExpo.mutateAsync({ id: expo.id, ...payload });
        toast.success('Expo updated');
      } else {
        await createExpo.mutateAsync(payload);
        toast.success('Expo created');
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        // surface server-side field errors on the fields themselves.
        error.fieldErrors.forEach((fieldError) => {
          if (fieldError.field in emptyValues) {
            setError(fieldError.field as keyof ExpoFormValues, { message: fieldError.message });
          }
        });
        toast.error(error.message);
      } else {
        toast.error('Could not save the expo');
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit expo' : 'Create an expo'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the details attendees and exhibitors see.'
              : 'Expos start as a draft. Publish when you are ready for applications and registrations.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="contents">
          <DialogBody className="space-y-5">
            <Field id="expo-title" label="Title" error={errors.title?.message}>
              {(props) => <Input {...props} {...register('title')} placeholder="TechConnect Expo 2026" autoFocus />}
            </Field>

            <Field
              id="expo-description"
              label="Description"
              error={errors.description?.message}
              hint="Shown on the public expo page. A couple of sentences is plenty."
            >
              {(props) => (
                <Textarea
                  {...props}
                  {...register('description')}
                  rows={4}
                  placeholder="Three days of talks, workshops and 200+ exhibitors across robotics, climate tech and design."
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="expo-theme" label="Theme" error={errors.theme?.message} hint="Optional">
                {(props) => <Input {...props} {...register('theme')} placeholder="Emerging technology" />}
              </Field>

              <Field id="expo-location" label="Location" error={errors.location?.message}>
                {(props) => <Input {...props} {...register('location')} placeholder="Karachi Expo Centre" />}
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="expo-start" label="Start date" error={errors.startDate?.message}>
                {(props) => <Input {...props} type="date" {...register('startDate')} />}
              </Field>

              <Field id="expo-end" label="End date" error={errors.endDate?.message}>
                {(props) => <Input {...props} type="date" {...register('endDate')} />}
              </Field>
            </div>

            <Field
              id="expo-status"
              label="Status"
              error={errors.status?.message}
              hint="Only published expos accept exhibitor applications and attendee registrations."
            >
              {(props) => (
                <Select value={status} onValueChange={(value) => setValue('status', value as ExpoStatus)}>
                  <SelectTrigger id={props.id} aria-invalid={props['aria-invalid']} aria-describedby={props['aria-describedby']}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {EXPO_STATUS_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isEdit ? 'Save changes' : 'Create expo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
