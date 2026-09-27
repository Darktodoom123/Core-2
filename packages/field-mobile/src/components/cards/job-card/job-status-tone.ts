import type { ThemeColors } from '../../../theme/tokens';
import type { DispatchStatus } from '../../../types/index';
import type { IconName } from '../../common/Icon';

export interface JobStatusTone {
    background: string;
    border: string;
    text: string;
    icon: IconName;
}

/**
 * Role colors for a job's lifecycle badge. Status is never shown in brand
 * gold: gold is reserved for the card's primary action. Every tone carries an
 * icon so the badge never relies on color alone.
 */
export function jobStatusTone(
    theme: ThemeColors,
    status: DispatchStatus,
    isPendingResponse: boolean,
): JobStatusTone {
    if (isPendingResponse) {
        return {
            background: theme.warningOrangeLight,
            border: theme.warningOrange,
            text: theme.warningOrangeText,
            icon: 'alert',
        };
    }

    switch (status) {
        case 'en_route':
        case 'arrived':
        case 'working':
            return {
                background: theme.actionCobaltLight,
                border: theme.actionCobalt,
                text: theme.textPrimary,
                icon: status === 'en_route' ? 'route' : 'pin',
            };
        case 'completed':
            return {
                background: theme.successEmeraldLight,
                border: theme.successEmerald,
                text: theme.successEmeraldText,
                icon: 'check-circle',
            };
        case 'cancelled':
            return {
                background: theme.hazardRedLight,
                border: theme.hazardRed,
                text: theme.hazardRedText,
                icon: 'close',
            };
        default:
            return {
                background: theme.surfaceHighlight,
                border: theme.borderStrong,
                text: theme.textSecondary,
                icon: 'clock',
            };
    }
}
