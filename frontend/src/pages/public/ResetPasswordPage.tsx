import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { http, ApiError } from '@/lib/api';
import { passwordStrength, resetPasswordSchema, type ResetPasswordValues } from '@/lib/validators';
import { cn } from '@/lib/utils';

const STRENGTH_COLORS = ['bg-muted', 'bg-destructive', 'bg-warning', 'bg-primary', 'bg-success'];

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const password = watch('password') ?? '';
  const strength = passwordStrength(password);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await http.post('/auth/reset-password', { token, password: values.password });
      toast.success('Password updated', { description: 'Sign in with your new password.' });
      navigate('/login', { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  });

  if (!token) {
    return (
      <div>
        <span className="grid size-11 place-items-center rounded-lg bg-destructive/10 text-destructive">
          <ShieldAlert className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-title">This link is incomplete</h1>
        <p className="mt-2 text-body text-muted-foreground">
          The reset link is missing its token. Request a fresh one and use the newest email.
        </p>
        <Button asChild className="mt-8">
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-title">Set a new password</h1>
      <p className="mt-2 text-body text-muted-foreground">
        Choose something you haven't used before. Every other device will be signed out.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-body font-medium text-destructive">
            {formError}
          </div>
        )}

        <Field
          id="password"
          label="New password"
          error={errors.password?.message}
          hint="At least 8 characters, with an uppercase letter and a number."
        >
          {(props) => (
            <div className="space-y-2">
              <div className="relative">
                <Input
                  {...props}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="pr-11"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1" aria-hidden="true">
                    {[1, 2, 3, 4].map((step) => (
                      <span
                        key={step}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-colors',
                          step <= strength.score ? STRENGTH_COLORS[strength.score] : 'bg-muted'
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-meta font-medium text-muted-foreground">{strength.label}</span>
                </div>
              )}
            </div>
          )}
        </Field>

        <Field id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
          {(props) => (
            <Input
              {...props}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              {...register('confirmPassword')}
            />
          )}
        </Field>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Update password
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
