import type { OutboxItemDisplay } from '../../../services/outboxProjection';
import type { ThemeColors } from '../../../theme/tokens';

export type OutboxTone =
    'critical' | 'warning' | 'info' | 'success' | 'neutral';

export interface OutboxToneColors {
    background: string;
    border: string;
    text: string;
    icon: string;
}

/**
 * What the operator must do about a saved action. A send the server turned
 * down (or that expired) is critical; a conflict, an unresolved outcome or a
 * failure that can be retried needs attention; sending is informational.
 */
export function outboxItemTone(item: OutboxItemDisplay): OutboxTone {
    if (item.state === 'completed') {
        return 'success';
    }

    if (item.state === 'syncing') {
        return 'info';
    }

    if (
        item.state === 'expired' ||
        (item.state === 'failed' && !item.retryable && !item.isConflict)
    ) {
        return 'critical';
    }

    if (
        item.isConflict ||
        item.state === 'unresolved' ||
        item.state === 'failed'
    ) {
        return 'warning';
    }

    return 'neutral';
}

export function outboxToneColors(
    theme: ThemeColors,
    tone: OutboxTone,
): OutboxToneColors {
    switch (tone) {
        case 'critical':
            return {
                background: theme.hazardRedLight,
                border: theme.hazardRed,
                text: theme.hazardRedText,
                icon: theme.hazardRedText,
            };
        case 'warning':
            return {
                background: theme.warningOrangeLight,
                border: theme.warningOrange,
                text: theme.warningOrangeText,
                icon: theme.warningOrangeText,
            };
        case 'info':
            return {
                background: theme.actionCobaltLight,
                border: theme.actionCobalt,
                text: theme.textPrimary,
                icon: theme.actionCobalt,
            };
        case 'success':
            return {
                background: theme.successEmeraldLight,
                border: theme.successEmerald,
                text: theme.successEmeraldText,
                icon: theme.successEmeraldText,
            };
        default:
            return {
                background: theme.surfaceHighlight,
                border: theme.border,
                text: theme.textSecondary,
                icon: theme.textSecondary,
            };
    }
}
