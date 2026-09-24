import { describe, expect, it } from 'vitest';
import { notificationDestination } from '@/components/workspace/notification-center-popover';
import type { NotificationViewModel } from '@/types/workspace';

function notification(
    data: Record<string, unknown>,
    type = 'browser.test.notification',
): NotificationViewModel {
    return {
        id: 'notification-1',
        type,
        status: 'unread',
        data,
        read_at: null,
        created_at: null,
        dispatch_job: null,
    };
}

describe('notification destinations', () => {
    it('routes general safety notices to Safety Governance', () => {
        expect(
            notificationDestination(
                notification({ event: 'inspection.failed' }),
            ),
        ).toBe('safety');
    });

    it('keeps emergency SOS notices in the SOS response queue', () => {
        expect(
            notificationDestination(
                notification({ event: 'safety.sos_received' }, 'sos.incident'),
            ),
        ).toBe('sos');
    });
});
