import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 select-none',
    {
        variants: {
            variant: {
                primary:
                    'bg-brand text-brand-contrast font-semibold hover:bg-brand-strong active:bg-brand-strong shadow-xs',
                secondary:
                    'border border-line-strong bg-surface text-ink hover:bg-surface-subtle active:bg-surface-subtle shadow-2xs',
                quiet: 'text-ink-soft hover:bg-surface-subtle hover:text-ink active:bg-surface-subtle',
                danger: 'bg-danger text-danger-contrast hover:bg-danger-strong active:bg-danger-strong shadow-xs',
                accent: 'bg-accent text-white hover:bg-accent-strong active:bg-accent-strong shadow-xs',
                outline:
                    'border border-line bg-transparent text-ink hover:bg-surface-subtle active:bg-surface-subtle',
            },
            size: {
                sm: 'min-h-9 px-3 text-xs rounded-md',
                md: 'min-h-11 px-4 text-sm',
                lg: 'min-h-12 px-6 text-base rounded-xl',
                icon: 'h-11 w-11 min-h-11 min-w-11 p-0',
                iconSm: 'h-9 w-9 min-h-9 min-w-9 p-0 rounded-md',
            },
        },
        defaultVariants: {
            variant: 'secondary',
            size: 'md',
        },
    },
);

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        { className, variant, size, type = 'button', autoFocus, ...props },
        ref,
    ) => {
        return (
            <button
                ref={ref}
                type={type}
                autoFocus={autoFocus}
                data-autofocus={autoFocus ? '' : undefined}
                className={cn(buttonVariants({ variant, size, className }))}
                {...props}
            />
        );
    },
);

Button.displayName = 'Button';
