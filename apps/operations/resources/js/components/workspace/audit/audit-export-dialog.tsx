import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';
import type { FormEvent } from 'react';
import { Button, FormField, Input, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';

type ExportFormat = 'csv' | 'pdf';

export function AuditExportDialog({
    open,
    initialFrom,
    initialTo,
    onClose,
}: {
    open: boolean;
    /** Local calendar dates (YYYY-MM-DD) from the current view. */
    initialFrom: string;
    initialTo: string;
    onClose: () => void;
}) {
    const form = useForm({
        export_type: 'system_audit',
        format: 'csv' as ExportFormat,
        date_from: initialFrom,
        date_to: initialTo,
    });
    const { setData } = form;

    useEffect(() => {
        if (open) {
            setData((data) => ({
                ...data,
                date_from: initialFrom,
                date_to: initialTo,
            }));
        }
    }, [initialFrom, initialTo, open, setData]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/operations/reports/exports', {
            preserveScroll: true,
            preserveState: true,
            onSuccess: onClose,
        });
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="sm"
            title="Export the audit trail"
            description="Every event in the chosen dates is included. Category, person, and search filters are not applied."
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="quiet" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="audit-export-form"
                        variant="primary"
                        disabled={form.processing}
                    >
                        {form.processing ? 'Queuing…' : 'Queue export'}
                    </Button>
                </div>
            }
        >
            <form
                id="audit-export-form"
                onSubmit={submit}
                className="space-y-4"
            >
                <fieldset>
                    <legend className="text-sm font-medium text-ink">
                        Format
                    </legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {(['csv', 'pdf'] as const).map((format) => (
                            <label
                                key={format}
                                className={cn(
                                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm',
                                    form.data.format === format
                                        ? 'border-ink bg-surface-subtle font-semibold text-ink'
                                        : 'border-line text-ink-soft hover:text-ink',
                                )}
                            >
                                <input
                                    type="radio"
                                    name="format"
                                    value={format}
                                    checked={form.data.format === format}
                                    onChange={() => setData('format', format)}
                                    className="accent-ink"
                                />
                                {format === 'csv'
                                    ? 'Spreadsheet (CSV)'
                                    : 'Document (PDF)'}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="grid grid-cols-2 gap-3">
                    <FormField label="From" error={form.errors.date_from}>
                        <Input
                            type="date"
                            aria-label="Export from date"
                            value={form.data.date_from}
                            onChange={(event) =>
                                setData('date_from', event.target.value)
                            }
                        />
                    </FormField>
                    <FormField label="To" error={form.errors.date_to}>
                        <Input
                            type="date"
                            aria-label="Export to date"
                            value={form.data.date_to}
                            min={form.data.date_from || undefined}
                            onChange={(event) =>
                                setData('date_to', event.target.value)
                            }
                        />
                    </FormField>
                </div>

                <p className="text-xs leading-5 text-ink-soft">
                    Leave both dates empty to export everything. The file is
                    prepared in the background and appears under Your audit
                    exports on this page when it is ready. Free-text reasons are
                    left out of exports.
                </p>
            </form>
        </Modal>
    );
}
