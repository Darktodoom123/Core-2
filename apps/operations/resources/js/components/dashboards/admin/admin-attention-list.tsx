import { AlertTriangle, ArrowRight, CheckCircle2, Siren } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { WorkspaceSection } from '@/types/workspace';
import type { AttentionItem } from './admin-dashboard-model';

export function AdminAttentionList({
    items,
    availableSections,
    onOpen,
}: {
    items: AttentionItem[];
    availableSections: WorkspaceSection[];
    onOpen: (section: WorkspaceSection, tab?: string) => void;
}) {
    return (
        <section
            aria-labelledby="admin-attention-heading"
            className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xs"
        >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                <h2
                    id="admin-attention-heading"
                    className="text-sm font-semibold text-ink"
                >
                    Needs your attention
                </h2>
                <span className="text-xs text-ink-soft tabular-nums">
                    {items.length === 0
                        ? 'All clear'
                        : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
                </span>
            </div>

            {items.length === 0 ? (
                <p className="flex items-center gap-2.5 px-4 py-4 text-sm text-ink-soft sm:px-5">
                    <CheckCircle2
                        className="size-4 shrink-0 text-success-strong"
                        aria-hidden="true"
                    />
                    Platform, access, and AI spend are all within limits.
                </p>
            ) : (
                <ul className="divide-y divide-line">
                    {items.map((item) => {
                        const Icon =
                            item.tone === 'danger' ? Siren : AlertTriangle;
                        const action =
                            item.action &&
                            availableSections.includes(item.action.section)
                                ? item.action
                                : null;

                        return (
                            <li
                                key={item.id}
                                className="relative flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'absolute inset-y-0 left-0 w-1',
                                        item.tone === 'danger'
                                            ? 'bg-danger'
                                            : 'bg-warning',
                                    )}
                                />
                                <div className="flex min-w-0 items-start gap-3">
                                    <span
                                        className={cn(
                                            'mt-0.5 grid size-7 shrink-0 place-items-center rounded-md',
                                            item.tone === 'danger'
                                                ? 'bg-danger-soft text-danger-strong'
                                                : 'bg-warning-soft text-warning-strong',
                                        )}
                                    >
                                        <Icon
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-ink">
                                            <span className="sr-only">
                                                {item.tone === 'danger'
                                                    ? 'Urgent: '
                                                    : 'Warning: '}
                                            </span>
                                            {item.title}
                                        </p>
                                        <p className="mt-0.5 text-xs leading-5 text-ink-soft">
                                            {item.detail}
                                        </p>
                                    </div>
                                </div>
                                {action && (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="shrink-0 gap-1.5 self-start sm:self-center"
                                        onClick={() =>
                                            onOpen(action.section, action.tab)
                                        }
                                    >
                                        {action.label}
                                        <ArrowRight
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
