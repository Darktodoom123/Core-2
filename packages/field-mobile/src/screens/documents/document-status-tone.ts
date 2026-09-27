import type { IconName } from '../../components/common/Icon';
import type { ThemeColors } from '../../theme/tokens';

export interface DocumentStatusTone {
    label: string;
    icon: IconName;
    background: string;
    border: string;
    text: string;
    /** One plain sentence for the detail view, given the expiry date. */
    detail: (expiryDate?: string | null) => string;
}

type StatusInput = unknown;

function resolveStatus(input: StatusInput): { value: string; label?: string } {
    if (typeof input === 'object' && input !== null) {
        const record = input as { value?: unknown; label?: unknown };
        const value = typeof record.value === 'string' ? record.value : '';
        const label =
            typeof record.label === 'string' ? record.label : undefined;

        return { value: value.toLowerCase(), label };
    }

    return { value: typeof input === 'string' ? input.toLowerCase() : '' };
}

/**
 * Role colors and wording for a compliance document's validity. An
 * unrecognised or missing status is neutral "Status Unknown": the wallet
 * never presents a document as valid unless the server said so.
 */
export function documentStatusTone(
    theme: ThemeColors,
    input: StatusInput,
): DocumentStatusTone {
    const { value, label } = resolveStatus(input);
    const success = {
        background: theme.successEmeraldLight,
        border: theme.successEmerald,
        text: theme.successEmeraldText,
    };
    const critical = {
        background: theme.hazardRedLight,
        border: theme.hazardRed,
        text: theme.hazardRedText,
    };
    const neutral = {
        background: theme.surfaceHighlight,
        border: theme.borderStrong,
        text: theme.textSecondary,
    };

    switch (value) {
        case 'valid':
            return {
                ...success,
                label: 'Valid',
                icon: 'check-circle',
                detail: (expiry) =>
                    expiry ? `Valid until ${expiry}.` : 'Valid.',
            };
        case 'permanent':
            return {
                ...success,
                label: 'Permanent',
                icon: 'check-circle',
                detail: () => 'Valid with no expiry date.',
            };
        case 'expiring_soon':
            return {
                background: theme.warningOrangeLight,
                border: theme.warningOrange,
                text: theme.warningOrangeText,
                label: 'Expiring Soon',
                icon: 'alert',
                detail: (expiry) =>
                    `Expires ${expiry ?? 'soon'}. Renew it before it lapses.`,
            };
        case 'expired':
            return {
                ...critical,
                label: 'Expired',
                icon: 'close',
                detail: (expiry) =>
                    `Expired on ${expiry ?? 'an unknown date'}. Do not present it as valid.`,
            };
        case 'revoked':
            return {
                ...critical,
                label: 'Revoked',
                icon: 'close',
                detail: () =>
                    'Revoked by the issuing authority. Do not present it as valid.',
            };
        case 'superseded':
            return {
                ...neutral,
                label: 'Superseded',
                icon: 'clock',
                detail: () => 'Replaced by a newer document.',
            };
        case 'no_expiration':
            return {
                ...neutral,
                label: 'No Expiry Date',
                icon: 'document',
                detail: () => 'This document has no expiry date.',
            };
        default:
            return {
                ...neutral,
                label: label || 'Status Unknown',
                icon: 'alert-circle',
                detail: () =>
                    'The server has not reported whether this document is valid.',
            };
    }
}
