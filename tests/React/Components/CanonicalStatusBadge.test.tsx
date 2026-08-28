import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import type { StatusViewModel, CanonicalStatusValue } from '@/types/workspace';

describe('CanonicalStatusBadge', () => {
    it('renders the status label correctly', () => {
        const status: StatusViewModel<CanonicalStatusValue> = {
            value: 'scheduled',
            label: 'Scheduled',
        };

        render(<CanonicalStatusBadge status={status} />);
        expect(screen.getByText('Scheduled')).toBeInTheDocument();
    });

    it('renders different status tones', () => {
        const dangerStatus: StatusViewModel<CanonicalStatusValue> = {
            value: 'cancelled',
            label: 'Cancelled',
        };

        const { container } = render(<CanonicalStatusBadge status={dangerStatus} />);
        expect(container.firstChild).toHaveClass('text-danger-strong');
    });

    it('hides the indicator dot when showDot is false', () => {
        const status: StatusViewModel<CanonicalStatusValue> = {
            value: 'completed',
            label: 'Completed',
        };

        const { container } = render(<CanonicalStatusBadge status={status} showDot={false} />);
        expect(container.querySelector('.rounded-full.h-1\\.5')).toBeNull();
    });
});
