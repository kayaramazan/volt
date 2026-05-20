import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/util';

export const Tabs = TabsPrimitive.Root;

export const TabsList = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List
    className={cn(
      'inline-flex h-8 items-center gap-1 border-b border-border px-2 text-13',
      className,
    )}
    {...props}
  />
);

export const TabsTrigger = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    className={cn(
      'relative flex h-full items-center px-2 text-text-muted transition-colors',
      'hover:text-text',
      'data-[state=active]:text-text',
      'data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px] data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-accent',
      className,
    )}
    {...props}
  />
);

export const TabsContent = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content
    className={cn('flex-1 outline-none data-[state=inactive]:hidden', className)}
    {...props}
  />
);
