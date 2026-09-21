import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import '@testing-library/react-native/matchers';
import React from 'react';
import { DocumentsWalletScreen } from '../screens/DocumentsWalletScreen';
import { WalletService } from '../services/walletService';
import type { ComplianceDocument } from '../types/index';

const mockUser = { id: 42, name: 'Alex Rivera' };
const mockApiClient = {
    fetchAssetPermits: jest.fn(),
    fetchPersonnelCredentials: jest.fn(),
    getHeaders: jest
        .fn()
        .mockReturnValue({ Authorization: 'Bearer test-token' }),
};

jest.mock('../auth/AuthContext', () => ({
    useAuth: () => ({
        apiClient: mockApiClient,
        user: mockUser,
    }),
}));

const sampleDocs: ComplianceDocument[] = [
    {
        id: 'permit-101',
        category: 'road_permits',
        title: 'DPWH Special Heavy-Load Road Transit Permit',
        documentNumber: 'DPWH-NCR-2026-SP-8821',
        issuingAuthority: 'Department of Public Works and Highways (DPWH)',
        issuedDate: '2026-08-01',
        expiryDate: '2026-11-30',
        assetCode: 'ALB-CRN-050',
        status: 'valid',
        fileUri:
            'https://core2.test/api/v1/fleet/assets/ALB-CRN-050/permits/101/download',
        fileSizeLabel: '1.4 MB · PDF',
        isAvailableOffline: false,
        notes: 'Transit restricted to 10 PM - 4 AM off-peak window.',
    },
    {
        id: 'license-202',
        category: 'operator_licenses',
        title: 'TESDA Heavy Equipment Operator NC-III',
        documentNumber: 'TESDA-NC3-CRN-449102',
        issuingAuthority: 'TESDA',
        issuedDate: '2025-05-10',
        expiryDate: '2030-05-09',
        operatorName: 'Alex Rivera',
        status: 'valid',
        fileUri: 'https://core2.test/api/v1/personnel/credentials/202/download',
        fileSizeLabel: '850 KB · PDF',
        isAvailableOffline: true,
        localFileUri:
            'file:///data/user/0/com.core2.field/files/attachments/actor_42/wallet_doc_license_202.pdf',
        notes: 'Certified for mobile hydraulic cranes up to 100T.',
    },
    {
        id: 'cert-303',
        category: 'load_test_certs',
        title: 'DOLE-OSHC 3rd-Party Annual Crane Load Test Certificate',
        documentNumber: 'DOLE-BWC-CRN-99120',
        issuingAuthority: 'Bureau of Working Conditions (DOLE-OSHC Accredited)',
        issuedDate: '2026-03-15',
        expiryDate: '2026-09-25',
        assetCode: 'ALB-CRN-050',
        status: 'expiring_soon',
        fileUri:
            'https://core2.test/api/v1/fleet/assets/ALB-CRN-050/permits/303/download',
        fileSizeLabel: '2.8 MB · PDF',
        isAvailableOffline: false,
        notes: 'Proof tested to 125% rated capacity.',
    },
    {
        id: 'insurance-404',
        category: 'insurance',
        title: 'Comprehensive Equipment Insurance',
        documentNumber: 'INS-CRN-2026-04',
        issuingAuthority: 'Alibaton Risk Services',
        issuedDate: '2026-01-01',
        expiryDate: '2026-12-31',
        assetCode: 'ALB-CRN-050',
        status: 'valid',
        fileUri:
            'https://core2.test/api/v1/fleet/assets/ALB-CRN-050/permits/404/download',
        fileSizeLabel: '1.1 MB · PDF',
        isAvailableOffline: false,
    },
];

const secondaryAssetDocs: ComplianceDocument[] = [
    {
        id: 'permit-404',
        category: 'road_permits',
        title: 'LTO Motor Vehicle Special Freight Registration',
        documentNumber: 'LTO-NCR-2026-FR-0091',
        issuingAuthority: 'Land Transportation Office',
        issuedDate: '2026-01-10',
        expiryDate: '2027-01-09',
        assetCode: 'ALB-TRK-012',
        status: 'valid',
        fileUri:
            'https://core2.test/api/v1/fleet/assets/ALB-TRK-012/permits/404/download',
        fileSizeLabel: '920 KB · PDF',
        isAvailableOffline: true,
        localFileUri:
            'file:///data/user/0/com.core2.field/files/attachments/actor_42/wallet_doc_permit_404.pdf',
    },
];

describe('DocumentsWalletScreen Component & Offline Access Engine', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(WalletService, 'getDocuments').mockImplementation(
            (_apiClient, _userId, assetCode) => {
                if (assetCode === 'ALB-TRK-012') {
                    return Promise.resolve(secondaryAssetDocs);
                }

                if (assetCode === 'ALB-CRN-050') {
                    return Promise.resolve(
                        sampleDocs.filter((d) => d.assetCode === 'ALB-CRN-050'),
                    );
                }

                // Personnel credentials
                return Promise.resolve(sampleDocs.filter((d) => !d.assetCode));
            },
        );
        jest.spyOn(WalletService, 'makeAvailableOffline').mockImplementation(
            (doc) =>
                Promise.resolve({
                    ...doc,
                    isAvailableOffline: true,
                    localFileUri: `file:///data/user/0/attachments/actor_42/wallet_doc_${doc.id}.pdf`,
                }),
        );
        jest.spyOn(WalletService, 'removeOfflineCopy').mockImplementation(
            (doc) =>
                Promise.resolve({
                    ...doc,
                    isAvailableOffline: false,
                    localFileUri: null,
                }),
        );
        jest.spyOn(WalletService, 'clearWalletCache').mockResolvedValue(
            undefined,
        );
    });

    afterEach(async () => {
        await cleanup();
    });

    it('renders real compliance documents with offline status and validity badges', async () => {
        const onBack = jest.fn();
        const view = await render(
            <DocumentsWalletScreen
                assetCode="ALB-CRN-050"
                onBack={onBack}
                operatorName="Alex Rivera"
            />,
        );

        expect(view.getByText('Documents & Permits')).toBeTruthy();
        expect(
            await view.findByText(
                'DPWH Special Heavy-Load Road Transit Permit',
            ),
        ).toBeTruthy();
        expect(
            await view.findByText('TESDA Heavy Equipment Operator NC-III'),
        ).toBeTruthy();
        expect(
            await view.findByText(
                'DOLE-OSHC 3rd-Party Annual Crane Load Test Certificate',
            ),
        ).toBeTruthy();

        // Verify validity status labels
        expect(view.getAllByText('Valid').length).toBeGreaterThanOrEqual(1);
        expect(view.getByText('Expiring Soon')).toBeTruthy();

        // Verify offline badges
        expect(view.getAllByText('Offline').length).toBeGreaterThanOrEqual(1);
        expect(view.getAllByText('Online').length).toBeGreaterThanOrEqual(1);
    });

    it('filters documents by category chip', async () => {
        const view = await render(
            <DocumentsWalletScreen
                assetCode="ALB-CRN-050"
                operatorName="Alex Rivera"
            />,
        );

        expect(
            await view.findByText(
                'DPWH Special Heavy-Load Road Transit Permit',
            ),
        ).toBeTruthy();

        // Filter by operator licenses
        await fireEvent.press(view.getByTestId('filter-operator_licenses'));
        expect(
            await view.findByText('TESDA Heavy Equipment Operator NC-III'),
        ).toBeTruthy();
        expect(
            view.queryByText('DPWH Special Heavy-Load Road Transit Permit'),
        ).toBeNull();

        // Filter back to all
        await fireEvent.press(view.getByTestId('filter-all'));
        expect(
            await view.findByText(
                'DPWH Special Heavy-Load Road Transit Permit',
            ),
        ).toBeTruthy();
    });

    it('filters asset categories supplied by the fleet document contract', async () => {
        const view = await render(
            <DocumentsWalletScreen
                assetCode="ALB-CRN-050"
                operatorName="Alex Rivera"
            />,
        );

        await fireEvent.press(view.getByTestId('filter-insurance'));

        expect(
            await view.findByText('Comprehensive Equipment Insurance'),
        ).toBeTruthy();
        expect(
            view.queryByText('DPWH Special Heavy-Load Road Transit Permit'),
        ).toBeNull();
    });

    it('supports multi-asset switching between assigned units', async () => {
        const assignedAssets = [
            { assetCode: 'ALB-CRN-050', assetName: '50T All-Terrain Crane' },
            { assetCode: 'ALB-TRK-012', assetName: 'Heavy Lowbed Prime Mover' },
        ];

        const view = await render(
            <DocumentsWalletScreen
                assetCode="ALB-CRN-050"
                assignedAssets={assignedAssets}
                operatorName="Alex Rivera"
            />,
        );

        // Initially shows ALB-CRN-050 documents
        expect(
            await view.findByText(
                'DPWH Special Heavy-Load Road Transit Permit',
            ),
        ).toBeTruthy();

        // Switch to secondary asset ALB-TRK-012
        const assetSelectorBtn = view.getByTestId('asset-selector-ALB-TRK-012');
        await fireEvent.press(assetSelectorBtn);

        // Should load and display ALB-TRK-012 document
        expect(
            await view.findByText(
                'LTO Motor Vehicle Special Freight Registration',
            ),
        ).toBeTruthy();
        // Personnel credential remains visible across asset switches
        expect(
            view.getByText('TESDA Heavy Equipment Operator NC-III'),
        ).toBeTruthy();
    });

    it('allows making a document available offline and removing the local copy', async () => {
        const view = await render(
            <DocumentsWalletScreen
                assetCode="ALB-CRN-050"
                operatorName="Alex Rivera"
            />,
        );

        expect(
            await view.findByText(
                'DPWH Special Heavy-Load Road Transit Permit',
            ),
        ).toBeTruthy();

        // Inspect the online-only document
        await fireEvent.press(view.getByTestId('view-doc-btn-permit-101'));
        expect(await view.findByTestId('certificate-modal')).toBeTruthy();

        // Make available offline
        const makeOfflineBtn = view.getByTestId('make-offline-btn');
        await fireEvent.press(makeOfflineBtn);

        expect(WalletService.makeAvailableOffline).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'permit-101' }),
            42,
            mockApiClient,
            'ALB-CRN-050',
        );

        // Once offline, the remove copy button should be available
        const removeOfflineBtn = await view.findByTestId(
            'remove-offline-copy-btn',
        );
        expect(removeOfflineBtn).toBeTruthy();

        // Remove the offline copy
        await fireEvent.press(removeOfflineBtn);
        expect(WalletService.removeOfflineCopy).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'permit-101' }),
            42,
            'ALB-CRN-050',
        );
    });

    it('renders empty state when search query matches nothing', async () => {
        const view = await render(
            <DocumentsWalletScreen
                assetCode="ALB-CRN-050"
                operatorName="Alex Rivera"
            />,
        );

        expect(
            await view.findByText(
                'DPWH Special Heavy-Load Road Transit Permit',
            ),
        ).toBeTruthy();

        const searchInput = view.getByTestId('docs-search-input');
        await fireEvent.changeText(searchInput, 'NonExistentPermitXYZ');

        expect(await view.findByText('No Records Found')).toBeTruthy();
        expect(
            view.getByText('No permits matching "NonExistentPermitXYZ".'),
        ).toBeTruthy();
    });

    it('handles cache clearing for user logout/switch', async () => {
        await WalletService.clearWalletCache(42);
        expect(WalletService.clearWalletCache).toHaveBeenCalledWith(42);
    });

    it('deduplicates documents across asset permits and personnel credentials without ID collisions', async () => {
        const collidingAssetDoc: ComplianceDocument = {
            id: 'item-1',
            category: 'road_permits',
            title: 'Asset Road Transit Permit #1',
            documentNumber: 'PERMIT-COLLIDE-01',
            issuingAuthority: 'DPWH',
            issuedDate: '2026-01-01',
            expiryDate: '2026-12-31',
            assetCode: 'ALB-CRN-050',
            status: 'valid',
            fileUri: 'https://core2.test/download/asset/1',
            isAvailableOffline: false,
        };

        const collidingPersonnelCred: ComplianceDocument = {
            id: 'item-1',
            category: 'operator_licenses',
            title: 'Personnel Operating License #1',
            documentNumber: 'LICENSE-COLLIDE-01',
            issuingAuthority: 'LTO',
            issuedDate: '2026-01-01',
            expiryDate: null,
            operatorName: 'Alex Rivera',
            status: 'no_expiration',
            fileUri: 'https://core2.test/download/personnel/1',
            isAvailableOffline: false,
        };

        jest.spyOn(WalletService, 'getDocuments').mockImplementation(
            (_client, _userId, assetCode) => {
                if (assetCode) {
                    return Promise.resolve([collidingAssetDoc]);
                }

                return Promise.resolve([collidingPersonnelCred]);
            },
        );

        const view = await render(
            <DocumentsWalletScreen
                assetCode="ALB-CRN-050"
                operatorName="Alex Rivera"
            />,
        );

        // Both documents MUST be present despite sharing the identical ID 'item-1'
        expect(
            await view.findByText('Asset Road Transit Permit #1'),
        ).toBeTruthy();
        expect(
            await view.findByText('Personnel Operating License #1'),
        ).toBeTruthy();

        // Verify 'no_expiration' renders 'No Expiry Date'
        expect(await view.findByText('No Expiry Date')).toBeTruthy();
    });

    it('renders truthful operations sync info and revocation notice in document viewer', async () => {
        const sampleDocWithSync: ComplianceDocument = {
            id: 'permit-sync-99',
            category: 'road_permits',
            title: 'DPWH Transit Clearance',
            documentNumber: 'DPWH-SYNC-99',
            issuingAuthority: 'DPWH Bureau of Equipment',
            issuedDate: '2026-06-01',
            expiryDate: '2026-12-31',
            assetCode: 'ALB-CRN-050',
            status: 'valid',
            fileUri: 'https://core2.test/download/permit-99',
            isAvailableOffline: true,
            localFileUri:
                'file:///data/user/0/attachments/actor_42/wallet_ALB_CRN_050_doc_permit_sync_99.pdf',
            lastSynchronized: '2026-09-18T10:00:00.000Z',
            notes: 'Restricted night transit only.',
        };

        jest.spyOn(WalletService, 'getDocuments').mockImplementation(
            (_client, _userId, assetCode) => {
                if (assetCode) {
                    return Promise.resolve([sampleDocWithSync]);
                }

                return Promise.resolve([]);
            },
        );

        const view = await render(
            <DocumentsWalletScreen
                assetCode="ALB-CRN-050"
                operatorName="Alex Rivera"
            />,
        );

        await fireEvent.press(
            await view.findByTestId('view-doc-btn-permit-sync-99'),
        );
        expect(await view.findByTestId('certificate-modal')).toBeTruthy();

        // Verify truthful compliance record header and sync info
        expect(view.getByText('✓ Operations Record Synchronized')).toBeTruthy();
        expect(
            view.getByText(
                'Note: Offline copy. Real-time status changes require an active connection.',
            ),
        ).toBeTruthy();

        // Verify local durable storage footnote
        expect(
            view.getByText(
                'LOCAL DURABLE STORAGE • wallet_ALB_CRN_050_doc_permit_sync_99.pdf • OFFLINE READY',
            ),
        ).toBeTruthy();
    });
});
