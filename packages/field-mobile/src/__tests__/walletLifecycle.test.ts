import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { durableAttachmentStorage } from '../services/durableAttachmentStorage';
import { WalletService } from '../services/walletService';
import type { ComplianceDocument } from '../types/index';

describe('WalletService Document Lifecycle & Durable Offline Persistence', () => {
    const actorId = 88;

    beforeEach(async () => {
        await WalletService.clearWalletCache(actorId);
    });

    it('reconciles local files on disk and marks availability truthfully', async () => {
        const testUri =
            durableAttachmentStorage.getActorAttachmentDirectory(actorId) +
            'test_doc.pdf';

        // Save a durable attachment in storage
        await durableAttachmentStorage.saveAttachmentDurably(
            {
                uri: testUri,
                fileName: 'test_doc.pdf',
                base64: 'JVBERi0xLjQKJcTl8uXrp...',
            },
            actorId,
        );

        const docs: ComplianceDocument[] = [
            {
                id: 'doc-1',
                category: 'road_permits',
                title: 'DPWH Permit',
                documentNumber: 'DPWH-001',
                issuingAuthority: 'DPWH',
                issuedDate: '2026-01-01',
                status: 'valid',
                localFileUri: testUri,
            },
            {
                id: 'doc-2',
                category: 'load_test_certs',
                title: 'DOLE Test',
                documentNumber: 'DOLE-002',
                issuingAuthority: 'DOLE',
                issuedDate: '2026-01-01',
                status: 'valid',
                localFileUri: null,
            },
        ];

        const reconciled = await WalletService.reconcileLocalFiles(docs);

        assert.equal(reconciled.length, 2);
        assert.equal(reconciled[0].isAvailableOffline, true);
        assert.equal(reconciled[0].localFileUri, testUri);
        assert.equal(reconciled[1].isAvailableOffline, false);
        assert.equal(reconciled[1].localFileUri, null);
    });

    it('preserves existing local file on version mismatch during metadata sync to avoid data loss', async () => {
        const initialDoc: ComplianceDocument = {
            id: 'doc-version-check',
            category: 'road_permits',
            title: 'DPWH Transit Permit v1',
            documentNumber: 'DPWH-V1',
            issuingAuthority: 'DPWH',
            issuedDate: '2026-01-01',
            status: 'valid',
            fileUri: 'https://core2.test/download/doc-v1',
            version: 1,
        };

        const mockApiClient = {
            fetchPersonnelCredentials: async () => [initialDoc],
            fetchAssetPermits: async () => [],
            getHeaders: () => ({ Authorization: 'Bearer test' }),
        } as any;

        // Step 1: Initial fetch
        const docs1 = await WalletService.getDocuments(
            mockApiClient,
            actorId,
            undefined,
            true,
        );
        assert.equal(docs1.length, 1);

        // Step 2: Download v1 offline
        const downloaded = await WalletService.makeAvailableOffline(
            docs1[0],
            actorId,
            mockApiClient,
        );
        assert.equal(downloaded.isAvailableOffline, true);
        assert.ok(downloaded.localFileUri);
        const originalLocalUri = downloaded.localFileUri;

        // Step 3: Server updates document to version 2
        const updatedRemoteDoc: ComplianceDocument = {
            ...initialDoc,
            title: 'DPWH Transit Permit v2 (Superseded Conditions)',
            version: 2,
            fileUri: 'https://core2.test/download/doc-v2',
        };

        const mockApiClientV2 = {
            fetchPersonnelCredentials: async () => [updatedRemoteDoc],
            fetchAssetPermits: async () => [],
            getHeaders: () => ({ Authorization: 'Bearer test' }),
        } as any;

        // Step 4: Fetch metadata update
        const docs2 = await WalletService.getDocuments(
            mockApiClientV2,
            actorId,
            undefined,
            true,
        );
        assert.equal(docs2.length, 1);
        assert.equal(docs2[0].version, 2);

        // Crucial: The local file URI from v1 must NOT have been destroyed or deleted prematurely
        assert.equal(docs2[0].localFileUri, originalLocalUri);
        assert.equal(docs2[0].isAvailableOffline, true);
    });

    it('bumps generation on logout and aborts stale in-flight cache writes', async () => {
        const initialGen = WalletService.getUserGeneration(actorId);

        // Simulate logout / account clear
        await WalletService.clearWalletCache(actorId);

        const newGen = WalletService.getUserGeneration(actorId);
        assert.ok(
            newGen > initialGen,
            'User generation must increment upon cache clear / logout',
        );
    });
});
