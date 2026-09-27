import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { DvirScreen } from '../screens/DvirScreen';
import { FieldApiClient } from '../services/apiClient';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const renderDvir = (
    mode: ThemeMode,
    props: Partial<React.ComponentProps<typeof DvirScreen>> = {},
) =>
    render(
        <ThemeProvider initialMode={mode}>
            <DvirScreen
                assetCode="CRN-501"
                initialMode="pre_trip"
                inspectorName="BJ Bello"
                {...props}
            />
        </ThemeProvider>,
    );

describe.each(MODES)('DVIR attestation (%s)', (mode, theme: ThemeColors) => {
    jest.setTimeout(15000);

    it('has no drawn signature; the operator confirms the inspection instead', async () => {
        const view = await renderDvir(mode);

        expect(view.queryByTestId('dvir-signature-section')).toBeNull();
        expect(view.queryByText(/Digital Signature/i)).toBeNull();
        expect(
            view.getByText(
                'I inspected this unit and the answers above are true.',
            ),
        ).toBeTruthy();
        expect(
            view.getByTestId('dvir-attestation').props.accessibilityState,
        ).toMatchObject({
            checked: false,
        });
    });

    it('will not finish until the operator ticks the confirmation', async () => {
        const onSave = jest.fn();
        const view = await renderDvir(mode, { onSaveInspectionRecord: onSave });

        await fireEvent.changeText(
            view.getByTestId('input-engine-hours'),
            '1855',
        );
        expect(view.getByTestId('complete-dvir-button')).toBeDisabled();

        await fireEvent.press(view.getByTestId('dvir-attestation'));

        const box = StyleSheet.flatten(
            view.getByTestId('dvir-attestation').props.style,
        );
        expect(box.borderColor).toBe(theme.brandAmber);
        expect(box.minHeight).toBeGreaterThanOrEqual(48);
        expect(view.getByTestId('complete-dvir-button')).toBeEnabled();

        await fireEvent.press(view.getByTestId('complete-dvir-button'));
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({ signatureCaptured: true }),
        );
    });

    it('tells the server the inspection was confirmed, with no signature drawing', async () => {
        const bodies: Array<Record<string, unknown>> = [];
        const fetchFn = jest.fn(async (url: string, init?: RequestInit) => {
            if (init?.method === 'POST') {
                bodies.push(JSON.parse(String(init.body)));
            }

            return {
                ok: true,
                status: 200,
                text: async () =>
                    JSON.stringify(
                        String(url).includes('inspections?')
                            ? { data: { days: 30, inspections: [] } }
                            : {
                                  data: {
                                      id: 'DVIR-1',
                                      type: 'pre_trip',
                                      checks: [],
                                  },
                              },
                    ),
            };
        });
        const apiClient = new FieldApiClient({
            baseUrl: 'https://api.example.com',
            getToken: () => 'token',
            fetchFn: fetchFn as unknown as typeof fetch,
        });
        const view = await renderDvir(mode, { apiClient });

        await fireEvent.changeText(
            view.getByTestId('input-engine-hours'),
            '1855',
        );
        await fireEvent.press(view.getByTestId('dvir-attestation'));
        await fireEvent.press(view.getByTestId('complete-dvir-button'));

        await waitFor(() => expect(bodies).toHaveLength(1));
        expect(bodies[0].signature_captured).toBe(true);
        expect(bodies[0]).not.toHaveProperty('digital_signature');
    });
});
