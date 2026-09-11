import { beforeEach, describe, expect, it } from 'vitest';
import { getSafeReturnTo } from '@/components/dispatch-detail/dispatch-detail-helpers';

describe('getSafeReturnTo', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', '/operations/dispatch-jobs/1');
    });

    it('preserves the desk query and hash in an in-app return path', () => {
        window.history.replaceState(
            {},
            '',
            '/operations/dispatch-jobs/1?return_to=%2F%3Fview%3Ddispatch%26dispatch_mode%3Dresources%26dispatch_job%3D1%23assignment-summary',
        );

        expect(getSafeReturnTo()).toBe(
            '/?view=dispatch&dispatch_mode=resources&dispatch_job=1#assignment-summary',
        );
    });

    it('uses a safe fallback when the requested path is invalid', () => {
        window.history.replaceState(
            {},
            '',
            '/operations/dispatch-jobs/1?return_to=https%3A%2F%2Fexample.com',
        );

        expect(getSafeReturnTo('/?view=dispatch&dispatch_job=1')).toBe(
            '/?view=dispatch&dispatch_job=1',
        );
    });

    it('rejects protocol-relative and backslash paths without a fallback', () => {
        for (const returnTo of ['//example.com', '/\\\\example.com']) {
            window.history.replaceState(
                {},
                '',
                `/operations/dispatch-jobs/1?return_to=${encodeURIComponent(returnTo)}`,
            );

            expect(getSafeReturnTo()).toBe('/');
        }
    });

    it('reads the server page URL so return navigation matches before hydration', () => {
        expect(
            getSafeReturnTo(
                null,
                '/operations/dispatch-jobs/1?return_to=%2F%3Fview%3Ddispatch%26dispatch_tab%3Din-progress',
            ),
        ).toBe('/?view=dispatch&dispatch_tab=in-progress');
    });
});
