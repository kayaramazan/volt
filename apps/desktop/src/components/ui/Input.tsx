import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/util';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-8 w-full rounded-md border bg-bg-elevated px-2.5 text-13 text-text placeholder:text-text-muted',
          'focus:outline-none focus:ring-1 focus:ring-accent',
          invalid ? 'border-error focus:ring-error' : 'border-border',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
