import { forwardRef } from 'react';
import type {
    HTMLAttributes,
    TdHTMLAttributes,
    ThHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
    containerClassName?: string;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
    ({ className, containerClassName, ...props }, ref) => (
        <div
            className={cn(
                'relative w-full overflow-x-auto rounded-lg border border-line',
                containerClassName,
            )}
        >
            <table
                ref={ref}
                className={cn(
                    'w-full caption-bottom text-sm text-ink',
                    className,
                )}
                {...props}
            />
        </div>
    ),
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<
    HTMLTableSectionElement,
    HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <thead
        ref={ref}
        className={cn(
            'border-b border-line bg-surface-subtle font-medium text-ink-soft',
            className,
        )}
        {...props}
    />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<
    HTMLTableSectionElement,
    HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <tbody
        ref={ref}
        className={cn('[&_tr:last-child]:border-0 divide-y divide-line', className)}
        {...props}
    />
));
TableBody.displayName = 'TableBody';

export const TableFooter = forwardRef<
    HTMLTableSectionElement,
    HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
    <tfoot
        ref={ref}
        className={cn(
            'border-t border-line bg-surface-subtle font-medium text-ink',
            className,
        )}
        {...props}
    />
));
TableFooter.displayName = 'TableFooter';

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
    hoverable?: boolean;
    selected?: boolean;
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
    ({ className, hoverable = true, selected = false, ...props }, ref) => (
        <tr
            ref={ref}
            data-state={selected ? 'selected' : undefined}
            className={cn(
                'border-b border-line transition-colors',
                hoverable && 'hover:bg-surface-subtle',
                selected && 'bg-brand-soft/40 hover:bg-brand-soft/60',
                className,
            )}
            {...props}
        />
    ),
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<
    HTMLTableCellElement,
    ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
    <th
        ref={ref}
        className={cn(
            'h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-ink-soft [&:has([role=checkbox])]:pr-0',
            className,
        )}
        {...props}
    />
));
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<
    HTMLTableCellElement,
    TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
    <td
        ref={ref}
        className={cn(
            'p-4 align-middle text-sm text-ink [&:has([role=checkbox])]:pr-0',
            className,
        )}
        {...props}
    />
));
TableCell.displayName = 'TableCell';

export const TableCaption = forwardRef<
    HTMLTableCaptionElement,
    HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
    <caption
        ref={ref}
        className={cn('mt-4 text-xs text-ink-soft', className)}
        {...props}
    />
));
TableCaption.displayName = 'TableCaption';
