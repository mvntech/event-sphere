import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern';
import { ApiError, http } from '@/lib/api';
import { contactSchema, type ContactValues } from '@/lib/validators';

const CATEGORIES: { value: ContactValues['category']; label: string }[] = [
  { value: 'general', label: 'General enquiry' },
  { value: 'exhibitor', label: 'Exhibiting at an expo' },
  { value: 'session', label: 'A session or speaker' },
  { value: 'venue', label: 'Venue and access' },
  { value: 'technical', label: 'Something is broken' },
];

const CELL = 56;

function PlanGround() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <InteractiveGridPattern
        width={CELL}
        height={CELL}
        squares={[40, 14]}
        className="mask-[linear-gradient(to_bottom,var(--color-background)_0%,transparent_78%)]"
        squaresClassName="stroke-border"
      />
    </div>
  );
}

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', category: 'general', content: '' },
  });

  const category = watch('category');

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await http.post('/feedback/contact', values);
      setSent(true);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Could not send that just now. Please try again in a moment.'
      );
    }
  });

  return (
    <div className="relative">
      <PlanGround />

      <div className="container-page relative py-12 sm:py-16">
        <header className="max-w-2xl">
          <h1 className="text-title">Get in touch</h1>
          <p className="mt-3 text-lede text-muted-foreground">
            Questions about exhibiting, running an expo on EventSphere, or something that is not working —
            this reaches the team directly.
          </p>
        </header>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
            {sent ? (
              <div>
                <p className="flex items-center gap-2 text-item">
                  <CheckCircle2 className="size-4 shrink-0 text-live" aria-hidden="true" />
                  Message sent
                </p>
                <p className="mt-2 text-body text-muted-foreground">
                  Thanks — it has landed with the EventSphere team. If it needs an answer you will hear back at
                  the address you gave.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/expos">Browse what's on</Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSent(false)}>
                    Send another
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
                {formError && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-body"
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                    {formError}
                  </p>
                )}

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="contact-name" label="Your name" error={errors.name?.message}>
                    {(props) => <Input {...props} {...register('name')} placeholder="Ada Lovelace" />}
                  </Field>

                  <Field id="contact-email" label="Email" error={errors.email?.message}>
                    {(props) => (
                      <Input
                        {...props}
                        {...register('email')}
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                      />
                    )}
                  </Field>
                </div>

                <Field id="contact-category" label="What is it about?" error={errors.category?.message}>
                  {(props) => (
                    <Select
                      value={category}
                      onValueChange={(value) =>
                        setValue('category', value as ContactValues['category'], { shouldValidate: true })
                      }
                    >
                      <SelectTrigger id={props.id} aria-invalid={props['aria-invalid']}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>

                <Field
                  id="contact-content"
                  label="Message"
                  error={errors.content?.message}
                  hint="The more specific, the faster this gets to the right person."
                >
                  {(props) => (
                    <Textarea
                      {...props}
                      {...register('content')}
                      rows={6}
                      placeholder="We run a regional food expo and are looking at moving off spreadsheets…"
                    />
                  )}
                </Field>

                <div className="flex flex-wrap items-center gap-4">
                  <Button type="submit" loading={isSubmitting}>
                    Send message
                  </Button>
                  <p className="text-meta text-muted-foreground">
                    We keep your message and address only to reply to you.
                  </p>
                </div>
              </form>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card/80 p-5 shadow-xs">
              <h2 className="text-item">Already using EventSphere?</h2>
              <p className="mt-2 text-body text-muted-foreground">
                Sign in and use the feedback option in your dashboard — it comes through attached to your
                account and the relevant expo, which gets you a faster answer.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/login">Sign in</Link>
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card/80 p-5 shadow-xs">
              <h2 className="text-item">Want to exhibit?</h2>
              <p className="mt-2 text-body text-muted-foreground">
                You do not need to email us first. Create an exhibitor account, pick the expo, and apply to the
                organizer directly.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/register">Create an account</Link>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
