import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { loginSchema, type LoginValues } from '@/lib/validators';
import { ROLE_HOME } from '@/types';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? ROLE_HOME[user.role], { replace: true });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
      setFormError(message);
    }
  });

  return (
    <div>
      <h1 className="text-title">Welcome back</h1>
      <p className="mt-2 text-body text-muted-foreground">
        Sign in to pick up where you left off.
      </p>

      {(location.state as { pendingApproval?: boolean } | null)?.pendingApproval && (
        <p
          role="status"
          className="mt-5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-body"
        >
          Your organizer account was created. An existing organizer has to approve it before you can sign in —
          you will be emailed once it is reviewed.
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
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

        <Field id="password" label="Password" error={errors.password?.message}>
          {(props) => (
            <div className="relative">
              <Input
                {...props}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
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
          )}
        </Field>

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="rounded-md text-body font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-7 border-t border-border pt-5 text-body text-muted-foreground">
        New to EventSphere?{' '}
        <Link to="/register" className="font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
