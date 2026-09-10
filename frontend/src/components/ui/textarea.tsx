import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-24 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-body text-foreground shadow-2xs transition-colors',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:border-ring focus-visible:shadow-[inset_0_0_0_1px_var(--color-ring)]',
      'disabled:cursor-not-allowed disabled:opacity-60',
      'aria-[invalid=true]:border-destructive',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Textarea };
