import React from 'react';
import { cn } from '@/lib/utils';

export interface FleetInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

export function FleetInput({
    label,
    value,
    onChange,
    error,
    type = 'text',
    placeholder,
    required = false,
    className,
}: FleetInputProps) {
    return (
        <label className={cn('block text-sm font-medium text-ink', className)}>
            {label}
            {required && <span className="ml-0.5 text-danger">*</span>}
            <input
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                aria-invalid={error ? 'true' : undefined}
                className={cn(
                    'mt-1 h-11 w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-soft/60 focus-visible:outline-hidden',
                    error
                        ? 'border-danger focus-visible:border-danger focus-visible:ring-2 focus-visible:ring-danger'
                        : 'border-line-strong focus-visible:border-brand-strong focus-visible:ring-2 focus-visible:ring-brand-strong',
                )}
            />
            {error && (
                <span role="alert" className="mt-1 block text-xs text-danger">
                    {error}
                </span>
            )}
        </label>
    );
}
