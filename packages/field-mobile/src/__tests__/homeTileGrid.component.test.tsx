import { fireEvent, render } from '@testing-library/react-native/pure';
import '@testing-library/react-native/matchers';
import React from 'react';
import { StyleSheet } from 'react-native';
import {
    HomeTileGrid,
    getHomeTileColumns,
} from '../components/layout/home-tile-grid';
import type { HomeTile } from '../components/layout/home-tile-grid';
import { ThemeProvider, darkHudThemeColors } from '../theme';

const tiles: HomeTile[] = [
    {
        id: 'hos',
        title: 'Hours of\nService',
        sublabel: 'Shift',
        iconName: 'clock',
    },
    {
        id: 'dvir',
        title: 'Vehicle\nInspection',
        sublabel: 'Trips',
        iconName: 'clipboard',
    },
    {
        id: 'forms',
        title: 'Dispatch',
        sublabel: 'Orders',
        iconName: 'file-text',
        badgeCount: 3,
    },
    {
        id: 'documents',
        title: 'Documents',
        sublabel: 'Permits',
        iconName: 'document',
    },
];

describe('getHomeTileColumns', () => {
    it('uses three columns on a typical phone at default font scale', () => {
        expect(getHomeTileColumns(411, 1)).toBe(3);
        expect(getHomeTileColumns(360, 1)).toBe(3);
    });

    it('drops to two columns when enlarged text would clip tile labels', () => {
        expect(getHomeTileColumns(411, 1.3)).toBe(2);
        expect(getHomeTileColumns(360, 2)).toBe(2);
    });

    it('drops to two columns on very narrow screens', () => {
        expect(getHomeTileColumns(320, 1)).toBe(2);
    });
});

describe('HomeTileGrid', () => {
    it('pads a short last row so tiles keep equal widths', async () => {
        const view = await render(
            <HomeTileGrid onPressTile={jest.fn()} tiles={tiles} />,
        );

        // The jest window (750dp at font scale 2) resolves to three columns.
        const row2 = view.getByTestId('tile-row-2');
        expect(row2.children).toHaveLength(3);
        expect(view.getByTestId('tile-documents')).toBeTruthy();
    });

    it('announces the pending count and reports presses by tile id', async () => {
        const onPressTile = jest.fn();
        const view = await render(
            <HomeTileGrid onPressTile={onPressTile} tiles={tiles} />,
        );

        expect(
            view.getByLabelText('Dispatch tile, Orders, 3 pending'),
        ).toBeTruthy();
        expect(view.getByTestId('tile-forms-badge')).toHaveTextContent('3');

        await fireEvent.press(view.getByTestId('tile-forms'));
        expect(onPressTile).toHaveBeenCalledWith('forms');
    });

    it('uses Night Cab surfaces in dark HUD mode', async () => {
        const view = await render(
            <ThemeProvider initialMode="dark_hud">
                <HomeTileGrid onPressTile={jest.fn()} tiles={tiles} />
            </ThemeProvider>,
        );

        const tileStyle = StyleSheet.flatten(
            view.getByTestId('tile-hos').props.style,
        );
        expect(tileStyle.backgroundColor).toBe(darkHudThemeColors.surface);
        expect(tileStyle.borderColor).toBe(darkHudThemeColors.border);
    });
});
