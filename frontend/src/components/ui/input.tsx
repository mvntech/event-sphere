import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-11 w-full rounded-lg border border-input bg-card px-3.5 py-2 text-body text-foreground shadow-2xs transition-colors',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:border-ring focus-visible:shadow-[inset_0_0_0_1px_var(--color-ring)]',
      'disabled:cursor-not-allowed disabled:opacity-60',
      'aria-[invalid=true]:border-destructive',
      'file:border-0 file:bg-transparent file:text-body file:font-medium',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
