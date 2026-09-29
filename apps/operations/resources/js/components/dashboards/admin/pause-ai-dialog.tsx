import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button, FormField, Modal, Textarea } from '@/components/ui';

const REASON_MAX = 255;

/** Asks why AI advice is being paused; the reason goes into the audit trail. */
export function PauseAiDialog({
    open,
    saving,
    error,
    onCancel,
    onConfirm,
}: {
    open: boolean;
    saving: boolean;
    error: string | null;
    onCancel: () => void;
    /** Resolves true when the pause was saved, which closes the dialog. */
    onConfirm: (reason: string) => Promise<boolean>;
}) {
    const [reason, setReason] = useState('');

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        if (reason.trim() !== '' && (await onConfirm(reason.trim()))) {
            setReason('');
        }
    };

    return (
        <Modal
            open={open}
            onClose={onCancel}
            title="Pause AI advice?"
            description="No new AI requests will be sent until someone resumes it. Your reason is saved in the audit trail."
            size="sm"
            footer={
                <div className="flex justify-end gap-2">
                    <Button variant="quiet" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        form="pause-ai-form"
                        variant="danger"
                        disabled={saving || reason.trim() === ''}
                    >
                        {saving ? 'Pausing…' : 'Pause AI advice'}
                    </Button>
                </div>
            }
        >
            <form id="pause-ai-form" onSubmit={submit}>
                <FormField
                    label="Reason"
                    required
                    description="For example: spend spike under review."
                    error={error ?? undefined}
                >
                    <Textarea
                        aria-label="Reason for pausing AI advice"
                        required
                        value={reason}
                        maxLength={REASON_MAX}
                        rows={3}
                        autoFocus
                        onChange={(event) => setReason(event.target.value)}
                    />
                </FormField>
            </form>
        </Modal>
    );
}
