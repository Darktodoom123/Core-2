import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text, View } from 'react-native';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { ThemeProvider } from '../theme';

describe('TileScreenHeader Component', () => {
    it('renders title, category eyebrow, and subtitle in light theme', async () => {
        const onBack = jest.fn();
        const view = await render(
            <TileScreenHeader
                backAccessibilityHint="Return to dashboard"
                backAccessibilityLabel="Back to launcher"
                backTestID="custom-back-btn"
                category="Vehicle Maintenance"
                onBack={onBack}
                subtitle="Assigned Operator: Alex Rivera"
                title="ALB-CRN-050 · 50T Tadano All-Terrain Crane"
            />,
        );

        // Verify title & hierarchy
        expect(view.getByText('Vehicle Maintenance')).toBeTruthy();
        expect(
            view.getByText('ALB-CRN-050 · 50T Tadano All-Terrain Crane'),
        ).toBeTruthy();
        expect(view.getByText('Assigned Operator: Alex Rivera')).toBeTruthy();

        // Verify header accessibility role
        const titleHeader = view.getByRole('header');
        expect(titleHeader).toBeTruthy();

        // Verify back button interaction and accessibility
        const backBtn = view.getByTestId('custom-back-btn');
        expect(backBtn.props.accessibilityLabel).toBe('Back to launcher');
        expect(backBtn.props.accessibilityHint).toBe('Return to dashboard');
        fireEvent.press(backBtn);
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('renders cleanly without onBack button when onBack is omitted', async () => {
        const view = await render(
            <TileScreenHeader
                category="Permits & Certs"
                title="Documents & Permits"
            />,
        );

        expect(view.getByText('Permits & Certs')).toBeTruthy();
        expect(view.getByText('Documents & Permits')).toBeTruthy();
        expect(view.queryByTestId('tile-header-back-btn')).toBeNull();
    });

    it('renders rightElement slot cleanly alongside titleBlock', async () => {
        const view = await render(
            <TileScreenHeader
                category="Hours of Service"
                rightElement={
                    <View testID="duty-badge-pill">
                        <Text>OPR</Text>
                    </View>
                }
                subtitle="Operator: Dev Operator"
                title="Duty Status & Shift Management"
            />,
        );

        expect(view.getByText('Duty Status & Shift Management')).toBeTruthy();
        expect(view.getByTestId('duty-badge-pill')).toBeTruthy();
        expect(view.getByText('OPR')).toBeTruthy();
    });

    it('renders custom ReactNode subtitle when passed', async () => {
        const view = await render(
            <TileScreenHeader
                category="Vehicle Inspection"
                subtitle={
                    <View testID="custom-sub-node">
                        <Text>Custom Checklist Subtitle</Text>
                    </View>
                }
                title="Create DVIR"
            />,
        );

        expect(view.getByTestId('custom-sub-node')).toBeTruthy();
        expect(view.getByText('Custom Checklist Subtitle')).toBeTruthy();
    });

    it('renders properly in dark HUD theme with custom testIDs', async () => {
        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <TileScreenHeader
                    backTestID="dark-back-btn"
                    category="Equipment Sales"
                    onBack={jest.fn()}
                    subtitle="Sales Order #SO-9921"
                    testID="custom-header-id"
                    title="Equipment Sales Delivery"
                    titleTestID="custom-title-id"
                />
            </ThemeProvider>,
        );

        const headerRoot = view.getByTestId('custom-header-id');
        expect(headerRoot).toBeTruthy();
        expect(view.getByText('Equipment Sales')).toBeTruthy();
        expect(view.getByTestId('custom-title-id')).toBeTruthy();
        expect(view.getByText('Equipment Sales Delivery')).toBeTruthy();
        expect(view.getByText('Sales Order #SO-9921')).toBeTruthy();
        expect(view.getByTestId('dark-back-btn')).toBeTruthy();
    });

    it('applies custom style prop and default accessibility labels to back button', async () => {
        const onBack = jest.fn();
        const view = await render(
            <TileScreenHeader
                onBack={onBack}
                style={{ marginTop: 20 }}
                subtitle="Inspection Checklist"
                subtitleNumberOfLines={3}
                title="Vehicle Check"
            />,
        );

        const defaultBackBtn = view.getByTestId('tile-header-back-btn');
        expect(defaultBackBtn).toBeTruthy();
        expect(defaultBackBtn.props.accessibilityLabel).toBe('Back');
        expect(defaultBackBtn.props.accessibilityHint).toBe(
            'Returns to previous screen',
        );

        const header = view.getByTestId('tile-screen-header');
        expect(header).toBeTruthy();
        expect(view.getByText('Vehicle Check')).toBeTruthy();
        expect(view.getByText('Inspection Checklist')).toBeTruthy();
    });
});
