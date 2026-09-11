import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const cardVariants = cva(
    'rounded-xl border transition-colors duration-150',
    {
        variants: {
            variant: {
                default: 'border-line bg-surface text-ink shadow-2xs',
                elevated: 'border-line bg-surface text-ink shadow-sm',
                subtle: 'border-line bg-surface-subtle text-ink',
                interactive:
                    'border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-subtle cursor-pointer shadow-2xs',
            },
            padding: {
                none: 'p-0',
                sm: 'p-3 sm:p-4',
                md: 'p-5 sm:p-6',
                lg: 'p-6 sm:p-8',
            },
        },
        defaultVariants: {
            variant: 'default',
            padding: 'none',
        },
    },
);

export interface CardProps
    extends HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant, padding, ...props }, ref) => (
        <div
            ref={ref}
            className={cn(cardVariants({ variant, padding, className }))}
            {...props}
        />
    ),
);
Card.displayName = 'Card';

export const Panel = Card;

export const CardHeader = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 p-5 pb-3 sm:p-6 sm:pb-4', className)}
        {...props}
    />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<
    HTMLHeadingElement,
    HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            'text-lg font-semibold leading-none tracking-tight text-ink',
            className,
        )}
        {...props}
    >
        {children}
    </h3>
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<
    HTMLParagraphElement,
    HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn('text-sm text-ink-soft', className)}
        {...props}
    />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<
    HTMLDivElement,
    HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('flex items-center p-5 pt-0 sm:p-6 sm:pt-0', className)}
        {...props}
    />
));
CardFooter.displayName = 'CardFooter';
