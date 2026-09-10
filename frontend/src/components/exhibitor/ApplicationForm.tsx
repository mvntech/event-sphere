import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { FileDropzone } from '@/components/exhibitor/FileDropzone';
import { cleanProducts, cleanStaff, ProductsEditor, StaffEditor } from '@/components/exhibitor/ListEditors';
import { useApplyAsExhibitor } from '@/hooks/useExhibitors';
import { ApiError } from '@/lib/api';
import { MAX_DOCUMENTS } from '@/lib/uploads';
import { formatDateRange } from '@/lib/format';
import type { ExhibitorProduct, ExhibitorStaff, Expo } from '@/types';

/** mirrors backend/src/validators/exhibitorValidators.js. */
const applicationSchema = z.object({
  expoRef: z.string().min(1, 'Choose which expo you are applying to'),
  companyName: z.string().trim().min(2, 'Enter your company name').max(140),
  description: z
    .string()
    .trim()
    .min(20, 'Tell organizers at least a couple of sentences about the company')
    .max(4000, 'That description is too long'),
  category: z.string().trim().min(2, 'What sector are you in?').max(80),
  contactEmail: z.union([z.string().trim().email('Enter a valid email address'), z.literal('')]),
  contactPhone: z.string().trim().max(40),
  contactWebsite: z.union([z.string().trim().url('Enter a full URL, including https://'), z.literal('')]),
});

type ApplicationValues = z.infer<typeof applicationSchema>;

interface Props {
  /** expos currently open to applications. */
  expos: Expo[];
  /** expos this exhibitor has already applied to — excluded from the picker. */
  appliedExpoIds: string[];
}

export function ApplicationForm({ expos, appliedExpoIds }: Props) {
  const [products, setProducts] = useState<ExhibitorProduct[]>([]);
  const [staff, setStaff] = useState<ExhibitorStaff[]>([]);
  const [logo, setLogo] = useState<File[]>([]);
  const [documents, setDocuments] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);

  const apply = useApplyAsExhibitor(setProgress);

  const available = expos.filter((expo) => !appliedExpoIds.includes(expo.id));

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      expoRef: available[0]?.id ?? '',
      companyName: '',
      description: '',
      category: '',
      contactEmail: '',
      contactPhone: '',
      contactWebsite: '',
    },
  });

  const expoRef = watch('expoRef');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apply.mutateAsync({
        expoRef: values.expoRef,
        companyName: values.companyName,
        description: values.description,
        category: values.category,
        contact: {
          email: values.contactEmail,
          phone: values.contactPhone,
          website: values.contactWebsite,
        },
        products: cleanProducts(products),
        staff: cleanStaff(staff),
        logo: logo[0] ?? null,
        documents,
      });

      toast.success('Application submitted', {
        description: 'The organizers will review it and email you their decision.',
      });

      reset();
      setProducts([]);
      setStaff([]);
      setLogo([]);
      setDocuments([]);
    } catch (error) {
      if (error instanceof ApiError) {
        error.fieldErrors.forEach((fieldError) => {
          const map: Record<string, keyof ApplicationValues> = {
            companyName: 'companyName',
            description: 'description',
            category: 'category',
            expoRef: 'expoRef',
            'contact.email': 'contactEmail',
            'contact.website': 'contactWebsite',
          };
          const field = map[fieldError.field];
          if (field) setError(field, { message: fieldError.message });
        });
        toast.error(error.message);
      } else {
        toast.error('Could not submit your application');
      }
    } finally {
      setProgress(0);
    }
  });

  if (available.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apply to exhibit</CardTitle>
        <CardDescription>
          Tell organizers about your company. They review every application and email you the outcome.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <Field id="application-expo" label="Which expo?" error={errors.expoRef?.message}>
            {(props) => (
              <Select value={expoRef} onValueChange={(value) => setValue('expoRef', value)}>
                <SelectTrigger
                  id={props.id}
                  aria-invalid={props['aria-invalid']}
                  aria-describedby={props['aria-describedby']}
                >
                  <SelectValue placeholder="Choose an expo" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((expo) => (
                    <SelectItem key={expo.id} value={expo.id}>
                      {expo.title} · {formatDateRange(expo.startDate, expo.endDate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="application-company" label="Company name" error={errors.companyName?.message}>
              {(props) => <Input {...props} {...register('companyName')} placeholder="Helix Robotics" />}
            </Field>

            <Field
              id="application-category"
              label="Category"
              error={errors.category?.message}
              hint="How attendees will filter for you"
            >
              {(props) => <Input {...props} {...register('category')} placeholder="Robotics" />}
            </Field>
          </div>

          <Field
            id="application-description"
            label="About the company"
            error={errors.description?.message}
            hint="Shown on your public exhibitor profile once approved."
          >
            {(props) => (
              <Textarea
                {...props}
                {...register('description')}
                rows={4}
                placeholder="We build collaborative warehouse robots for small and mid-size logistics operators."
              />
            )}
          </Field>

          <Separator />

          <div className="grid gap-5 sm:grid-cols-3">
            <Field id="application-email" label="Contact email" error={errors.contactEmail?.message}>
              {(props) => <Input {...props} type="email" {...register('contactEmail')} placeholder="hello@helix.com" />}
            </Field>
            <Field id="application-phone" label="Phone" error={errors.contactPhone?.message}>
              {(props) => <Input {...props} {...register('contactPhone')} placeholder="+92 300 1234567" />}
            </Field>
            <Field id="application-website" label="Website" error={errors.contactWebsite?.message}>
              {(props) => <Input {...props} {...register('contactWebsite')} placeholder="https://helix.com" />}
            </Field>
          </div>

          <Separator />

          <ProductsEditor value={products} onChange={setProducts} />
          <StaffEditor value={staff} onChange={setStaff} />

          <Separator />

          <div className="grid gap-5 sm:grid-cols-2">
            <FileDropzone kind="logo" label="Company logo" files={logo} onChange={setLogo} />
            <FileDropzone
              kind="document"
              label="Supporting documents"
              hint="Company profile, brochures, certifications."
              files={documents}
              onChange={setDocuments}
              multiple
              maxFiles={MAX_DOCUMENTS}
            />
          </div>

          {isSubmitting && progress > 0 && progress < 100 && (
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-meta text-muted-foreground" role="status">
                Uploading… {progress}%
              </p>
            </div>
          )}

          <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
            <Send className="size-4" aria-hidden="true" />
            Submit application
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
