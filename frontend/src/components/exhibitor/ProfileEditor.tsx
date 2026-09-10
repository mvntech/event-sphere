import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CalendarDays, FileText, MapPin, Save, Trash2, Upload } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { FileDropzone } from '@/components/exhibitor/FileDropzone';
import { cleanProducts, cleanStaff, ProductsEditor, StaffEditor } from '@/components/exhibitor/ListEditors';
import {
  useDeleteDocument,
  useUpdateExhibitorProfile,
  useUploadDocuments,
  useUploadLogo,
} from '@/hooks/useExhibitors';
import { ApiError } from '@/lib/api';
import { formatBytes, formatDateRange } from '@/lib/format';
import { MAX_DOCUMENTS } from '@/lib/uploads';
import {
  APPROVAL_LABELS,
  APPROVAL_VARIANTS,
  type ExhibitorProduct,
  type ExhibitorProfile,
  type ExhibitorStaff,
} from '@/types';

const profileSchema = z.object({
  companyName: z.string().trim().min(2, 'Enter your company name').max(140),
  description: z.string().trim().min(20, 'At least a couple of sentences').max(4000),
  category: z.string().trim().min(2, 'What sector are you in?').max(80),
  contactEmail: z.union([z.string().trim().email('Enter a valid email address'), z.literal('')]),
  contactPhone: z.string().trim().max(40),
  contactWebsite: z.union([z.string().trim().url('Enter a full URL, including https://'), z.literal('')]),
});

type ProfileValues = z.infer<typeof profileSchema>;

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

export function ProfileEditor({ profile }: { profile: ExhibitorProfile }) {
  const expo = typeof profile.expoRef === 'string' ? null : profile.expoRef;

  const updateProfile = useUpdateExhibitorProfile();
  const uploadLogo = useUploadLogo();
  const uploadDocuments = useUploadDocuments();
  const deleteDocument = useDeleteDocument();

  const [products, setProducts] = useState<ExhibitorProduct[]>(profile.products);
  const [staff, setStaff] = useState<ExhibitorStaff[]>(profile.staff);
  const [newDocuments, setNewDocuments] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      companyName: profile.companyName,
      description: profile.description,
      category: profile.category,
      contactEmail: profile.contact.email ?? '',
      contactPhone: profile.contact.phone ?? '',
      contactWebsite: profile.contact.website ?? '',
    },
  });

  // re-sync when a refetch brings newer server data for this profile.
  useEffect(() => {
    reset({
      companyName: profile.companyName,
      description: profile.description,
      category: profile.category,
      contactEmail: profile.contact.email ?? '',
      contactPhone: profile.contact.phone ?? '',
      contactWebsite: profile.contact.website ?? '',
    });
    setProducts(profile.products);
    setStaff(profile.staff);
  }, [profile, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await updateProfile.mutateAsync({
        id: profile.id,
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
      });
      toast.success('Profile updated');
    } catch (error) {
      if (error instanceof ApiError) {
        error.fieldErrors.forEach((fieldError) => {
          if (fieldError.field in values) {
            setError(fieldError.field as keyof ProfileValues, { message: fieldError.message });
          }
        });
        toast.error(error.message);
      } else {
        toast.error('Could not save your profile');
      }
    }
  });

  const handleLogo = async (files: File[]) => {
    if (!files.length) return;
    try {
      await uploadLogo.mutateAsync({ id: profile.id, file: files[0] });
      toast.success('Logo updated');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not upload the logo');
    }
  };

  const handleDocuments = async () => {
    if (!newDocuments.length) return;
    try {
      await uploadDocuments.mutateAsync({ id: profile.id, files: newDocuments });
      toast.success(`${newDocuments.length} document(s) uploaded`);
      setNewDocuments([]);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not upload the documents');
    }
  };

  const removeDocument = async (documentId: string, filename: string) => {
    try {
      await deleteDocument.mutateAsync({ id: profile.id, documentId });
      toast.success(`"${filename}" removed`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Could not remove the document');
    }
  };

  const documentsRemaining = MAX_DOCUMENTS - profile.documents.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar className="size-14 rounded-lg">
                {profile.logoUrl && <AvatarImage src={profile.logoUrl} alt="" />}
                <AvatarFallback className="rounded-lg">{initials(profile.companyName)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>{profile.companyName}</CardTitle>
                {expo && (
                  <CardDescription className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      {expo.title}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {expo.location}
                    </span>
                    <span>{formatDateRange(expo.startDate, expo.endDate)}</span>
                  </CardDescription>
                )}
              </div>
            </div>
            <Badge variant={APPROVAL_VARIANTS[profile.approvalStatus]}>
              {APPROVAL_LABELS[profile.approvalStatus]}
            </Badge>
          </div>
        </CardHeader>

        {profile.reviewNote && (
          <CardContent className="pt-0">
            <p className="rounded-lg border-l-2 border-border bg-muted px-4 py-3 text-body">
              <span className="font-medium">Note from the organizers: </span>
              <span className="text-muted-foreground">{profile.reviewNote}</span>
            </p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
          <CardDescription>
            These details appear on your public exhibitor page once your application is approved.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="profile-company" label="Company name" error={errors.companyName?.message}>
                {(props) => <Input {...props} {...register('companyName')} />}
              </Field>
              <Field id="profile-category" label="Category" error={errors.category?.message}>
                {(props) => <Input {...props} {...register('category')} />}
              </Field>
            </div>

            <Field id="profile-description" label="About the company" error={errors.description?.message}>
              {(props) => <Textarea {...props} {...register('description')} rows={4} />}
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field id="profile-email" label="Contact email" error={errors.contactEmail?.message}>
                {(props) => <Input {...props} type="email" {...register('contactEmail')} />}
              </Field>
              <Field id="profile-phone" label="Phone" error={errors.contactPhone?.message}>
                {(props) => <Input {...props} {...register('contactPhone')} />}
              </Field>
              <Field id="profile-website" label="Website" error={errors.contactWebsite?.message}>
                {(props) => <Input {...props} {...register('contactWebsite')} />}
              </Field>
            </div>

            <Separator />

            <ProductsEditor value={products} onChange={setProducts} />
            <StaffEditor value={staff} onChange={setStaff} />

            <Button type="submit" loading={isSubmitting}>
              <Save className="size-4" aria-hidden="true" />
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>Replacing the logo removes the previous file from storage.</CardDescription>
        </CardHeader>
        <CardContent>
          <FileDropzone
            kind="logo"
            label="Upload a new logo"
            files={[]}
            onChange={handleLogo}
            disabled={uploadLogo.isPending}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            {profile.documents.length} of {MAX_DOCUMENTS} attached
            {documentsRemaining > 0 ? ` · ${documentsRemaining} slot${documentsRemaining === 1 ? '' : 's'} left` : ' · limit reached'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {profile.documents.length > 0 && (
            <ul className="space-y-2">
              {profile.documents.map((doc) => (
                <li key={doc._id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="min-w-0 flex-1 truncate text-body hover:underline"
                  >
                    {doc.filename}
                  </a>
                  <span className="shrink-0 text-meta text-muted-foreground">{formatBytes(doc.bytes)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeDocument(doc._id, doc.filename)}
                    aria-label={`Remove ${doc.filename}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {documentsRemaining > 0 && (
            <>
              <FileDropzone
                kind="document"
                label="Add documents"
                files={newDocuments}
                onChange={setNewDocuments}
                multiple
                maxFiles={documentsRemaining}
                disabled={uploadDocuments.isPending}
              />
              {newDocuments.length > 0 && (
                <Button type="button" onClick={handleDocuments} loading={uploadDocuments.isPending}>
                  <Upload className="size-4" aria-hidden="true" />
                  Upload {newDocuments.length} document{newDocuments.length === 1 ? '' : 's'}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
