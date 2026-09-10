import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Eye, EyeOff, Ticket, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { passwordStrength, registerSchema, type RegisterValues } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { ROLE_HOME, type Role } from '@/types';

const ROLE_OPTIONS: { value: Role; label: string; description: string; icon: typeof Users }[] = [
  { value: 'attendee', label: 'Attendee', description: 'Browse expos, book sessions, meet exhibitors', icon: Ticket },
  { value: 'exhibitor', label: 'Exhibitor', description: 'Showcase your company and reserve a booth', icon: Building2 },
  { value: 'organizer', label: 'Organizer', description: 'Run the expo: floor plans, schedule, analytics', icon: Users },
];

const STRENGTH_COLORS = ['bg-muted', 'bg-destructive', 'bg-warning', 'bg-primary', 'bg-success'];

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'attendee',
      consentGiven: false as unknown as true,
    },
  });

  const password = watch('password') ?? '';
  const strength = passwordStrength(password);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { user, pendingApproval } = await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        role: values.role,
        consentGiven: true,
      });

      // organizer accounts are inert until an existing organizer approves them,
      // so there is no session to send them into.
      if (pendingApproval) {
        toast.success('Account created', {
          description: 'An existing organizer needs to approve it before you can sign in.',
        });
        navigate('/login', { replace: true, state: { pendingApproval: true } });
        return;
      }

      toast.success('Account created', { description: `You're signed in as ${user.name}.` });
      navigate(ROLE_HOME[user.role], { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        error.fieldErrors.forEach((fieldError) => {
          if (fieldError.field in values) {
            setError(fieldError.field as keyof RegisterValues, { message: fieldError.message });
          }
        });
        setFormError(error.fieldErrors.length ? null : error.message);
        if (error.fieldErrors.length === 0) setFormError(error.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  });

  return (
    <div>
      <h1 className="text-title">Create your account</h1>
      <p className="mt-2 text-body text-muted-foreground">One account, whichever side of the expo floor you're on.</p>

      <form onSubmit={onSubmit} noValidate className="mt-7 space-y-5">
        {formError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-body font-medium text-destructive">
            {formError}
          </div>
        )}

        <fieldset className="space-y-3">
          <legend className="text-body font-medium">How will you use EventSphere?</legend>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-3">
                {ROLE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = field.value === option.value;
                  return (
                    <Label
                      key={option.value}
                      htmlFor={`role-${option.value}`}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all',
                        selected
                          ? 'border-primary bg-accent/60 shadow-2xs'
                          : 'border-border hover:border-muted-foreground/40 hover:bg-accent/30'
                      )}
                    >
                      <RadioGroupItem value={option.value} id={`role-${option.value}`} className="mt-1" />
                      <Icon className={cn('mt-1 size-4 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-body font-semibold">{option.label}</span>
                        <span className="mt-1 block text-meta font-normal text-muted-foreground">{option.description}</span>
                      </span>
                    </Label>
                  );
                })}
              </RadioGroup>
            )}
          />
          {errors.role && (
            <p role="alert" className="text-meta font-medium text-destructive">
              {errors.role.message}
            </p>
          )}
        </fieldset>

        <Field id="name" label="Full name" error={errors.name?.message}>
          {(props) => <Input {...props} autoComplete="name" placeholder="Ada Lovelace" {...register('name')} />}
        </Field>

        <Field id="email" label="Email" error={errors.email?.message}>
          {(props) => (
            <Input {...props} type="email" autoComplete="email" placeholder="you@company.com" {...register('email')} />
          )}
        </Field>

        <Field
          id="password"
          label="Password"
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

        <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
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
        
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <Controller
              control={control}
              name="consentGiven"
              render={({ field }) => (
                <Checkbox
                  id="consentGiven"
                  checked={!!field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  aria-describedby={errors.consentGiven ? 'consent-error' : undefined}
                  aria-invalid={!!errors.consentGiven}
                  className="mt-1"
                />
              )}
            />
            <Label htmlFor="consentGiven" className="cursor-pointer text-body font-normal leading-relaxed text-muted-foreground">
              I agree to EventSphere storing my account details to run the events I take part in, and I can export or
              delete my data at any time.
            </Label>
          </div>
          {errors.consentGiven && (
            <p id="consent-error" role="alert" className="text-meta font-medium text-destructive">
              {errors.consentGiven.message}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-7 border-t border-border pt-5 text-body text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
