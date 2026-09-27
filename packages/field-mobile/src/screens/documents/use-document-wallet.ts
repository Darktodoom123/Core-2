import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { WalletService } from '../../services/walletService';
import type { ComplianceDocument } from '../../types/index';
import { documentKey } from './document-catalog';

export interface DocumentWallet {
    documents: ComplianceDocument[];
    isLoading: boolean;
    isDownloading: boolean;
    viewingDoc: ComplianceDocument | null;
    setViewingDoc: (doc: ComplianceDocument | null) => void;
    makeOffline: (doc: ComplianceDocument) => Promise<void>;
    removeOffline: (doc: ComplianceDocument) => Promise<void>;
}

const sameDocument = (a: ComplianceDocument, b: ComplianceDocument) =>
    (a.assetCode ?? '') === (b.assetCode ?? '') && a.id === b.id;

/**
 * Loads the active unit's documents plus the operator's personnel documents,
 * de-duplicated by scope, and manages offline copies.
 */
export function useDocumentWallet(activeAssetCode: string): DocumentWallet {
    const { apiClient, user } = useAuth();
    const userId = user?.id;
    const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
    const [isLoading, setIsLoading] = useState(Boolean(userId));
    const [isDownloading, setIsDownloading] = useState(false);
    const [viewingDoc, setViewingDoc] = useState<ComplianceDocument | null>(
        null,
    );

    useEffect(() => {
        let isMounted = true;

        if (!userId) {
            return;
        }

        const loadDocs = async () => {
            setIsLoading(true);

            try {
                const assetDocs = activeAssetCode
                    ? await WalletService.getDocuments(
                          apiClient,
                          userId,
                          activeAssetCode,
                      )
                    : [];
                const personnelDocs = await WalletService.getDocuments(
                    apiClient,
                    userId,
                );
                const seen = new Set<string>();
                const combined: ComplianceDocument[] = [];

                for (const doc of [...assetDocs, ...personnelDocs]) {
                    const key = documentKey(doc);

                    if (!seen.has(key)) {
                        seen.add(key);
                        combined.push(doc);
                    }
                }

                if (isMounted) {
                    setDocuments(combined);
                }
            } catch (err) {
                console.error(
                    '[DocumentsWalletScreen] Failed to load documents:',
                    err,
                );
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        void loadDocs();

        return () => {
            isMounted = false;
        };
    }, [userId, activeAssetCode, apiClient]);

    const replaceDocument = (updated: ComplianceDocument) => {
        setDocuments((prev) =>
            prev.map((doc) => (sameDocument(doc, updated) ? updated : doc)),
        );
        setViewingDoc(updated);
    };

    const scopeFor = (doc: ComplianceDocument) =>
        doc.assetCode || (doc.operatorName ? undefined : activeAssetCode);

    const makeOffline = async (doc: ComplianceDocument) => {
        if (!user || !doc.fileUri) {
            return;
        }

        try {
            setIsDownloading(true);
            replaceDocument(
                await WalletService.makeAvailableOffline(
                    doc,
                    user.id,
                    apiClient,
                    scopeFor(doc),
                ),
            );
            Alert.alert('Success', 'Document is now available offline');
        } catch {
            Alert.alert(
                'Download Failed',
                'Could not make document available offline',
            );
        } finally {
            setIsDownloading(false);
        }
    };

    const removeOffline = async (doc: ComplianceDocument) => {
        if (!user) {
            return;
        }

        try {
            replaceDocument(
                await WalletService.removeOfflineCopy(
                    doc,
                    user.id,
                    scopeFor(doc),
                ),
            );
            Alert.alert('Success', 'Offline copy removed from device');
        } catch {
            Alert.alert('Error', 'Failed to remove local copy');
        }
    };

    return {
        documents,
        isLoading,
        isDownloading,
        viewingDoc,
        setViewingDoc,
        makeOffline,
        removeOffline,
    };
}
