import React, { useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Icon } from '../components/common/Icon';
import { colors, shadows } from '../components/nativeStyles';
import { useTheme } from '../theme';
import type { ComplianceDocument, DocumentCategory } from '../types/index';

export interface DocumentsWalletScreenProps {
    onBack?: () => void;
    assetCode?: string;
    operatorName?: string;
}

const DEFAULT_DOCUMENTS: ComplianceDocument[] = [
    {
        id: 'doc-permit-01',
        category: 'road_permits',
        title: 'DPWH Special Heavy-Load Road Transit Permit',
        documentNumber: 'DPWH-NCR-2026-SP-8821',
        issuingAuthority: 'Department of Public Works and Highways (DPWH)',
        issuedDate: '2026-08-01',
        expiryDate: '2026-11-30',
        assetCode: 'ALB-CRN-050',
        status: 'valid',
        fileSizeLabel: '1.4 MB · PDF',
        notes: 'Permits 50-Ton all-terrain crane transit along C-5, EDSA, and NLEX during designated off-peak travel window (10:00 PM – 4:00 AM).',
    },
    {
        id: 'doc-loadtest-01',
        category: 'load_test_certs',
        title: 'DOLE-OSHC 3rd-Party Annual Crane Load Test Certificate',
        documentNumber: 'DOLE-BWC-CRN-99120',
        issuingAuthority: 'Bureau of Working Conditions (DOLE-OSHC Accredited)',
        issuedDate: '2026-03-15',
        expiryDate: '2027-03-14',
        assetCode: 'ALB-CRN-050',
        status: 'valid',
        fileSizeLabel: '2.8 MB · PDF',
        notes: 'Passed 125% overload proof test. Wire ropes, outrigger rams, and boom sections certified operational.',
    },
    {
        id: 'doc-license-01',
        category: 'operator_licenses',
        title: 'TESDA Heavy Equipment Operator (Mobile Crane) NC-III',
        documentNumber: 'TESDA-NC3-CRN-449102',
        issuingAuthority:
            'Technical Education and Skills Development Authority (TESDA)',
        issuedDate: '2025-05-10',
        expiryDate: '2030-05-09',
        operatorName: 'Alex Rivera',
        status: 'valid',
        fileSizeLabel: '850 KB · PDF',
        notes: 'Certified for hydraulic mobile cranes up to 100 metric tons capacity.',
    },
    {
        id: 'doc-insurance-01',
        category: 'road_permits',
        title: 'Comprehensive Machinery & Third-Party Liability Insurance',
        documentNumber: 'MAPFRE-INS-2026-CRN050',
        issuingAuthority: 'Mapfre Insular Insurance Corp.',
        issuedDate: '2026-01-01',
        expiryDate: '2026-12-31',
        assetCode: 'ALB-CRN-050',
        status: 'valid',
        fileSizeLabel: '1.1 MB · PDF',
        notes: 'Full commercial site liability and machine hull damage coverage across Philippine territory.',
    },
    {
        id: 'doc-dr-01',
        category: 'delivery_receipts',
        title: 'Job Dispatch Delivery Receipt & Work Ticket',
        documentNumber: 'DR-2026-0891-DMCI',
        issuingAuthority: 'Alibaton Heavy Equipment Operations',
        issuedDate: '2026-08-31',
        assetCode: 'ALB-CRN-050',
        status: 'valid',
        fileSizeLabel: '640 KB · PDF',
        notes: 'Dispatched for DMCI Power & Infra project. Dual-party site sign-off pending.',
    },
];

const CATEGORIES: Array<{ key: DocumentCategory | 'all'; label: string }> = [
    { key: 'all', label: 'All Documents' },
    { key: 'road_permits', label: 'Road Permits' },
    { key: 'load_test_certs', label: 'Load Tests' },
    { key: 'operator_licenses', label: 'Licenses' },
    { key: 'delivery_receipts', label: 'Delivery' },
];

export const DocumentsWalletScreen: React.FC<DocumentsWalletScreenProps> = ({
    onBack,
    assetCode = 'ALB-CRN-050',
    operatorName = 'Alex Rivera',
}) => {
    const { isDarkHud } = useTheme();
    const [selectedCategory, setSelectedCategory] = useState<
        DocumentCategory | 'all'
    >('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingDoc, setViewingDoc] = useState<ComplianceDocument | null>(
        null,
    );
    const [modalViewMode, setModalViewMode] = useState<'pdf' | 'summary'>(
        'pdf',
    );

    const filteredDocs = useMemo(() => {
        return DEFAULT_DOCUMENTS.filter((doc) => {
            const matchesCategory =
                selectedCategory === 'all' || doc.category === selectedCategory;
            const query = searchQuery.trim().toLowerCase();
            const matchesQuery =
                !query ||
                doc.title.toLowerCase().includes(query) ||
                doc.documentNumber.toLowerCase().includes(query) ||
                doc.issuingAuthority.toLowerCase().includes(query);

            return matchesCategory && matchesQuery;
        });
    }, [selectedCategory, searchQuery]);

    const getStatusStyle = (status: ComplianceDocument['status']) => {
        switch (status) {
            case 'valid':
                return {
                    label: 'Valid',
                    icon: 'check' as const,
                    color: isDarkHud ? '#34D399' : colors.greenDark,
                    bg: isDarkHud
                        ? 'rgba(5, 150, 105, 0.2)'
                        : colors.greenLight,
                    border: isDarkHud ? '#059669' : colors.greenBorder,
                };
            case 'expiring_soon':
                return {
                    label: 'Expiring Soon',
                    icon: 'alert' as const,
                    color: isDarkHud ? '#FCD34D' : colors.amberDark,
                    bg: isDarkHud
                        ? 'rgba(217, 119, 6, 0.2)'
                        : colors.amberLight,
                    border: isDarkHud ? '#D97706' : colors.amberBorder,
                };
            case 'expired':
                return {
                    label: 'Expired',
                    icon: 'close' as const,
                    color: isDarkHud ? '#F87171' : colors.redDark,
                    bg: isDarkHud ? 'rgba(239, 68, 68, 0.2)' : colors.redLight,
                    border: isDarkHud ? '#DC2626' : colors.redBorder,
                };
        }
    };

    return (
        <View
            style={[styles.root, isDarkHud && styles.rootDark]}
            testID="documents-wallet-screen"
        >
            {/* Header: Minimalist Industrial Cockpit */}
            <View style={[styles.header, isDarkHud && styles.headerDark]}>
                <View style={styles.headerLeft}>
                    {onBack ? (
                        <Pressable
                            accessibilityLabel="Back to previous screen"
                            accessibilityRole="button"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={onBack}
                            style={({ pressed }) => [
                                styles.backBtn,
                                pressed && styles.pressed,
                            ]}
                            testID="docs-back-button"
                        >
                            <Icon
                                color={isDarkHud ? colors.hudText : colors.text}
                                name="back"
                                size={18}
                            />
                            <Text
                                style={[
                                    styles.backText,
                                    isDarkHud && styles.backTextDark,
                                ]}
                            >
                                Back
                            </Text>
                        </Pressable>
                    ) : null}

                    <View style={styles.headerTitleWrap}>
                        <Text
                            style={[
                                styles.title,
                                isDarkHud && styles.titleDark,
                            ]}
                        >
                            Documents & Permits
                        </Text>
                        <Text
                            style={[
                                styles.subtitle,
                                isDarkHud && styles.subtitleDark,
                            ]}
                        >
                            {assetCode} · {operatorName}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Integrated Search Input */}
            <View style={styles.searchSection}>
                <View
                    style={[
                        styles.searchInputWrap,
                        isDarkHud && styles.searchInputWrapDark,
                    ]}
                >
                    <Icon
                        color={isDarkHud ? colors.hudTextDim : colors.muted}
                        name="search"
                        size={16}
                    />
                    <TextInput
                        accessibilityLabel="Search documents"
                        onChangeText={setSearchQuery}
                        placeholder="Search permits, cert number, or agency..."
                        placeholderTextColor={
                            isDarkHud ? '#64748B' : colors.muted
                        }
                        style={[
                            styles.searchInput,
                            isDarkHud && styles.searchInputDark,
                        ]}
                        testID="docs-search-input"
                        value={searchQuery}
                    />
                    {searchQuery.length > 0 ? (
                        <Pressable
                            accessibilityLabel="Clear search text"
                            accessibilityRole="button"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            onPress={() => setSearchQuery('')}
                            style={styles.clearBtn}
                        >
                            <Icon
                                color={
                                    isDarkHud ? colors.hudTextDim : colors.muted
                                }
                                name="close"
                                size={14}
                            />
                        </Pressable>
                    ) : null}
                </View>
            </View>

            {/* Category Filter Rail */}
            <View style={styles.categoryRailSection}>
                <ScrollView
                    contentContainerStyle={styles.categoryRail}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                >
                    {CATEGORIES.map((cat) => {
                        const isSelected = selectedCategory === cat.key;
                        const isAll = cat.key === 'all';
                        const count = isAll
                            ? DEFAULT_DOCUMENTS.length
                            : DEFAULT_DOCUMENTS.filter(
                                  (d) => d.category === cat.key,
                              ).length;

                        return (
                            <Pressable
                                accessibilityRole="button"
                                key={cat.key}
                                onPress={() => setSelectedCategory(cat.key)}
                                style={({ pressed }) => [
                                    styles.categoryChip,
                                    isDarkHud && styles.categoryChipDark,
                                    isAll &&
                                        !isSelected &&
                                        styles.categoryChipAll,
                                    isDarkHud &&
                                        isAll &&
                                        !isSelected &&
                                        styles.categoryChipAllDark,
                                    isSelected && styles.categoryChipActive,
                                    isDarkHud &&
                                        isSelected &&
                                        styles.categoryChipActiveDark,
                                    pressed && styles.pressed,
                                ]}
                                testID={`filter-${cat.key}`}
                            >
                                <Text
                                    style={[
                                        styles.categoryChipText,
                                        isDarkHud &&
                                            styles.categoryChipTextDark,
                                        isAll &&
                                            !isSelected &&
                                            styles.categoryChipTextAll,
                                        isDarkHud &&
                                            isAll &&
                                            !isSelected &&
                                            styles.categoryChipTextAllDark,
                                        isSelected &&
                                            styles.categoryChipTextActive,
                                        isDarkHud &&
                                            isSelected &&
                                            styles.categoryChipTextActiveDark,
                                    ]}
                                >
                                    {cat.label}
                                </Text>
                                <View
                                    style={[
                                        styles.countTag,
                                        isAll &&
                                            !isSelected &&
                                            styles.countTagAll,
                                        isDarkHud &&
                                            isAll &&
                                            !isSelected &&
                                            styles.countTagAllDark,
                                        isSelected && styles.countTagActive,
                                        isDarkHud && styles.countTagDark,
                                        isDarkHud &&
                                            isSelected &&
                                            styles.countTagActiveDark,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.countTagText,
                                            isAll &&
                                                !isSelected &&
                                                styles.countTagTextAll,
                                            isDarkHud &&
                                                isAll &&
                                                !isSelected &&
                                                styles.countTagTextAllDark,
                                            isSelected &&
                                                styles.countTagTextActive,
                                            isDarkHud &&
                                                styles.countTagTextDark,
                                            isDarkHud &&
                                                isSelected &&
                                                styles.countTagTextActiveDark,
                                        ]}
                                    >
                                        {count}
                                    </Text>
                                </View>
                            </Pressable>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Streamlined Industrial Document Cards */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                style={styles.scrollView}
            >
                {filteredDocs.length === 0 ? (
                    <View
                        style={[
                            styles.emptyCard,
                            isDarkHud && styles.emptyCardDark,
                        ]}
                    >
                        <Icon
                            color={isDarkHud ? '#64748B' : colors.muted}
                            name="document"
                            size={32}
                        />
                        <Text
                            style={[
                                styles.emptyTitle,
                                isDarkHud && styles.emptyTitleDark,
                            ]}
                        >
                            No Records Found
                        </Text>
                        <Text
                            style={[
                                styles.emptySubtitle,
                                isDarkHud && styles.emptySubtitleDark,
                            ]}
                        >
                            {searchQuery
                                ? `No permits matching "${searchQuery}".`
                                : 'No documents in this category.'}
                        </Text>
                    </View>
                ) : (
                    filteredDocs.map((doc) => {
                        const status = getStatusStyle(doc.status);

                        return (
                            <View
                                key={doc.id}
                                style={[
                                    styles.docCardContainer,
                                    isDarkHud && styles.docCardContainerDark,
                                ]}
                                testID={`doc-card-${doc.id}`}
                            >
                                <Pressable
                                    accessibilityLabel={`View ${doc.title}`}
                                    accessibilityRole="button"
                                    onPress={() => {
                                        setViewingDoc(doc);
                                        setModalViewMode('pdf');
                                    }}
                                    style={({ pressed }) => [
                                        styles.docCardPressable,
                                        pressed && styles.cardPressed,
                                    ]}
                                    testID={`view-doc-btn-${doc.id}`}
                                >
                                    {/* Top Metadata Row: Status & Mono ID */}
                                    <View style={styles.cardTopRow}>
                                        <Text
                                            style={[
                                                styles.docNumberMono,
                                                isDarkHud &&
                                                    styles.docNumberMonoDark,
                                            ]}
                                        >
                                            {doc.documentNumber}
                                        </Text>

                                        <View
                                            style={[
                                                styles.statusPill,
                                                {
                                                    backgroundColor: status.bg,
                                                    borderColor: status.border,
                                                },
                                            ]}
                                        >
                                            <Icon
                                                color={status.color}
                                                name={status.icon}
                                                size={10}
                                            />
                                            <Text
                                                style={[
                                                    styles.statusPillText,
                                                    { color: status.color },
                                                ]}
                                            >
                                                {status.label}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Document Title */}
                                    <Text
                                        numberOfLines={2}
                                        style={[
                                            styles.docCardTitle,
                                            isDarkHud &&
                                                styles.docCardTitleDark,
                                        ]}
                                    >
                                        {doc.title}
                                    </Text>

                                    {/* Authority & Validity */}
                                    <View style={styles.metaRow}>
                                        <Text
                                            numberOfLines={1}
                                            style={[
                                                styles.authorityText,
                                                isDarkHud &&
                                                    styles.authorityTextDark,
                                            ]}
                                        >
                                            {doc.issuingAuthority}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.validityDate,
                                                isDarkHud &&
                                                    styles.validityDateDark,
                                            ]}
                                        >
                                            Exp: {doc.expiryDate || 'Permanent'}
                                        </Text>
                                    </View>

                                    {/* Operational Restrictions Callout */}
                                    {doc.notes ? (
                                        <View
                                            style={[
                                                styles.conditionStrip,
                                                isDarkHud &&
                                                    styles.conditionStripDark,
                                            ]}
                                        >
                                            <Text
                                                numberOfLines={2}
                                                style={[
                                                    styles.conditionText,
                                                    isDarkHud &&
                                                        styles.conditionTextDark,
                                                ]}
                                            >
                                                {doc.notes}
                                            </Text>
                                        </View>
                                    ) : null}

                                    {/* Bottom Action Footer: Clean file tag and tap prompt */}
                                    <View
                                        style={[
                                            styles.cardFooter,
                                            isDarkHud && styles.cardFooterDark,
                                        ]}
                                    >
                                        <View style={styles.fileTag}>
                                            <Icon
                                                color={
                                                    isDarkHud
                                                        ? colors.hudAmber
                                                        : colors.amberDark
                                                }
                                                name="file-text"
                                                size={13}
                                            />
                                            <Text
                                                style={[
                                                    styles.fileTagText,
                                                    isDarkHud &&
                                                        styles.fileTagTextDark,
                                                ]}
                                            >
                                                {doc.fileSizeLabel || 'PDF'}
                                            </Text>
                                        </View>
                                        <View style={styles.tapPrompt}>
                                            <Text
                                                style={[
                                                    styles.tapPromptText,
                                                    isDarkHud &&
                                                        styles.tapPromptTextDark,
                                                ]}
                                            >
                                                Inspect
                                            </Text>
                                            <Icon
                                                color={
                                                    isDarkHud
                                                        ? colors.hudTextDim
                                                        : colors.muted
                                                }
                                                name="chevron-right"
                                                size={14}
                                            />
                                        </View>
                                    </View>
                                </Pressable>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* DOT / DOLE Official PDF Inspection Modal Bottom Sheet */}
            {viewingDoc ? (
                <Modal
                    animationType="slide"
                    onRequestClose={() => setViewingDoc(null)}
                    transparent
                    visible={Boolean(viewingDoc)}
                >
                    <View
                        style={styles.modalBackdrop}
                        testID="certificate-modal"
                    >
                        {/* Tap outside to dismiss backdrop */}
                        <Pressable
                            accessibilityLabel="Dismiss modal backdrop"
                            accessibilityRole="button"
                            onPress={() => setViewingDoc(null)}
                            style={styles.backdropTouchArea}
                        />

                        <View
                            style={[
                                styles.inspectionSheet,
                                isDarkHud && styles.inspectionSheetDark,
                            ]}
                        >
                            {/* Drag handle pill */}
                            <View style={styles.sheetHandleBar}>
                                <View
                                    style={[
                                        styles.sheetHandle,
                                        isDarkHud && styles.sheetHandleDark,
                                    ]}
                                />
                            </View>

                            {/* Top PDF Reader Navigation Bar */}
                            <View style={styles.pdfToolbar}>
                                <View style={styles.pdfToolbarLeft}>
                                    <View style={styles.pdfBadge}>
                                        <Text style={styles.pdfBadgeText}>
                                            PDF
                                        </Text>
                                    </View>
                                    <View style={styles.pdfFileInfo}>
                                        <Text
                                            numberOfLines={1}
                                            style={[
                                                styles.pdfFileName,
                                                isDarkHud &&
                                                    styles.pdfFileNameDark,
                                            ]}
                                        >
                                            {viewingDoc.documentNumber}.pdf
                                        </Text>
                                        <Text
                                            style={[
                                                styles.pdfFileMeta,
                                                isDarkHud &&
                                                    styles.pdfFileMetaDark,
                                            ]}
                                        >
                                            {viewingDoc.fileSizeLabel ||
                                                '1.4 MB · PDF'}{' '}
                                            • Page 1 of 1
                                        </Text>
                                    </View>
                                </View>

                                <Pressable
                                    accessibilityLabel="Close PDF reader"
                                    accessibilityRole="button"
                                    hitSlop={{
                                        top: 10,
                                        bottom: 10,
                                        left: 10,
                                        right: 10,
                                    }}
                                    onPress={() => setViewingDoc(null)}
                                    style={[
                                        styles.sheetCloseBtn,
                                        isDarkHud && styles.sheetCloseBtnDark,
                                    ]}
                                >
                                    <Icon
                                        color={
                                            isDarkHud
                                                ? colors.hudTextDim
                                                : colors.muted
                                        }
                                        name="close"
                                        size={18}
                                    />
                                </Pressable>
                            </View>

                            {/* Segmented Mode Switcher: Official PDF vs Field Summary */}
                            <View
                                style={[
                                    styles.viewModeSwitcher,
                                    isDarkHud && styles.viewModeSwitcherDark,
                                ]}
                            >
                                <Pressable
                                    accessibilityLabel="Official PDF Document View"
                                    accessibilityRole="button"
                                    onPress={() => setModalViewMode('pdf')}
                                    style={[
                                        styles.viewModeTab,
                                        modalViewMode === 'pdf' &&
                                            styles.viewModeTabActive,
                                        modalViewMode === 'pdf' &&
                                            isDarkHud &&
                                            styles.viewModeTabActiveDark,
                                    ]}
                                >
                                    <Icon
                                        color={
                                            modalViewMode === 'pdf'
                                                ? '#FFFFFF'
                                                : isDarkHud
                                                  ? colors.hudTextDim
                                                  : colors.muted
                                        }
                                        name="document"
                                        size={14}
                                    />
                                    <Text
                                        style={[
                                            styles.viewModeTabText,
                                            isDarkHud &&
                                                styles.viewModeTabTextDark,
                                            modalViewMode === 'pdf' &&
                                                styles.viewModeTabTextActive,
                                            modalViewMode === 'pdf' &&
                                                isDarkHud &&
                                                styles.viewModeTabTextActiveDark,
                                        ]}
                                    >
                                        Official PDF Document
                                    </Text>
                                </Pressable>

                                <Pressable
                                    accessibilityLabel="Field Summary View"
                                    accessibilityRole="button"
                                    onPress={() => setModalViewMode('summary')}
                                    style={[
                                        styles.viewModeTab,
                                        modalViewMode === 'summary' &&
                                            styles.viewModeTabActive,
                                        modalViewMode === 'summary' &&
                                            isDarkHud &&
                                            styles.viewModeTabActiveDark,
                                    ]}
                                >
                                    <Icon
                                        color={
                                            modalViewMode === 'summary'
                                                ? '#FFFFFF'
                                                : isDarkHud
                                                  ? colors.hudTextDim
                                                  : colors.muted
                                        }
                                        name="list"
                                        size={14}
                                    />
                                    <Text
                                        style={[
                                            styles.viewModeTabText,
                                            isDarkHud &&
                                                styles.viewModeTabTextDark,
                                            modalViewMode === 'summary' &&
                                                styles.viewModeTabTextActive,
                                            modalViewMode === 'summary' &&
                                                isDarkHud &&
                                                styles.viewModeTabTextActiveDark,
                                        ]}
                                    >
                                        Field Summary
                                    </Text>
                                </Pressable>
                            </View>

                            <ScrollView
                                bounces={false}
                                contentContainerStyle={
                                    styles.sheetScrollContent
                                }
                                showsVerticalScrollIndicator={false}
                            >
                                {modalViewMode === 'pdf' ? (
                                    /* Authentic A4 Government PDF Document Page */
                                    <View
                                        style={[
                                            styles.pdfReaderCanvas,
                                            isDarkHud &&
                                                styles.pdfReaderCanvasDark,
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.pdfPaperSheet,
                                                isDarkHud &&
                                                    styles.pdfPaperSheetDark,
                                            ]}
                                        >
                                            <View
                                                style={[
                                                    styles.pdfInnerBorder,
                                                    isDarkHud &&
                                                        styles.pdfInnerBorderDark,
                                                ]}
                                            >
                                                {/* Official Republic Header */}
                                                <View
                                                    style={
                                                        styles.pdfHeaderBlock
                                                    }
                                                >
                                                    <View
                                                        style={
                                                            styles.pdfEmblemCircle
                                                        }
                                                    >
                                                        <Icon
                                                            color="#B45309"
                                                            name="shield-check"
                                                            size={20}
                                                        />
                                                    </View>
                                                    <Text
                                                        style={
                                                            styles.pdfRepublicText
                                                        }
                                                    >
                                                        REPUBLIC OF THE
                                                        PHILIPPINES
                                                    </Text>
                                                    <Text
                                                        style={
                                                            styles.pdfAgencyText
                                                        }
                                                    >
                                                        {viewingDoc.issuingAuthority.toUpperCase()}
                                                    </Text>
                                                    <Text
                                                        style={
                                                            styles.pdfBureauText
                                                        }
                                                    >
                                                        NATIONAL CAPITAL REGION
                                                        • HEAVY VEHICLE
                                                        REGULATORY DIVISION
                                                    </Text>
                                                </View>

                                                {/* Ornamental Double Rule */}
                                                <View
                                                    style={styles.pdfDoubleRule}
                                                >
                                                    <View
                                                        style={
                                                            styles.pdfRuleLineThick
                                                        }
                                                    />
                                                    <View
                                                        style={
                                                            styles.pdfRuleLineThin
                                                        }
                                                    />
                                                </View>

                                                {/* Document Title & Tracking Barcode */}
                                                <View
                                                    style={
                                                        styles.pdfDocTitleBlock
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.pdfOfficialTitle
                                                        }
                                                    >
                                                        {viewingDoc.title.toUpperCase()}
                                                    </Text>
                                                    <View
                                                        style={
                                                            styles.pdfBarcodeRow
                                                        }
                                                    >
                                                        <Text
                                                            style={
                                                                styles.pdfBarcodeVisual
                                                            }
                                                        >
                                                            ||||| ||| |||| ||
                                                            |||||| ||| ||||
                                                            |||||
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.pdfBarcodeNumber
                                                            }
                                                        >
                                                            {
                                                                viewingDoc.documentNumber
                                                            }
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* Statutory Preamble */}
                                                <Text
                                                    style={
                                                        styles.pdfPreambleText
                                                    }
                                                >
                                                    This certifies that the
                                                    heavy equipment unit
                                                    designated below has
                                                    fulfilled all technical
                                                    standards pursuant to
                                                    Philippine Highway &
                                                    Equipment Safety Regulations
                                                    and is authorized for active
                                                    field operation.
                                                </Text>

                                                {/* Formal Government Spec Grid */}
                                                <View style={styles.pdfTable}>
                                                    <View
                                                        style={
                                                            styles.pdfTableRow
                                                        }
                                                    >
                                                        <View
                                                            style={
                                                                styles.pdfTableCellHeader
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.pdfTableHeadText
                                                                }
                                                            >
                                                                ASSIGNED ASSET /
                                                                OPERATOR
                                                            </Text>
                                                        </View>
                                                        <View
                                                            style={
                                                                styles.pdfTableCellBody
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.pdfTableBodyText
                                                                }
                                                            >
                                                                {viewingDoc.assetCode ||
                                                                    viewingDoc.operatorName}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <View
                                                        style={
                                                            styles.pdfTableRow
                                                        }
                                                    >
                                                        <View
                                                            style={
                                                                styles.pdfTableCellHeader
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.pdfTableHeadText
                                                                }
                                                            >
                                                                ISSUING
                                                                AUTHORITY
                                                            </Text>
                                                        </View>
                                                        <View
                                                            style={
                                                                styles.pdfTableCellBody
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.pdfTableBodyText
                                                                }
                                                            >
                                                                {
                                                                    viewingDoc.issuingAuthority
                                                                }
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <View
                                                        style={
                                                            styles.pdfTableRow
                                                        }
                                                    >
                                                        <View
                                                            style={
                                                                styles.pdfTableCellHeader
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.pdfTableHeadText
                                                                }
                                                            >
                                                                DATE OF ISSUANCE
                                                            </Text>
                                                        </View>
                                                        <View
                                                            style={
                                                                styles.pdfTableCellBody
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.pdfTableBodyText
                                                                }
                                                            >
                                                                {
                                                                    viewingDoc.issuedDate
                                                                }
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <View
                                                        style={[
                                                            styles.pdfTableRow,
                                                            styles.pdfTableRowLast,
                                                        ]}
                                                    >
                                                        <View
                                                            style={
                                                                styles.pdfTableCellHeader
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.pdfTableHeadText
                                                                }
                                                            >
                                                                VALIDITY
                                                                EXPIRATION
                                                            </Text>
                                                        </View>
                                                        <View
                                                            style={
                                                                styles.pdfTableCellBody
                                                            }
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.pdfTableBodyText,
                                                                    styles.pdfValidHighlight,
                                                                ]}
                                                            >
                                                                {viewingDoc.expiryDate ||
                                                                    'Permanent'}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                {/* Transit Conditions Box */}
                                                {viewingDoc.notes ? (
                                                    <View
                                                        style={
                                                            styles.pdfConditionsBox
                                                        }
                                                    >
                                                        <Text
                                                            style={
                                                                styles.pdfConditionsHeader
                                                            }
                                                        >
                                                            SPECIAL CONDITIONS &
                                                            TRAVEL RESTRICTIONS:
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.pdfConditionsBody
                                                            }
                                                        >
                                                            {viewingDoc.notes}
                                                        </Text>
                                                    </View>
                                                ) : null}

                                                {/* Signature & Government Dry Seal Block */}
                                                <View
                                                    style={
                                                        styles.pdfSignaturesBlock
                                                    }
                                                >
                                                    <View
                                                        style={
                                                            styles.pdfSignatory
                                                        }
                                                    >
                                                        <View
                                                            style={
                                                                styles.pdfSigLine
                                                            }
                                                        />
                                                        <Text
                                                            style={
                                                                styles.pdfSigName
                                                            }
                                                        >
                                                            ENGR. RAMON VELASCO,
                                                            PE
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.pdfSigTitle
                                                            }
                                                        >
                                                            Chief Highway Safety
                                                            Inspector
                                                        </Text>
                                                    </View>

                                                    {/* Circular Government Stamp */}
                                                    <View
                                                        style={
                                                            styles.pdfStampSeal
                                                        }
                                                    >
                                                        <View
                                                            style={
                                                                styles.pdfStampInner
                                                            }
                                                        >
                                                            <Text
                                                                style={
                                                                    styles.pdfStampTextTop
                                                                }
                                                            >
                                                                OFFICIAL SEAL
                                                            </Text>
                                                            <Icon
                                                                color="#991B1B"
                                                                name="shield-check"
                                                                size={14}
                                                            />
                                                            <Text
                                                                style={
                                                                    styles.pdfStampTextBottom
                                                                }
                                                            >
                                                                APPROVED
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                {/* Cryptographic Compliance Verification Strip */}
                                                <View
                                                    style={
                                                        styles.pdfVerifyStrip
                                                    }
                                                >
                                                    <Icon
                                                        color="#047857"
                                                        name="shield-check"
                                                        size={16}
                                                    />
                                                    <View
                                                        style={
                                                            styles.pdfVerifyTextWrap
                                                        }
                                                    >
                                                        <Text
                                                            style={
                                                                styles.pdfVerifyTitle
                                                            }
                                                        >
                                                            ✓ Verified
                                                            Compliance Record
                                                        </Text>
                                                        <Text
                                                            style={
                                                                styles.pdfVerifySub
                                                            }
                                                        >
                                                            Synchronized with
                                                            DPWH & DOLE-OSHC
                                                            registry
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* PDF Document Page Footnote */}
                                                <View
                                                    style={styles.pdfPageFooter}
                                                >
                                                    <Text
                                                        style={
                                                            styles.pdfFooterText
                                                        }
                                                    >
                                                        PAGE 1 OF 1 • OFFICIAL
                                                        ELECTRONIC CERTIFICATE •
                                                        AUTHENTICATED VIA CORE-2
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                ) : (
                                    /* Field Summary View */
                                    <View style={styles.summaryContainer}>
                                        <View style={styles.masthead}>
                                            <View style={styles.mastheadLeft}>
                                                <View
                                                    style={
                                                        styles.countryBadgeRow
                                                    }
                                                >
                                                    <Icon
                                                        color={
                                                            isDarkHud
                                                                ? colors.hudAmber
                                                                : colors.amber
                                                        }
                                                        name="shield-check"
                                                        size={14}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.countryTitle,
                                                            isDarkHud &&
                                                                styles.countryTitleDark,
                                                        ]}
                                                    >
                                                        REPUBLIC OF THE
                                                        PHILIPPINES
                                                    </Text>
                                                </View>
                                                <Text
                                                    style={[
                                                        styles.agencySub,
                                                        isDarkHud &&
                                                            styles.agencySubDark,
                                                    ]}
                                                >
                                                    Official Compliance Record
                                                </Text>
                                            </View>
                                        </View>

                                        <View
                                            style={[
                                                styles.sheetDivider,
                                                isDarkHud &&
                                                    styles.sheetDividerDark,
                                            ]}
                                        />

                                        {/* Document Title & Registration Hero */}
                                        <View style={styles.certHero}>
                                            <Text
                                                style={[
                                                    styles.certTitleText,
                                                    isDarkHud &&
                                                        styles.certTitleTextDark,
                                                ]}
                                            >
                                                {viewingDoc.title}
                                            </Text>
                                            <View
                                                style={[
                                                    styles.certNumberBox,
                                                    isDarkHud &&
                                                        styles.certNumberBoxDark,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.certNumberLabel,
                                                        isDarkHud &&
                                                            styles.certNumberLabelDark,
                                                    ]}
                                                >
                                                    PERMIT / CERTIFICATE NUMBER
                                                </Text>
                                                <Text
                                                    selectable
                                                    style={[
                                                        styles.certNumberValue,
                                                        isDarkHud &&
                                                            styles.certNumberValueDark,
                                                    ]}
                                                >
                                                    {viewingDoc.documentNumber}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* High-Contrast Field Spec List */}
                                        <View
                                            style={[
                                                styles.specList,
                                                isDarkHud &&
                                                    styles.specListDark,
                                            ]}
                                        >
                                            <View style={styles.specRow}>
                                                <Text
                                                    style={[
                                                        styles.specLabel,
                                                        isDarkHud &&
                                                            styles.specLabelDark,
                                                    ]}
                                                >
                                                    ASSIGNED ASSET / OPERATOR
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.specValue,
                                                        isDarkHud &&
                                                            styles.specValueDark,
                                                    ]}
                                                >
                                                    {viewingDoc.assetCode ||
                                                        viewingDoc.operatorName}
                                                </Text>
                                            </View>

                                            <View
                                                style={[
                                                    styles.specDivider,
                                                    isDarkHud &&
                                                        styles.specDividerDark,
                                                ]}
                                            />

                                            <View style={styles.specRow}>
                                                <Text
                                                    style={[
                                                        styles.specLabel,
                                                        isDarkHud &&
                                                            styles.specLabelDark,
                                                    ]}
                                                >
                                                    ISSUING AUTHORITY
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.specValue,
                                                        isDarkHud &&
                                                            styles.specValueDark,
                                                    ]}
                                                >
                                                    {
                                                        viewingDoc.issuingAuthority
                                                    }
                                                </Text>
                                            </View>

                                            <View
                                                style={[
                                                    styles.specDivider,
                                                    isDarkHud &&
                                                        styles.specDividerDark,
                                                ]}
                                            />

                                            <View style={styles.specRow}>
                                                <Text
                                                    style={[
                                                        styles.specLabel,
                                                        isDarkHud &&
                                                            styles.specLabelDark,
                                                    ]}
                                                >
                                                    VALIDITY WINDOW
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.specValue,
                                                        isDarkHud &&
                                                            styles.specValueDark,
                                                    ]}
                                                >
                                                    {viewingDoc.issuedDate} ➔{' '}
                                                    {viewingDoc.expiryDate ||
                                                        'Permanent'}
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Operational Restrictions Callout */}
                                        {viewingDoc.notes ? (
                                            <View
                                                style={[
                                                    styles.notesBox,
                                                    isDarkHud &&
                                                        styles.notesBoxDark,
                                                ]}
                                            >
                                                <Text
                                                    style={[
                                                        styles.notesBoxTitle,
                                                        isDarkHud &&
                                                            styles.notesBoxTitleDark,
                                                    ]}
                                                >
                                                    CONDITIONS & ROAD TRANSIT
                                                    WINDOW
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.notesBoxBody,
                                                        isDarkHud &&
                                                            styles.notesBoxBodyDark,
                                                    ]}
                                                >
                                                    {viewingDoc.notes}
                                                </Text>
                                            </View>
                                        ) : null}

                                        {/* Cryptographic Compliance Verification Card */}
                                        <View
                                            style={[
                                                styles.verificationPillCard,
                                                isDarkHud &&
                                                    styles.verificationPillCardDark,
                                            ]}
                                        >
                                            <Icon
                                                color={
                                                    isDarkHud
                                                        ? '#34D399'
                                                        : colors.greenDark
                                                }
                                                name="shield-check"
                                                size={20}
                                            />
                                            <View
                                                style={
                                                    styles.verificationTextWrap
                                                }
                                            >
                                                <Text
                                                    style={[
                                                        styles.verificationHeadline,
                                                        isDarkHud &&
                                                            styles.verificationHeadlineDark,
                                                    ]}
                                                >
                                                    ✓ Verified Compliance Record
                                                </Text>
                                                <Text
                                                    style={[
                                                        styles.verificationSub,
                                                        isDarkHud &&
                                                            styles.verificationSubDark,
                                                    ]}
                                                >
                                                    Synchronized with DPWH &
                                                    DOLE-OSHC registry
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                )}

                                {/* Action Dismiss Button */}
                                <Pressable
                                    accessibilityLabel="Close certificate view"
                                    accessibilityRole="button"
                                    onPress={() => setViewingDoc(null)}
                                    style={({ pressed }) => [
                                        styles.doneBtn,
                                        isDarkHud && styles.doneBtnDark,
                                        pressed && styles.pressed,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.doneBtnText,
                                            isDarkHud && styles.doneBtnTextDark,
                                        ]}
                                    >
                                        Done
                                    </Text>
                                </Pressable>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        backgroundColor: colors.background,
        flex: 1,
    },
    rootDark: {
        backgroundColor: colors.hudBackground,
    },
    header: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerDark: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    headerLeft: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 10,
    },
    backBtn: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        minHeight: 44,
        paddingRight: 6,
    },
    backText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    backTextDark: {
        color: colors.hudText,
    },
    headerTitleWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: -0.2,
    },
    titleDark: {
        color: colors.hudText,
    },
    subtitle: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 1,
    },
    subtitleDark: {
        color: colors.hudTextDim,
    },
    searchSection: {
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    searchInputWrap: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        minHeight: 44,
        paddingHorizontal: 12,
    },
    searchInputWrapDark: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
    },
    searchInput: {
        color: colors.text,
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    searchInputDark: {
        color: colors.hudText,
    },
    clearBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 32,
        minWidth: 32,
    },
    categoryRailSection: {
        paddingVertical: 10,
    },
    categoryRail: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
    },
    categoryChip: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 20,
        flexDirection: 'row',
        gap: 6,
        minHeight: 36,
        paddingHorizontal: 14,
    },
    categoryChipDark: {
        backgroundColor: colors.hudSurface,
    },
    categoryChipAll: {
        backgroundColor: colors.amberLight,
    },
    categoryChipAllDark: {
        backgroundColor: 'rgba(120, 53, 15, 0.25)',
    },
    categoryChipActive: {
        backgroundColor: colors.amber,
    },
    categoryChipActiveDark: {
        backgroundColor: colors.hudAmber,
    },
    categoryChipText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '700',
    },
    categoryChipTextDark: {
        color: colors.hudTextDim,
    },
    categoryChipTextAll: {
        color: colors.amberDark,
        fontWeight: '800',
    },
    categoryChipTextAllDark: {
        color: colors.hudAmber,
        fontWeight: '800',
    },
    categoryChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    categoryChipTextActiveDark: {
        color: colors.surfaceDark,
        fontWeight: '800',
    },
    countTag: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    countTagDark: {
        backgroundColor: colors.surfaceDark,
    },
    countTagAll: {
        backgroundColor: 'rgba(217, 119, 6, 0.18)',
    },
    countTagAllDark: {
        backgroundColor: 'rgba(245, 158, 11, 0.22)',
    },
    countTagActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.28)',
    },
    countTagActiveDark: {
        backgroundColor: 'rgba(15, 23, 42, 0.25)',
    },
    countTagText: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '800',
    },
    countTagTextDark: {
        color: colors.hudTextDim,
    },
    countTagTextAll: {
        color: colors.amberDark,
        fontWeight: '800',
    },
    countTagTextAllDark: {
        color: colors.hudAmber,
        fontWeight: '800',
    },
    countTagTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    countTagTextActiveDark: {
        color: colors.surfaceDark,
        fontWeight: '800',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        alignSelf: 'center',
        gap: 12,
        maxWidth: 720,
        padding: 16,
        paddingBottom: 48,
        width: '100%',
    },
    emptyCard: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        gap: 8,
        padding: 32,
    },
    emptyCardDark: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
    },
    emptyTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '700',
    },
    emptyTitleDark: {
        color: colors.hudText,
    },
    emptySubtitle: {
        color: colors.muted,
        fontSize: 13,
        textAlign: 'center',
    },
    emptySubtitleDark: {
        color: colors.hudTextDim,
    },
    docCardContainer: {
        backgroundColor: colors.surface,
        borderRadius: 14,
        overflow: 'hidden',
        ...shadows.sm,
    },
    docCardContainerDark: {
        backgroundColor: colors.hudSurface,
    },
    docCardPressable: {
        padding: 14,
    },
    cardPressed: {
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        opacity: 0.9,
    },
    cardTopRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    docNumberMono: {
        color: colors.secondary,
        fontFamily: 'monospace',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    docNumberMonoDark: {
        color: colors.hudTextDim,
    },
    statusPill: {
        alignItems: 'center',
        borderRadius: 6,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    statusPillText: {
        fontSize: 10,
        fontWeight: '800',
    },
    docCardTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        lineHeight: 20,
        marginBottom: 8,
    },
    docCardTitleDark: {
        color: colors.hudText,
    },
    metaRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    authorityText: {
        color: colors.muted,
        flex: 1,
        fontSize: 12,
        fontWeight: '500',
        marginRight: 8,
    },
    authorityTextDark: {
        color: colors.hudTextDim,
    },
    validityDate: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '700',
    },
    validityDateDark: {
        color: colors.hudText,
    },
    conditionStrip: {
        backgroundColor: '#FFFBEB',
        borderRadius: 6,
        marginTop: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    conditionStripDark: {
        backgroundColor: 'rgba(120, 53, 15, 0.25)',
    },
    conditionText: {
        color: '#92400E',
        fontSize: 11,
        lineHeight: 15,
    },
    conditionTextDark: {
        color: '#FDE68A',
    },
    cardFooter: {
        alignItems: 'center',
        borderTopColor: colors.borderSubtle,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 10,
    },
    cardFooterDark: {
        borderTopColor: colors.hudBorder,
    },
    fileTag: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 5,
    },
    fileTagText: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '700',
    },
    fileTagTextDark: {
        color: colors.hudTextDim,
    },
    tapPrompt: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 2,
    },
    tapPromptText: {
        color: colors.amberDark,
        fontSize: 12,
        fontWeight: '700',
    },
    tapPromptTextDark: {
        color: colors.hudAmber,
    },
    modalBackdrop: {
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdropTouchArea: {
        bottom: 0,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
    },
    sheetHandleBar: {
        alignItems: 'center',
        paddingVertical: 10,
        width: '100%',
    },
    sheetHandle: {
        backgroundColor: '#CBD5E1',
        borderRadius: 2.5,
        height: 5,
        width: 40,
    },
    sheetHandleDark: {
        backgroundColor: colors.hudBorder,
    },
    inspectionSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        maxWidth: 640,
        overflow: 'hidden',
        width: '100%',
        ...shadows.lg,
    },
    inspectionSheetDark: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
        borderTopWidth: 1,
    },
    sheetScrollContent: {
        paddingBottom: 36,
        paddingHorizontal: 20,
        paddingTop: 4,
    },
    pdfToolbar: {
        alignItems: 'center',
        borderBottomColor: colors.borderSubtle,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 12,
        paddingHorizontal: 20,
    },
    pdfToolbarLeft: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        gap: 10,
    },
    pdfBadge: {
        backgroundColor: '#DC2626',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    pdfBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    pdfFileInfo: {
        flex: 1,
        gap: 1,
    },
    pdfFileName: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
    },
    pdfFileNameDark: {
        color: colors.hudText,
    },
    pdfFileMeta: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '600',
    },
    pdfFileMetaDark: {
        color: colors.hudTextDim,
    },
    viewModeSwitcher: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        flexDirection: 'row',
        marginHorizontal: 20,
        marginTop: 10,
        marginBottom: 8,
        padding: 3,
    },
    viewModeSwitcherDark: {
        backgroundColor: colors.hudSurface,
    },
    viewModeTab: {
        alignItems: 'center',
        borderRadius: 7,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        paddingVertical: 8,
    },
    viewModeTabActive: {
        backgroundColor: colors.amber,
    },
    viewModeTabActiveDark: {
        backgroundColor: colors.hudAmber,
    },
    viewModeTabText: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '700',
    },
    viewModeTabTextDark: {
        color: colors.hudTextDim,
    },
    viewModeTabTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    viewModeTabTextActiveDark: {
        color: colors.surfaceDark,
    },
    pdfReaderCanvas: {
        backgroundColor: '#E2E8F0',
        borderRadius: 12,
        marginBottom: 16,
        padding: 8,
    },
    pdfReaderCanvasDark: {
        backgroundColor: '#0F172A',
    },
    pdfPaperSheet: {
        backgroundColor: '#FFFFFF',
        borderRadius: 4,
        padding: 10,
        ...shadows.md,
    },
    pdfPaperSheetDark: {
        backgroundColor: '#FFFFFF',
    },
    pdfInnerBorder: {
        borderColor: '#CBD5E1',
        borderWidth: 1,
        padding: 12,
    },
    pdfInnerBorderDark: {
        borderColor: '#CBD5E1',
    },
    pdfHeaderBlock: {
        alignItems: 'center',
        gap: 2,
        marginBottom: 8,
    },
    pdfEmblemCircle: {
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderRadius: 16,
        height: 32,
        justifyContent: 'center',
        marginBottom: 4,
        width: 32,
    },
    pdfRepublicText: {
        color: '#1E293B',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.8,
        textAlign: 'center',
    },
    pdfAgencyText: {
        color: '#0F172A',
        fontSize: 11,
        fontWeight: '800',
        textAlign: 'center',
    },
    pdfBureauText: {
        color: '#64748B',
        fontSize: 8,
        fontWeight: '700',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    pdfDoubleRule: {
        gap: 2,
        marginVertical: 8,
    },
    pdfRuleLineThick: {
        backgroundColor: '#0F172A',
        height: 2,
    },
    pdfRuleLineThin: {
        backgroundColor: '#64748B',
        height: 0.5,
    },
    pdfDocTitleBlock: {
        alignItems: 'center',
        gap: 4,
        marginBottom: 10,
    },
    pdfOfficialTitle: {
        color: '#0F172A',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    pdfBarcodeRow: {
        alignItems: 'center',
        gap: 2,
    },
    pdfBarcodeVisual: {
        color: '#334155',
        fontFamily: 'monospace',
        fontSize: 12,
        letterSpacing: 2,
    },
    pdfBarcodeNumber: {
        color: '#64748B',
        fontFamily: 'monospace',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1,
    },
    pdfPreambleText: {
        color: '#334155',
        fontSize: 9.5,
        lineHeight: 14,
        marginBottom: 10,
        textAlign: 'justify',
    },
    pdfTable: {
        borderColor: '#94A3B8',
        borderWidth: 1,
        marginBottom: 10,
    },
    pdfTableRow: {
        borderBottomColor: '#CBD5E1',
        borderBottomWidth: 1,
        flexDirection: 'row',
    },
    pdfTableRowLast: {
        borderBottomWidth: 0,
    },
    pdfTableCellHeader: {
        backgroundColor: '#F8FAFC',
        borderRightColor: '#CBD5E1',
        borderRightWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 6,
        width: '42%',
    },
    pdfTableCellBody: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    pdfTableHeadText: {
        color: '#475569',
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    pdfTableBodyText: {
        color: '#0F172A',
        fontSize: 10,
        fontWeight: '700',
    },
    pdfValidHighlight: {
        color: '#047857',
        fontWeight: '800',
    },
    pdfConditionsBox: {
        backgroundColor: '#FEF9C3',
        borderColor: '#FACC15',
        borderRadius: 4,
        borderWidth: 0.5,
        marginBottom: 10,
        padding: 8,
    },
    pdfConditionsHeader: {
        color: '#854D0E',
        fontSize: 8.5,
        fontWeight: '800',
        letterSpacing: 0.4,
        marginBottom: 2,
    },
    pdfConditionsBody: {
        color: '#713F12',
        fontSize: 9.5,
        lineHeight: 13,
    },
    pdfSignaturesBlock: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingHorizontal: 8,
        paddingTop: 6,
    },
    pdfSignatory: {
        alignItems: 'center',
        width: 140,
    },
    pdfSigLine: {
        backgroundColor: '#0F172A',
        height: 1,
        marginBottom: 3,
        width: '100%',
    },
    pdfSigName: {
        color: '#0F172A',
        fontSize: 8.5,
        fontWeight: '800',
    },
    pdfSigTitle: {
        color: '#64748B',
        fontSize: 7.5,
        fontWeight: '600',
    },
    pdfStampSeal: {
        alignItems: 'center',
        borderColor: '#DC2626',
        borderRadius: 24,
        borderStyle: 'dashed',
        borderWidth: 1.5,
        height: 48,
        justifyContent: 'center',
        width: 48,
    },
    pdfStampInner: {
        alignItems: 'center',
        gap: 1,
    },
    pdfStampTextTop: {
        color: '#DC2626',
        fontSize: 6.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    pdfStampTextBottom: {
        color: '#DC2626',
        fontSize: 6.5,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    pdfVerifyStrip: {
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        borderColor: '#A7F3D0',
        borderRadius: 4,
        borderWidth: 0.5,
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
        padding: 8,
    },
    pdfVerifyTextWrap: {
        flex: 1,
    },
    pdfVerifyTitle: {
        color: '#047857',
        fontSize: 10,
        fontWeight: '800',
    },
    pdfVerifySub: {
        color: '#065F46',
        fontSize: 8,
        marginTop: 1,
    },
    pdfPageFooter: {
        alignItems: 'center',
        borderTopColor: '#E2E8F0',
        borderTopWidth: 0.5,
        paddingTop: 6,
    },
    pdfFooterText: {
        color: '#94A3B8',
        fontSize: 7,
        fontWeight: '700',
        letterSpacing: 0.4,
        textAlign: 'center',
    },
    summaryContainer: {
        paddingTop: 4,
    },
    masthead: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    mastheadLeft: {
        gap: 3,
    },
    countryBadgeRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    countryTitle: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    countryTitleDark: {
        color: colors.hudText,
    },
    agencySub: {
        color: colors.muted,
        fontSize: 12,
        fontWeight: '600',
    },
    agencySubDark: {
        color: colors.hudTextDim,
    },
    sheetCloseBtn: {
        alignItems: 'center',
        backgroundColor: colors.surfaceMuted,
        borderRadius: 18,
        height: 36,
        justifyContent: 'center',
        width: 36,
    },
    sheetCloseBtnDark: {
        backgroundColor: colors.hudSurface,
    },
    sheetDivider: {
        backgroundColor: colors.borderSubtle,
        height: StyleSheet.hairlineWidth,
        marginVertical: 14,
    },
    sheetDividerDark: {
        backgroundColor: colors.hudBorder,
    },
    certHero: {
        gap: 10,
        marginBottom: 16,
    },
    certTitleText: {
        color: colors.text,
        fontSize: 17,
        fontWeight: '800',
        lineHeight: 23,
    },
    certTitleTextDark: {
        color: colors.hudText,
    },
    certNumberBox: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    certNumberBoxDark: {
        backgroundColor: colors.hudSurface,
    },
    certNumberLabel: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    certNumberLabelDark: {
        color: colors.hudTextDim,
    },
    certNumberValue: {
        color: colors.text,
        fontFamily: 'monospace',
        fontSize: 15,
        fontWeight: '900',
        marginTop: 3,
    },
    certNumberValueDark: {
        color: colors.hudText,
    },
    specList: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 12,
        marginBottom: 14,
        overflow: 'hidden',
        paddingHorizontal: 14,
        paddingVertical: 4,
    },
    specListDark: {
        backgroundColor: colors.hudSurface,
    },
    specRow: {
        gap: 3,
        paddingVertical: 10,
    },
    specDivider: {
        backgroundColor: colors.borderSubtle,
        height: StyleSheet.hairlineWidth,
    },
    specDividerDark: {
        backgroundColor: colors.hudBorder,
    },
    specLabel: {
        color: colors.muted,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    specLabelDark: {
        color: colors.hudTextDim,
    },
    specValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    specValueDark: {
        color: colors.hudText,
    },
    notesBox: {
        backgroundColor: '#FFFBEB',
        borderRadius: 10,
        marginBottom: 14,
        padding: 14,
    },
    notesBoxDark: {
        backgroundColor: 'rgba(120, 53, 15, 0.22)',
    },
    notesBoxTitle: {
        color: '#92400E',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    notesBoxTitleDark: {
        color: colors.hudAmber,
    },
    notesBoxBody: {
        color: '#78350F',
        fontSize: 12,
        lineHeight: 17,
    },
    notesBoxBodyDark: {
        color: '#FDE68A',
    },
    verificationPillCard: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderRadius: 12,
        flexDirection: 'row',
        gap: 12,
        marginBottom: 18,
        padding: 14,
    },
    verificationPillCardDark: {
        backgroundColor: 'rgba(5, 150, 105, 0.18)',
    },
    verificationTextWrap: {
        flex: 1,
    },
    verificationHeadline: {
        color: colors.greenDark,
        fontSize: 13,
        fontWeight: '800',
    },
    verificationHeadlineDark: {
        color: '#34D399',
    },
    verificationSub: {
        color: '#065F46',
        fontSize: 11,
        marginTop: 2,
    },
    verificationSubDark: {
        color: colors.hudTextDim,
    },
    doneBtn: {
        alignItems: 'center',
        backgroundColor: colors.amber,
        borderRadius: 12,
        justifyContent: 'center',
        minHeight: 48,
    },
    doneBtnDark: {
        backgroundColor: colors.hudAmber,
    },
    doneBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    doneBtnTextDark: {
        color: colors.surfaceDark,
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.985 }],
    },
});
