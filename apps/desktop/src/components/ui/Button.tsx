import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/util';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-bg-elevated text-text hover:bg-neutral-800 border border-border',
        primary: 'bg-accent text-bg hover:bg-yellow-300 font-semibold',
        ghost: 'text-text-muted hover:bg-bg-elevated hover:text-text',
        danger: 'bg-error/20 text-error hover:bg-error/30 border border-error/40',
        outline: 'border border-border text-text hover:bg-bg-elevated',
      },
      size: {
        sm: 'h-7 px-2 text-xs',
        md: 'h-8 px-3 text-13',
        lg: 'h-10 px-4 text-sm',
        icon: 'h-7 w-7 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
