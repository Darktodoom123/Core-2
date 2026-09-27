import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Icon } from '../components/common/Icon';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { useTheme, useThemedStyles } from '../theme';
import type { ThemeColors } from '../theme';
import { DocumentCard } from './documents/document-card';
import {
    documentKey,
    filterDocuments,
    resolveActiveAssetCode,
} from './documents/document-catalog';
import type {
    AssignedAsset,
    CategoryFilter,
} from './documents/document-catalog';
import {
    AssetSelector,
    CategoryRail,
    DocumentSearch,
} from './documents/document-filters';
import { DocumentViewerSheet } from './documents/document-viewer-sheet';
import { useDocumentWallet } from './documents/use-document-wallet';

export interface DocumentsWalletScreenProps {
    onBack?: () => void;
    assetCode?: string;
    operatorName?: string;
    assignedAssets?: AssignedAsset[];
}

export const DocumentsWalletScreen: React.FC<DocumentsWalletScreenProps> = ({
    onBack,
    assetCode = 'ALB-CRN-050',
    operatorName = 'Alex Rivera',
    assignedAssets,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [requestedAssetCode, setRequestedAssetCode] =
        useState<string>(assetCode);
    const activeAssetCode = resolveActiveAssetCode(
        requestedAssetCode,
        assignedAssets,
    );
    const [selectedCategory, setSelectedCategory] =
        useState<CategoryFilter>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const wallet = useDocumentWallet(activeAssetCode);

    const filteredDocs = useMemo(
        () => filterDocuments(wallet.documents, selectedCategory, searchQuery),
        [wallet.documents, selectedCategory, searchQuery],
    );

    return (
        <View style={styles.root} testID="documents-wallet-screen">
            <TileScreenHeader
                backAccessibilityLabel="Back to dashboard"
                backTestID="docs-back-button"
                category="Permits & Certs"
                onBack={onBack}
                subtitle={`${activeAssetCode || 'Unit'} · ${operatorName}`}
                title="Documents & Permits"
            />

            {assignedAssets && assignedAssets.length > 1 ? (
                <AssetSelector
                    activeAssetCode={activeAssetCode}
                    assets={assignedAssets}
                    onSelect={setRequestedAssetCode}
                />
            ) : null}

            <DocumentSearch onChange={setSearchQuery} value={searchQuery} />

            <CategoryRail
                documents={wallet.documents}
                onSelect={setSelectedCategory}
                selected={selectedCategory}
            />

            {wallet.isLoading ? (
                <View style={styles.loading}>
                    <ActivityIndicator
                        color={theme.textSecondary}
                        size="large"
                    />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    style={styles.scrollView}
                >
                    {filteredDocs.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Icon
                                color={theme.textSecondary}
                                name="document"
                                size={32}
                            />
                            <Text style={styles.emptyTitle}>
                                No Records Found
                            </Text>
                            <Text style={styles.emptySubtitle}>
                                {searchQuery
                                    ? `No permits matching "${searchQuery}".`
                                    : 'No documents in this category.'}
                            </Text>
                        </View>
                    ) : (
                        filteredDocs.map((doc) => (
                            <DocumentCard
                                doc={doc}
                                key={documentKey(doc)}
                                onOpen={wallet.setViewingDoc}
                            />
                        ))
                    )}
                </ScrollView>
            )}

            {wallet.viewingDoc ? (
                <DocumentViewerSheet
                    doc={wallet.viewingDoc}
                    isDownloading={wallet.isDownloading}
                    onClose={() => wallet.setViewingDoc(null)}
                    onMakeOffline={(doc) => void wallet.makeOffline(doc)}
                    onRemoveOffline={(doc) => void wallet.removeOffline(doc)}
                />
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        root: {
            backgroundColor: theme.canvas,
            flex: 1,
        },
        loading: {
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
        },
        scrollView: {
            flex: 1,
        },
        scrollContent: {
            padding: 16,
            paddingBottom: 40,
        },
        emptyCard: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            gap: 6,
            marginTop: 12,
            padding: 32,
        },
        emptyTitle: {
            color: theme.textPrimary,
            fontSize: 17,
            fontWeight: '700',
        },
        emptySubtitle: {
            color: theme.textSecondary,
            fontSize: 14,
            textAlign: 'center',
        },
    });
