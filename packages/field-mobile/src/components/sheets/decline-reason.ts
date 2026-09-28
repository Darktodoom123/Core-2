/** Reasons dispatch sees; lifecycle v1.1 step 2 makes one mandatory. */
export const DECLINE_REASONS = [
    'Sick leave',
    'Hours conflict',
    'Personal emergency',
    'Travel or transport problem',
    'Other',
] as const;

export type DeclineReason = (typeof DECLINE_REASONS)[number];

/** The text sent to the server, or null while the choice is incomplete. */
export function declineReasonText(
    reason: DeclineReason | null,
    note: string,
): string | null {
    const detail = note.trim();

    if (!reason) {
        return null;
    }

    if (reason === 'Other') {
        return detail === '' ? null : detail;
    }

    return detail === '' ? reason : `${reason}: ${detail}`;
}
