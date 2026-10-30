import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

const alertVariants = cva(
  'relative w-full rounded-lg border p-4 text-sm [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
  {
    variants: {
      variant: {
        default: 'bg-background text-foreground',
        info: 'border-blue-200 bg-blue-50 text-blue-900 [&>svg]:text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200 dark:[&>svg]:text-blue-400',
        destructive:
          'border-destructive/50 bg-destructive/10 text-destructive dark:border-destructive [&>svg]:text-destructive',
        success:
          'border-emerald-200 bg-emerald-50 text-emerald-900 [&>svg]:text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 dark:[&>svg]:text-emerald-400',
        warning:
          'border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:[&>svg]:text-amber-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  icon?: boolean;
}

export function Alert({ className, variant, icon = true, children, ...props }: AlertProps) {
  const IconComponent =
    variant === 'destructive'
      ? AlertCircle
      : variant === 'success'
        ? CheckCircle2
        : variant === 'warning'
          ? AlertTriangle
          : Info;

  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {icon && <IconComponent className="h-4 w-4" />}
      {children}
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5 className={cn('mb-1 font-semibold leading-none tracking-tight', className)} {...props} />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />;
}
