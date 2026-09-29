import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { formatDateTime } from '@/lib/formatters';
import type { AuditEventViewModel } from '@/types/workspace';
import {
    auditActionLabel,
    auditChanges,
    auditSubjectLabel,
} from './audit-labels';

const COPIED_MS = 2000;

export function AuditEventDetail({
    event,
    onClose,
    onShowRequest,
}: {
    event: AuditEventViewModel | null;
    onClose: () => void;
    onShowRequest: (requestId: string) => void;
}) {
    const [copied, setCopied] = useState(false);
    const [showRaw, setShowRaw] = useState(false);

    if (!event) {
        return null;
    }

    const changes = auditChanges(event.before, event.after);
    const subject = auditSubjectLabel(event.subject_type, event.subject_id);
    const hasState = Boolean(event.before || event.after);

    const copyRequestId = () => {
        if (!event.request_id) {
            return;
        }

        void navigator.clipboard?.writeText(event.request_id).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), COPIED_MS);
        });
    };

    return (
        <Modal
            open
            onClose={onClose}
            size="lg"
            title={auditActionLabel(event.action)}
            description={
                <code className="text-xs text-ink-soft">{event.action}</code>
            }
            footer={
                <div className="flex flex-wrap justify-end gap-2">
                    {event.request_id && (
                        <Button
                            variant="secondary"
                            onClick={() => onShowRequest(event.request_id!)}
                        >
                            Show everything from this request
                        </Button>
                    )}
                    <Button variant="primary" onClick={onClose}>
                        Done
                    </Button>
                </div>
            }
        >
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Detail label="When">
                    {event.occurred_at
                        ? formatDateTime(event.occurred_at)
                        : 'Not recorded'}
                </Detail>
                <Detail label="Who">
                    {event.actor?.name ?? 'System (no signed-in user)'}
                </Detail>
                <Detail label="Record">{subject ?? 'Not recorded'}</Detail>
                <Detail label="IP address">
                    {event.ip_address ?? 'Not recorded'}
                </Detail>
                <Detail label="Reason" wide>
                    {event.reason ?? 'No reason was given'}
                </Detail>
                <Detail label="Request ID" wide>
                    {event.request_id ? (
                        <span className="flex items-center gap-2">
                            <code className="truncate text-xs">
                                {event.request_id}
                            </code>
                            <button
                                type="button"
                                onClick={copyRequestId}
                                aria-label="Copy request ID"
                                className="grid size-8 shrink-0 place-items-center rounded-md text-ink-soft hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                            >
                                {copied ? (
                                    <Check
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Copy
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                )}
                            </button>
                            <span className="sr-only" aria-live="polite">
                                {copied ? 'Copied' : ''}
                            </span>
                        </span>
                    ) : (
                        'Not recorded'
                    )}
                </Detail>
            </dl>

            <div className="mt-5">
                <h3 className="text-sm font-semibold text-ink">What changed</h3>
                {!hasState ? (
                    <p className="mt-1 text-sm text-ink-soft">
                        This event records an action, not a change to stored
                        values.
                    </p>
                ) : changes.length === 0 ? (
                    <p className="mt-1 text-sm text-ink-soft">
                        The recorded before and after values are the same.
                    </p>
                ) : (
                    <div className="mt-2 overflow-x-auto rounded-lg border border-line">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface-subtle text-xs text-ink-soft">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-3 py-2 font-medium"
                                    >
                                        Field
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2 font-medium"
                                    >
                                        Before
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-3 py-2 font-medium"
                                    >
                                        After
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {changes.map((change) => (
                                    <tr key={change.field}>
                                        <th
                                            scope="row"
                                            className="px-3 py-2 font-medium text-ink capitalize"
                                        >
                                            {change.field}
                                        </th>
                                        <td className="px-3 py-2 break-all text-ink-soft line-through decoration-danger/50">
                                            {change.before}
                                        </td>
                                        <td className="px-3 py-2 break-all text-ink">
                                            {change.after}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {hasState && (
                    <div className="mt-3">
                        <button
                            type="button"
                            aria-expanded={showRaw}
                            onClick={() => setShowRaw((value) => !value)}
                            className="min-h-9 text-xs font-semibold text-ink-soft hover:text-ink"
                        >
                            {showRaw
                                ? 'Hide recorded data'
                                : 'Show recorded data'}
                        </button>
                        {showRaw && (
                            <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                <RawState label="Before" value={event.before} />
                                <RawState label="After" value={event.after} />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}

function Detail({
    label,
    wide = false,
    children,
}: {
    label: string;
    wide?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div className={wide ? 'sm:col-span-2' : undefined}>
            <dt className="text-xs font-medium text-ink-soft">{label}</dt>
            <dd className="mt-0.5 min-w-0 text-ink">{children}</dd>
        </div>
    );
}

function RawState({
    label,
    value,
}: {
    label: string;
    value: Record<string, unknown> | null | undefined;
}) {
    return (
        <div className="min-w-0 overflow-hidden rounded-lg border border-line">
            <p className="border-b border-line bg-surface-subtle px-3 py-1.5 text-xs font-medium text-ink-soft">
                {label}
            </p>
            <pre className="max-h-60 overflow-auto p-3 font-mono text-[11px] text-ink">
                {value ? JSON.stringify(value, null, 2) : 'Nothing recorded'}
            </pre>
        </div>
    );
}
