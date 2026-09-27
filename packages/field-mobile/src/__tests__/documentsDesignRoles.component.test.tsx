import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { DocumentsWalletScreen } from '../screens/DocumentsWalletScreen';
import { WalletService } from '../services/walletService';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';
import type { ComplianceDocument } from '../types/index';

// Stable references, like the real context: a new client per render would
// re-run the wallet's load effect forever.
const mockAuth = {
    apiClient: {},
    user: { id: 42, name: 'Alex Rivera' },
};

jest.mock('../auth/AuthContext', () => ({
    useAuth: () => mockAuth,
}));

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const expiredPermit: ComplianceDocument = {
    id: 'permit-9',
    category: 'road_permits',
    title: 'Oversize Load Permit',
    documentNumber: 'DPWH-9',
    issuingAuthority: 'DPWH',
    issuedDate: '2025-01-01',
    expiryDate: '2026-01-01',
    assetCode: 'ALB-CRN-050',
    status: 'expired',
    fileUri: 'https://core2.test/permits/9/download',
    fileSizeLabel: '1 MB · PDF',
    isAvailableOffline: false,
    notes: 'Night transit only.',
};

const neverSynced: ComplianceDocument = {
    ...expiredPermit,
    id: 'permit-10',
    title: 'Unsynced Permit',
    status: 'valid',
    lastSynchronized: null,
};

type View = Awaited<ReturnType<typeof render>>;

const flat = (view: View, testID: string) => {
    const style = view.getByTestId(testID).props.style;

    return StyleSheet.flatten(
        typeof style === 'function' ? style({ pressed: false }) : style,
    );
};

const renderWallet = async (mode: ThemeMode, docs: ComplianceDocument[]) => {
    jest.spyOn(WalletService, 'getDocuments').mockImplementation(
        (_client, _user, assetCode) => Promise.resolve(assetCode ? docs : []),
    );

    const view = await render(
        <ThemeProvider initialMode={mode}>
            <DocumentsWalletScreen
                assetCode="ALB-CRN-050"
                operatorName="Alex Rivera"
            />
        </ThemeProvider>,
    );

    await view.findByText(docs[0].title);

    return view;
};

describe.each(MODES)(
    'Documents design roles (%s)',
    (mode, theme: ThemeColors) => {
        afterEach(() => jest.restoreAllMocks());

        it('draws document cards as resting bordered panels with a red Expired pill', async () => {
            const view = await renderWallet(mode, [expiredPermit]);
            const card = flat(view, 'doc-card-permit-9');

            expect(card.backgroundColor).toBe(theme.surface);
            expect(card.borderColor).toBe(theme.border);
            expect(card.elevation).toBeUndefined();

            expect(flat(view, 'doc-status-permit-9').backgroundColor).toBe(
                theme.hazardRedLight,
            );
            expect(
                StyleSheet.flatten(view.getByText('Expired').props.style).color,
            ).toBe(theme.hazardRedText);
        });

        it('opens one honest detail view that leads with the real status', async () => {
            const view = await renderWallet(mode, [expiredPermit]);

            await fireEvent.press(view.getByTestId('view-doc-btn-permit-9'));
            await view.findByTestId('certificate-modal');

            const banner = flat(view, 'doc-viewer-status');

            expect(banner.backgroundColor).toBe(theme.hazardRedLight);
            expect(view.getByText(/Expired on 2026-01-01/)).toBeTruthy();

            // No fabricated certificate content.
            expect(view.queryByText(/This certifies/)).toBeNull();
            expect(view.queryByText(/REPUBLIC OF THE PHILIPPINES/)).toBeNull();
            expect(view.queryByText(/\|\|\|\|\|/)).toBeNull();
            expect(view.queryByText('Source Document')).toBeNull();
            expect(
                view.queryByText(/Operations Record Synchronized/),
            ).toBeNull();
        });

        it('says a never-synced document has not been synced', async () => {
            const view = await renderWallet(mode, [neverSynced]);

            await fireEvent.press(view.getByTestId('view-doc-btn-permit-10'));
            await view.findByTestId('certificate-modal');

            expect(
                view.getByText('Not synced on this device yet'),
            ).toBeTruthy();
        });

        it('makes saving offline the gold primary action with dark ink', async () => {
            const view = await renderWallet(mode, [expiredPermit]);

            await fireEvent.press(view.getByTestId('view-doc-btn-permit-9'));
            await view.findByTestId('certificate-modal');

            const save = flat(view, 'make-offline-btn');

            expect(save.backgroundColor).toBe(theme.brandAmber);
            expect(save.minHeight).toBeGreaterThanOrEqual(52);
            expect(
                StyleSheet.flatten(
                    view.getByText('Make Available Offline').props.style,
                ).color,
            ).toBe(theme.surfaceDark);
            expect(flat(view, 'doc-viewer-sheet').backgroundColor).toBe(
                theme.surface,
            );
        });
    },
);
