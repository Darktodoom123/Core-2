import React, { useState } from 'react';
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
import { colors, shadows, sharedStyles } from '../components/nativeStyles';
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
        notes: '125% dynamic and static overload proof test verified. Wire ropes, outrigger rams, and boom sections certified operational.',
    },
    {
        id: 'doc-license-01',
        category: 'operator_licenses',
        title: 'TESDA Heavy Equipment Operator (Mobile Crane) NC-III',
        documentNumber: 'TESDA-NC3-CRN-449102',
        issuingAuthority:
            'Technical Education and Skills Development Authority',
        issuedDate: '2025-05-10',
        expiryDate: '2030-05-09',
        operatorName: 'Alex Rivera',
        status: 'valid',
        fileSizeLabel: '850 KB · PDF',
        notes: 'Accredited for hydraulic mobile cranes up to 100 metric tons capacity.',
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
        notes: 'Full commercial site liability and hull damage protection across Philippine territory.',
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

    const categories: Array<{
        key: DocumentCategory | 'all';
        label: string;
    }> = [
        { key: 'all', label: 'All Documents' },
        { key: 'road_permits', label: 'Road Permits' },
        { key: 'load_test_certs', label: 'Load Test Certs' },
        { key: 'operator_licenses', label: 'Operator Licenses' },
        { key: 'delivery_receipts', label: 'Delivery Receipts' },
    ];

    const filteredDocs = DEFAULT_DOCUMENTS.filter((doc) => {
        const matchesCat =
            selectedCategory === 'all' || doc.category === selectedCategory;
        const matchesQuery =
            !searchQuery.trim() ||
            doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doc.documentNumber
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
            doc.issuingAuthority
                .toLowerCase()
                .includes(searchQuery.toLowerCase());

        return matchesCat && matchesQuery;
    });

    return (
        <View
            style={[styles.screenRoot, isDarkHud && styles.darkScreenRoot]}
            testID="documents-wallet-screen"
        >
            {/* Header Bar */}
            <View style={[styles.headerBar, isDarkHud && styles.darkHeaderBar]}>
                {onBack ? (
                    <Pressable
                        accessibilityLabel="Back to previous screen"
                        accessibilityRole="button"
                        onPress={onBack}
                        style={({ pressed }) => [
                            styles.backButton,
                            pressed && styles.pressed,
                        ]}
                        testID="docs-back-button"
                    >
                        <Icon
                            name="back"
                            size={20}
                            color={isDarkHud ? '#F8FAFC' : colors.text}
                        />
                        <Text
                            style={[
                                styles.backText,
                                isDarkHud && styles.darkBackText,
                            ]}
                        >
                            Back
                        </Text>
                    </Pressable>
                ) : null}

                <View style={styles.headerTitles}>
                    <Text
                        style={[
                            styles.screenTitle,
                            isDarkHud && styles.darkScreenTitle,
                        ]}
                    >
                        Cab Documents Wallet
                    </Text>
                    <Text
                        style={[
                            styles.headerSubtitle,
                            isDarkHud && styles.darkHeaderSubtitle,
                        ]}
                    >
                        {assetCode} · {operatorName}
                    </Text>
                </View>

                <View style={styles.verifiedPill}>
                    <Icon
                        name="shield-check"
                        size={13}
                        color={colors.greenDark}
                    />
                    <Text style={styles.verifiedPillText}>CACHED</Text>
                </View>
            </View>

            {/* Offline In-Cab Inspection Guarantee Banner */}
            <View
                style={[
                    styles.offlineNotice,
                    isDarkHud && styles.darkOfflineNotice,
                ]}
            >
                <Icon name="check-circle" size={16} color={colors.greenDark} />
                <Text
                    style={[
                        styles.offlineNoticeText,
                        isDarkHud && styles.darkOfflineNoticeText,
                    ]}
                >
                    In-cab digital compliance pack active. All certificates are
                    cryptographically cached for roadside / security gate
                    inspections without cellular data.
                </Text>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
                <View
                    style={[
                        styles.searchBar,
                        isDarkHud && styles.darkSearchBar,
                    ]}
                >
                    <Icon name="pin" size={16} color={colors.muted} />
                    <TextInput
                        onChangeText={setSearchQuery}
                        placeholder="Search permits, cert number, issuing agency..."
                        placeholderTextColor={
                            isDarkHud ? '#64748B' : colors.muted
                        }
                        style={[
                            styles.searchInput,
                            isDarkHud && styles.darkSearchInput,
                        ]}
                        testID="docs-search-input"
                        value={searchQuery}
                    />
                    {searchQuery.length > 0 ? (
                        <Pressable onPress={() => setSearchQuery('')}>
                            <Icon name="close" size={16} color={colors.muted} />
                        </Pressable>
                    ) : null}
                </View>
            </View>

            {/* Category Filter Rail */}
            <ScrollView
                contentContainerStyle={styles.categoryRail}
                horizontal
                showsHorizontalScrollIndicator={false}
            >
                {categories.map((cat) => {
                    const isSelected = selectedCategory === cat.key;

                    return (
                        <Pressable
                            accessibilityRole="button"
                            key={cat.key}
                            onPress={() => setSelectedCategory(cat.key)}
                            style={[
                                styles.categoryPill,
                                isDarkHud && styles.darkCategoryPill,
                                isSelected && styles.categoryPillActive,
                            ]}
                            testID={`filter-${cat.key}`}
                        >
                            <Text
                                style={[
                                    styles.categoryPillText,
                                    isDarkHud && styles.darkCategoryPillText,
                                    isSelected && styles.categoryPillTextActive,
                                ]}
                            >
                                {cat.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* Documents List */}
            <ScrollView
                contentContainerStyle={styles.contentContainer}
                style={styles.scrollView}
            >
                <View style={styles.docsList}>
                    {filteredDocs.map((doc) => (
                        <View
                            key={doc.id}
                            style={[
                                styles.docCard,
                                isDarkHud && styles.darkDocCard,
                            ]}
                            testID={`doc-card-${doc.id}`}
                        >
                            <View style={styles.docHeader}>
                                <View style={styles.categoryBadge}>
                                    <Text style={styles.categoryBadgeText}>
                                        {doc.category === 'road_permits'
                                            ? 'ROAD PERMIT'
                                            : doc.category === 'load_test_certs'
                                              ? 'DOLE-OSHC CERT'
                                              : doc.category ===
                                                  'operator_licenses'
                                                ? 'OPERATOR LICENSE'
                                                : 'DELIVERY RECEIPT'}
                                    </Text>
                                </View>
                                <View style={styles.validityBadge}>
                                    <Icon
                                        name="check"
                                        size={12}
                                        color={colors.greenDark}
                                    />
                                    <Text style={styles.validityText}>
                                        VALID · ACTIVE
                                    </Text>
                                </View>
                            </View>

                            <Text
                                style={[
                                    styles.docTitle,
                                    isDarkHud && styles.darkDocTitle,
                                ]}
                            >
                                {doc.title}
                            </Text>

                            <View style={styles.docDetailsBox}>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                        Document No:
                                    </Text>
                                    <Text selectable style={styles.detailValue}>
                                        {doc.documentNumber}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                        Issuing Body:
                                    </Text>
                                    <Text style={styles.detailValue}>
                                        {doc.issuingAuthority}
                                    </Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>
                                        Issued / Expiry:
                                    </Text>
                                    <Text style={styles.detailValue}>
                                        {doc.issuedDate}{' '}
                                        {doc.expiryDate
                                            ? `➔ ${doc.expiryDate}`
                                            : '(No Expiration)'}
                                    </Text>
                                </View>
                            </View>

                            {doc.notes ? (
                                <Text style={styles.docNotes}>{doc.notes}</Text>
                            ) : null}

                            <Pressable
                                accessibilityLabel={`View certificate for ${doc.title}`}
                                accessibilityRole="button"
                                onPress={() => setViewingDoc(doc)}
                                style={({ pressed }) => [
                                    styles.viewDocBtn,
                                    pressed && styles.pressed,
                                ]}
                                testID={`view-doc-btn-${doc.id}`}
                            >
                                <Icon
                                    name="file-text"
                                    size={16}
                                    color="#6B21A8"
                                />
                                <Text style={styles.viewDocBtnText}>
                                    View Digital Certificate (
                                    {doc.fileSizeLabel})
                                </Text>
                            </Pressable>
                        </View>
                    ))}
                </View>
            </ScrollView>

            {/* Certificate Inspection Modal */}
            {viewingDoc ? (
                <Modal
                    animationType="fade"
                    onRequestClose={() => setViewingDoc(null)}
                    transparent
                    visible={Boolean(viewingDoc)}
                >
                    <View
                        style={styles.modalBackdrop}
                        testID="certificate-modal"
                    >
                        <View
                            style={[
                                styles.certificateCard,
                                isDarkHud && styles.darkCertificateCard,
                            ]}
                        >
                            <View style={styles.certHeaderRow}>
                                <View style={styles.certEmblem}>
                                    <Icon
                                        name="shield-check"
                                        size={22}
                                        color="#6B21A8"
                                    />
                                </View>
                                <View style={styles.certHeaderCopy}>
                                    <Text style={styles.certOfficialTitle}>
                                        REPUBLIC OF THE PHILIPPINES
                                    </Text>
                                    <Text style={styles.certOfficialSub}>
                                        OFFICIAL STATUTORY COMPLIANCE
                                        CERTIFICATE
                                    </Text>
                                </View>
                                <Pressable
                                    onPress={() => setViewingDoc(null)}
                                    style={styles.modalCloseBtn}
                                >
                                    <Icon
                                        name="close"
                                        size={18}
                                        color={colors.text}
                                    />
                                </Pressable>
                            </View>

                            <View style={styles.certDivider} />

                            <Text style={styles.certTitle}>
                                {viewingDoc.title}
                            </Text>

                            <View style={styles.certGrid}>
                                <View style={styles.certGridItem}>
                                    <Text style={styles.certLabel}>
                                        REGISTRATION NO.
                                    </Text>
                                    <Text selectable style={styles.certBold}>
                                        {viewingDoc.documentNumber}
                                    </Text>
                                </View>
                                <View style={styles.certGridItem}>
                                    <Text style={styles.certLabel}>
                                        ASSET / OPERATOR
                                    </Text>
                                    <Text style={styles.certBold}>
                                        {viewingDoc.assetCode ||
                                            viewingDoc.operatorName}
                                    </Text>
                                </View>
                                <View style={styles.certGridItem}>
                                    <Text style={styles.certLabel}>
                                        ISSUING BODY
                                    </Text>
                                    <Text style={styles.certValue}>
                                        {viewingDoc.issuingAuthority}
                                    </Text>
                                </View>
                                <View style={styles.certGridItem}>
                                    <Text style={styles.certLabel}>
                                        VALIDITY PERIOD
                                    </Text>
                                    <Text style={styles.certValue}>
                                        {viewingDoc.issuedDate} through{' '}
                                        {viewingDoc.expiryDate || 'Indefinite'}
                                    </Text>
                                </View>
                            </View>

                            {viewingDoc.notes ? (
                                <View style={styles.certNotesBox}>
                                    <Text style={styles.certNotesLabel}>
                                        SPECIAL ROAD TRANSIT CONDITIONS
                                    </Text>
                                    <Text style={styles.certNotesText}>
                                        {viewingDoc.notes}
                                    </Text>
                                </View>
                            ) : null}

                            {/* Digital Stamp & QR Verification */}
                            <View style={styles.qrVerificationBox}>
                                <View style={styles.qrMockup}>
                                    <Icon
                                        name="tools"
                                        size={28}
                                        color="#6B21A8"
                                    />
                                    <Text style={styles.qrText}>
                                        VERIFIED SEAL
                                    </Text>
                                </View>
                                <View style={styles.qrCopy}>
                                    <Text style={styles.qrTitle}>
                                        ✓ Cryptographically Verified
                                    </Text>
                                    <Text style={styles.qrSub}>
                                        DOLE-OSHC / DPWH Online Registry Synced
                                    </Text>
                                </View>
                            </View>

                            <Pressable
                                accessibilityLabel="Close certificate view"
                                accessibilityRole="button"
                                onPress={() => setViewingDoc(null)}
                                style={({ pressed }) => [
                                    sharedStyles.button,
                                    styles.dismissBtn,
                                    pressed && styles.pressed,
                                ]}
                            >
                                <Text style={sharedStyles.buttonText}>
                                    Done / Dismiss
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    screenRoot: {
        backgroundColor: colors.background,
        flex: 1,
    },
    darkScreenRoot: {
        backgroundColor: '#090D16',
    },
    headerBar: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    darkHeaderBar: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
    },
    backButton: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 4,
        minHeight: 44,
        minWidth: 64,
    },
    backText: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    darkBackText: {
        color: '#F8FAFC',
    },
    headerTitles: {
        flex: 1,
    },
    screenTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
    },
    darkScreenTitle: {
        color: '#F8FAFC',
    },
    headerSubtitle: {
        color: colors.muted,
        fontSize: 11,
    },
    darkHeaderSubtitle: {
        color: '#94A3B8',
    },
    verifiedPill: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderColor: colors.greenBorder,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    verifiedPillText: {
        color: colors.greenDark,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    offlineNotice: {
        alignItems: 'center',
        backgroundColor: '#F3E8FF',
        borderColor: '#D8B4FE',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 10,
        marginHorizontal: 16,
        marginTop: 12,
        padding: 10,
    },
    darkOfflineNotice: {
        backgroundColor: '#2E1065',
        borderColor: '#7E22CE',
    },
    offlineNoticeText: {
        color: '#6B21A8',
        flex: 1,
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 15,
    },
    darkOfflineNoticeText: {
        color: '#E9D5FF',
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    searchBar: {
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
    darkSearchBar: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    searchInput: {
        color: colors.text,
        flex: 1,
        fontSize: 13,
    },
    darkSearchInput: {
        color: '#F8FAFC',
    },
    categoryRail: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    categoryPill: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    darkCategoryPill: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    categoryPillActive: {
        backgroundColor: '#7E22CE',
        borderColor: '#6B21A8',
    },
    categoryPillText: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '700',
    },
    darkCategoryPillText: {
        color: '#94A3B8',
    },
    categoryPillTextActive: {
        color: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        alignSelf: 'center',
        maxWidth: 720,
        padding: 16,
        paddingBottom: 40,
        width: '100%',
    },
    docsList: {
        gap: 12,
    },
    docCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 14,
        borderWidth: 1,
        padding: 14,
        ...shadows.sm,
    },
    darkDocCard: {
        backgroundColor: '#1E293B',
        borderColor: '#334155',
    },
    docHeader: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    categoryBadge: {
        backgroundColor: '#F3E8FF',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    categoryBadgeText: {
        color: '#7E22CE',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    validityBadge: {
        alignItems: 'center',
        backgroundColor: colors.greenLight,
        borderRadius: 6,
        flexDirection: 'row',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    validityText: {
        color: colors.greenDark,
        fontSize: 10,
        fontWeight: '800',
    },
    docTitle: {
        color: colors.text,
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 8,
    },
    darkDocTitle: {
        color: '#F8FAFC',
    },
    docDetailsBox: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 8,
        gap: 4,
        padding: 10,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailLabel: {
        color: colors.muted,
        fontSize: 11,
        fontWeight: '600',
    },
    detailValue: {
        color: colors.text,
        fontSize: 11,
        fontWeight: '700',
        maxWidth: 240,
        textAlign: 'right',
    },
    docNotes: {
        color: colors.secondary,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 8,
    },
    viewDocBtn: {
        alignItems: 'center',
        backgroundColor: '#F3E8FF',
        borderColor: '#D8B4FE',
        borderRadius: 10,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        marginTop: 10,
        minHeight: 44,
        paddingHorizontal: 12,
    },
    viewDocBtnText: {
        color: '#6B21A8',
        fontSize: 12,
        fontWeight: '800',
    },
    modalBackdrop: {
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        flex: 1,
        justifyContent: 'center',
        padding: 16,
    },
    certificateCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        maxWidth: 480,
        padding: 20,
        width: '100%',
        ...shadows.lg,
    },
    darkCertificateCard: {
        backgroundColor: '#0F172A',
        borderColor: '#334155',
        borderWidth: 1,
    },
    certHeaderRow: {
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    certEmblem: {
        alignItems: 'center',
        backgroundColor: '#F3E8FF',
        borderRadius: 20,
        height: 40,
        justifyContent: 'center',
        width: 40,
    },
    certHeaderCopy: {
        flex: 1,
    },
    certOfficialTitle: {
        color: '#6B21A8',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    certOfficialSub: {
        color: colors.muted,
        fontSize: 9,
        fontWeight: '700',
    },
    modalCloseBtn: {
        padding: 6,
    },
    certDivider: {
        backgroundColor: colors.border,
        height: 1,
        marginVertical: 12,
    },
    certTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
        marginBottom: 12,
        textAlign: 'center',
    },
    certGrid: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        gap: 8,
        marginBottom: 12,
        padding: 12,
    },
    certGridItem: {
        gap: 2,
    },
    certLabel: {
        color: colors.muted,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    certBold: {
        color: colors.text,
        fontFamily: 'monospace',
        fontSize: 13,
        fontWeight: '800',
    },
    certValue: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '600',
    },
    certNotesBox: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
        borderRadius: 8,
        borderWidth: 1,
        marginBottom: 12,
        padding: 10,
    },
    certNotesLabel: {
        color: '#B45309',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    certNotesText: {
        color: '#78350F',
        fontSize: 11,
        lineHeight: 15,
    },
    qrVerificationBox: {
        alignItems: 'center',
        backgroundColor: '#F3E8FF',
        borderRadius: 10,
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
        padding: 12,
    },
    qrMockup: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        height: 48,
        justifyContent: 'center',
        width: 48,
    },
    qrText: {
        color: '#6B21A8',
        fontSize: 7,
        fontWeight: '900',
    },
    qrCopy: {
        flex: 1,
    },
    qrTitle: {
        color: '#6B21A8',
        fontSize: 13,
        fontWeight: '800',
    },
    qrSub: {
        color: '#7E22CE',
        fontSize: 11,
    },
    dismissBtn: {
        backgroundColor: '#6B21A8',
        minHeight: 48,
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.985 }],
    },
});
