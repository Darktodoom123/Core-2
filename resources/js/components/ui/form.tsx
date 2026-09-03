import { forwardRef } from 'react';
import type {
    InputHTMLAttributes,
    LabelHTMLAttributes,
    SelectHTMLAttributes,
    TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
    required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
    ({ className, children, required, ...props }, ref) => (
        <label
            ref={ref}
            className={cn(
                'block text-sm font-medium leading-none text-ink select-none',
                className,
            )}
            {...props}
        >
            {children}
            {required && (
                <span className="ml-1 text-danger font-semibold" aria-hidden="true">
                    *
                </span>
            )}
        </label>
    ),
);
Label.displayName = 'Label';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: boolean | string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type = 'text', error, ...props }, ref) => (
        <input
            ref={ref}
            type={type}
            className={cn(
                'flex min-h-11 w-full rounded-lg border bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-soft/70 transition-colors duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50',
                error
                    ? 'border-danger focus-visible:outline-danger text-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                className,
            )}
            aria-invalid={Boolean(error)}
            {...props}
        />
    ),
);
Input.displayName = 'Input';

export interface TextareaProps
    extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    error?: boolean | string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, error, ...props }, ref) => (
        <textarea
            ref={ref}
            className={cn(
                'flex min-h-[88px] w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50',
                error
                    ? 'border-danger focus-visible:outline-danger text-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                className,
            )}
            aria-invalid={Boolean(error)}
            {...props}
        />
    ),
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    error?: boolean | string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, children, error, ...props }, ref) => (
        <select
            ref={ref}
            className={cn(
                'flex min-h-11 w-full rounded-lg border bg-surface px-3.5 py-2 text-sm text-ink transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50',
                error
                    ? 'border-danger focus-visible:outline-danger text-danger'
                    : 'border-line hover:border-line-strong focus:border-brand',
                className,
            )}
            aria-invalid={Boolean(error)}
            {...props}
        >
            {children}
        </select>
    ),
);
Select.displayName = 'Select';

export function FormField({
    label,
    description,
    error,
    required,
    children,
    className,
}: {
    label?: string;
    description?: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('space-y-1.5', className)}>
            {label && <Label required={required}>{label}</Label>}
            {children}
            {description && !error && (
                <p className="text-xs text-ink-soft">{description}</p>
            )}
            {error && (
                <p className="text-xs font-medium text-danger" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
