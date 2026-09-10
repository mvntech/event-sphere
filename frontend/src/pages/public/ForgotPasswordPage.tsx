import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { http, ApiError } from '@/lib/api';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/validators';

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const data = await http.post<{ previewUrl?: string } | null>('/auth/forgot-password', values);
      setPreviewUrl(data?.previewUrl ?? null);
      setSentTo(values.email);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  });

  if (sentTo) {
    return (
      <div>
        <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-title">Check your inbox</h1>
        <p className="mt-2 text-body text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, we've sent a reset
          link. It expires in 30 minutes — check your spam folder if it doesn't show up.
        </p>

        {previewUrl && (
          <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4 text-body">
            <p className="font-semibold">Development mode</p>
            <p className="mt-1 text-muted-foreground">
              SMTP isn't configured, so the email went to a test inbox.{' '}
              <a href={previewUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-4">
                Open the preview
              </a>
            </p>
          </div>
        )}

        <Button asChild variant="outline" className="mt-8">
          <Link to="/login">
            <ArrowLeft /> Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-title">Reset your password</h1>
      <p className="mt-2 text-body text-muted-foreground">
        Enter the email on your account and we'll send you a link to set a new password.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-body font-medium text-destructive">
            {formError}
          </div>
        )}

        <Field id="email" label="Email" error={errors.email?.message}>
          {(props) => (
            <Input {...props} type="email" autoComplete="email" placeholder="you@company.com" {...register('email')} />
          )}
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Send reset link
        </Button>
      </form>

      <Button asChild variant="ghost" className="mt-6 -ml-3">
        <Link to="/login">
          <ArrowLeft /> Back to sign in
        </Link>
      </Button>
    </div>
  );
}
