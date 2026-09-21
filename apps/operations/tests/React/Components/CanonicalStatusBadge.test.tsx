import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { CanonicalStatusBadge } from '@/components/workspace/canonical-status-badge';
import type { CanonicalStatusValue, StatusViewModel } from '@/types/workspace';

describe('CanonicalStatusBadge', () => {
    it('renders the status label correctly', () => {
        const status: StatusViewModel<CanonicalStatusValue> = {
            value: 'scheduled',
            label: 'Scheduled',
        };

        const { container } = render(<CanonicalStatusBadge status={status} />);
        expect(screen.getByText('Scheduled')).toBeInTheDocument();
        expect(container.firstChild).toHaveClass('text-brand-strong');
        expect(container.firstChild).toHaveClass('bg-brand-soft');
    });

    it('renders different status tones', () => {
        const dangerStatus: StatusViewModel<CanonicalStatusValue> = {
            value: 'cancelled',
            label: 'Cancelled',
        };

        const { container } = render(
            <CanonicalStatusBadge status={dangerStatus} />,
        );
        expect(container.firstChild).toHaveClass('text-danger-strong');
    });

    it('renders the new info tone for active transit and operational states', () => {
        const enRouteStatus: StatusViewModel<CanonicalStatusValue> = {
            value: 'en_route',
            label: 'En Route',
        };

        const { container } = render(
            <CanonicalStatusBadge status={enRouteStatus} />,
        );
        expect(container.firstChild).toHaveClass('text-info-strong');
        expect(container.firstChild).toHaveClass('bg-info-soft');
    });

    it('renders soft variant with background tint', () => {
        const status: StatusViewModel<CanonicalStatusValue> = {
            value: 'scheduled',
            label: 'Scheduled',
        };

        const { container } = render(
            <CanonicalStatusBadge status={status} variant="soft" />,
        );
        expect(container.firstChild).toHaveClass('bg-brand-soft');
    });

    it('renders outline variant with transparent background', () => {
        const status: StatusViewModel<CanonicalStatusValue> = {
            value: 'scheduled',
            label: 'Scheduled',
        };

        const { container } = render(
            <CanonicalStatusBadge status={status} variant="outline" />,
        );
        expect(container.firstChild).toHaveClass('bg-transparent');
        expect(container.firstChild).toHaveClass('border-brand-strong/40');
    });

    it('renders minimal variant for high-density tables', () => {
        const status: StatusViewModel<CanonicalStatusValue> = {
            value: 'scheduled',
            label: 'Scheduled',
        };

        const { container } = render(
            <CanonicalStatusBadge status={status} variant="minimal" />,
        );
        expect(container.firstChild).toHaveClass('bg-transparent');
        expect(container.firstChild).toHaveClass('border-transparent');
    });

    it('supports an inline presentation without a capsule shape', () => {
        const status: StatusViewModel<CanonicalStatusValue> = {
            value: 'available',
            label: 'Available',
        };

        const { container } = render(
            <CanonicalStatusBadge
                status={status}
                variant="minimal"
                presentation="inline"
                size="sm"
            />,
        );

        expect(container.firstChild).not.toHaveClass('rounded-full');
        expect(container.firstChild).toHaveClass('bg-transparent');
        expect(container.firstChild).toHaveClass('text-[11px]');
    });

    it('renders different size scales (sm, md, lg)', () => {
        const status: StatusViewModel<CanonicalStatusValue> = {
            value: 'scheduled',
            label: 'Scheduled',
        };

        const { container: smContainer } = render(
            <CanonicalStatusBadge status={status} size="sm" />,
        );
        expect(smContainer.firstChild).toHaveClass('min-h-5');
        expect(smContainer.firstChild).toHaveClass('text-[11px]');

        const { container: mdContainer } = render(
            <CanonicalStatusBadge status={status} size="md" />,
        );
        expect(mdContainer.firstChild).toHaveClass('min-h-6');
        expect(mdContainer.firstChild).toHaveClass('text-xs');

        const { container: lgContainer } = render(
            <CanonicalStatusBadge status={status} size="lg" />,
        );
        expect(lgContainer.firstChild).toHaveClass('min-h-7');
        expect(lgContainer.firstChild).toHaveClass('text-sm');
    });

    it('renders live radar ping animation for active statuses', () => {
        const liveStatus: StatusViewModel<CanonicalStatusValue> = {
            value: 'en_route',
            label: 'En Route',
        };

        render(<CanonicalStatusBadge status={liveStatus} />);
        const pingElement = screen.getByTestId('status-badge-ping');
        expect(pingElement).toBeInTheDocument();
        expect(pingElement).toHaveClass('animate-ping');
    });

    it('omits ping animation for static completed statuses', () => {
        const staticStatus: StatusViewModel<CanonicalStatusValue> = {
            value: 'completed',
            label: 'Completed',
        };

        render(<CanonicalStatusBadge status={staticStatus} />);
        expect(screen.queryByTestId('status-badge-ping')).toBeNull();
    });

    it('allows forcing live pulse on any status via pulse prop', () => {
        const staticStatus: StatusViewModel<CanonicalStatusValue> = {
            value: 'completed',
            label: 'Completed',
        };

        render(<CanonicalStatusBadge status={staticStatus} pulse={true} />);
        expect(screen.getByTestId('status-badge-ping')).toBeInTheDocument();
    });

    it('renders accessible semantic micro-icons when showIcon is true', () => {
        const status: StatusViewModel<CanonicalStatusValue> = {
            value: 'completed',
            label: 'Completed',
        };

        render(<CanonicalStatusBadge status={status} showIcon={true} />);
        expect(screen.getByTestId('status-badge-icon')).toBeInTheDocument();
        expect(screen.queryByTestId('status-badge-ping')).toBeNull();
    });

    it('exposes accessible semantics (role="status" and aria-label)', () => {
        const status: StatusViewModel<CanonicalStatusValue> = {
            value: 'scheduled',
            label: 'Scheduled',
        };

        const { container } = render(<CanonicalStatusBadge status={status} />);
        expect(container.firstChild).toHaveAttribute('role', 'status');
        expect(container.firstChild).toHaveAttribute(
            'aria-label',
            'Status: Scheduled',
        );
    });

    it('hides the indicator dot when showDot is false', () => {
        const status: StatusViewModel<CanonicalStatusValue> = {
            value: 'completed',
            label: 'Completed',
        };

        const { container } = render(
            <CanonicalStatusBadge status={status} showDot={false} />,
        );
        expect(container.querySelector('.rounded-full.h-1\\.5')).toBeNull();
    });
});
