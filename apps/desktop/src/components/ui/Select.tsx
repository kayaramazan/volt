import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/util';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string }>;
}

/**
 * Styled native <select>. We use native for keyboard a11y and to avoid
 * the weight of a full Radix select for the simple cases.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            'h-8 w-full appearance-none rounded-md border border-border bg-bg-elevated pl-2.5 pr-7 text-13 text-text',
            'focus:outline-none focus:ring-1 focus:ring-accent',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
        />
      </div>
    );
  },
);
Select.displayName = 'Select';
