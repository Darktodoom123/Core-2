import React from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { ComplianceDocument } from '../../types/index';
import { categoryLabel } from './document-catalog';
import { documentStatusTone } from './document-status-tone';
import { DocumentViewerFile } from './document-viewer-file';

export interface DocumentViewerSheetProps {
    doc: ComplianceDocument;
    isDownloading: boolean;
    onClose: () => void;
    onMakeOffline: (doc: ComplianceDocument) => void;
    onRemoveOffline: (doc: ComplianceDocument) => void;
}

interface FactProps {
    label: string;
    value?: string | null;
    mono?: boolean;
}

const Fact: React.FC<FactProps> = ({ label, value, mono = false }) => {
    const styles = useThemedStyles(createStyles);

    return (
        <View style={styles.factRow}>
            <Text style={styles.factLabel}>{label}</Text>
            <Text selectable style={[styles.factValue, mono && styles.mono]}>
                {value || '—'}
            </Text>
        </View>
    );
};

/**
 * One detail view for a compliance document. It leads with the status the
 * server reported, lists the recorded facts, and states plainly when the
 * record was last synced. It never renders an imitation certificate.
 */
export const DocumentViewerSheet: React.FC<DocumentViewerSheetProps> = ({
    doc,
    isDownloading,
    onClose,
    onMakeOffline,
    onRemoveOffline,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const status = documentStatusTone(theme, doc.validityStatus ?? doc.status);

    return (
        <Modal
            animationType="slide"
            onRequestClose={onClose}
            transparent
            visible
        >
            <View style={styles.backdrop} testID="certificate-modal">
                <View pointerEvents="none" style={styles.scrim} />
                <Pressable
                    accessibilityLabel="Dismiss modal backdrop"
                    accessibilityRole="button"
                    onPress={onClose}
                    style={styles.backdropTouchArea}
                />

                <View style={styles.sheet} testID="doc-viewer-sheet">
                    <View style={styles.handleBar}>
                        <View style={styles.handle} />
                    </View>

                    <View style={styles.headerRow}>
                        <View style={styles.headerText}>
                            <Text style={styles.category}>
                                {categoryLabel(doc)}
                            </Text>
                            <Text
                                accessibilityRole="header"
                                style={styles.title}
                            >
                                {doc.title}
                            </Text>
                        </View>
                        <Pressable
                            accessibilityLabel="Close PDF reader"
                            accessibilityRole="button"
                            onPress={onClose}
                            style={styles.closeBtn}
                        >
                            <Icon
                                color={theme.textSecondary}
                                name="close"
                                size={20}
                            />
                        </Pressable>
                    </View>

                    <ScrollView
                        bounces={false}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        <View
                            accessibilityRole="summary"
                            style={[
                                styles.statusBanner,
                                {
                                    backgroundColor: status.background,
                                    borderColor: status.border,
                                },
                            ]}
                            testID="doc-viewer-status"
                        >
                            <Icon
                                color={status.text}
                                name={status.icon}
                                size={20}
                            />
                            <View style={styles.statusText}>
                                <Text
                                    style={[
                                        styles.statusLabel,
                                        { color: status.text },
                                    ]}
                                >
                                    {status.label}
                                </Text>
                                <Text style={styles.statusDetail}>
                                    {status.detail(doc.expiryDate)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.facts}>
                            <Fact
                                label="Document number"
                                mono
                                value={doc.documentNumber}
                            />
                            <Fact
                                label={
                                    doc.assetCode ? 'Assigned unit' : 'Holder'
                                }
                                value={doc.assetCode || doc.operatorName}
                            />
                            <Fact
                                label="Issuing authority"
                                value={doc.issuingAuthority}
                            />
                            <Fact label="Issued" value={doc.issuedDate} />
                            <Fact
                                label="Expires"
                                value={doc.expiryDate || 'No expiry date'}
                            />
                        </View>

                        {doc.notes ? (
                            <View style={styles.conditions}>
                                <Text style={styles.conditionsTitle}>
                                    CONDITIONS & RESTRICTIONS
                                </Text>
                                <Text style={styles.conditionsBody}>
                                    {doc.notes}
                                </Text>
                            </View>
                        ) : null}

                        <DocumentViewerFile
                            doc={doc}
                            isDownloading={isDownloading}
                            onMakeOffline={onMakeOffline}
                            onRemoveOffline={onRemoveOffline}
                        />

                        <View style={styles.syncRow} testID="doc-viewer-sync">
                            <Icon
                                color={theme.textSecondary}
                                name="sync"
                                size={14}
                            />
                            <Text style={styles.syncText}>
                                {doc.lastSynchronized
                                    ? `Last synced ${new Date(doc.lastSynchronized).toLocaleDateString()}`
                                    : 'Not synced on this device yet'}
                            </Text>
                        </View>
                        {doc.isAvailableOffline ? (
                            <Text style={styles.syncNote}>
                                Offline copy. A change of status appears after
                                the next sync.
                            </Text>
                        ) : null}

                        <Pressable
                            accessibilityLabel="Close certificate view"
                            accessibilityRole="button"
                            onPress={onClose}
                            style={({ pressed }) => [
                                styles.doneBtn,
                                pressed && styles.pressed,
                            ]}
                        >
                            <Text style={styles.doneBtnText}>Done</Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        backdrop: {
            flex: 1,
            justifyContent: 'flex-end',
        },
        scrim: {
            backgroundColor: theme.surfaceDark,
            bottom: 0,
            left: 0,
            opacity: 0.65,
            position: 'absolute',
            right: 0,
            top: 0,
        },
        backdropTouchArea: {
            flex: 1,
        },
        // Floating layer: carries the shadow.
        sheet: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            elevation: 16,
            maxHeight: '92%',
            paddingHorizontal: 20,
        },
        handleBar: {
            alignItems: 'center',
            paddingVertical: 10,
        },
        handle: {
            backgroundColor: theme.borderStrong,
            borderRadius: 3,
            height: 5,
            width: 40,
        },
        headerRow: {
            alignItems: 'flex-start',
            flexDirection: 'row',
            gap: 8,
            marginBottom: 12,
        },
        headerText: {
            flex: 1,
            minWidth: 0,
        },
        category: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
        },
        title: {
            color: theme.textPrimary,
            fontSize: 19,
            fontWeight: '700',
            lineHeight: 25,
            marginTop: 2,
        },
        closeBtn: {
            alignItems: 'center',
            height: 48,
            justifyContent: 'center',
            width: 48,
        },
        scrollContent: {
            paddingBottom: 28,
        },
        statusBanner: {
            alignItems: 'flex-start',
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 10,
            padding: 12,
        },
        statusText: {
            flex: 1,
        },
        statusLabel: {
            fontSize: 15,
            fontWeight: '700',
        },
        statusDetail: {
            color: theme.textPrimary,
            fontSize: 14,
            lineHeight: 20,
            marginTop: 2,
        },
        facts: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 12,
            borderWidth: 1,
            marginTop: 16,
            paddingHorizontal: 12,
        },
        factRow: {
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
            paddingVertical: 10,
        },
        factLabel: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '500',
        },
        factValue: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
            marginTop: 2,
        },
        mono: {
            fontFamily: 'monospace',
        },
        conditions: {
            backgroundColor: theme.surfaceHighlight,
            borderLeftColor: theme.borderStrong,
            borderLeftWidth: 3,
            borderRadius: 8,
            marginTop: 16,
            padding: 12,
        },
        conditionsTitle: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
            marginBottom: 4,
        },
        conditionsBody: {
            color: theme.textPrimary,
            fontSize: 14,
            lineHeight: 20,
        },
        syncRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 6,
            marginTop: 16,
        },
        syncText: {
            color: theme.textSecondary,
            fontSize: 13,
        },
        syncNote: {
            color: theme.textSecondary,
            fontSize: 12,
            marginTop: 4,
        },
        doneBtn: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1,
            justifyContent: 'center',
            marginTop: 20,
            minHeight: 48,
        },
        doneBtnText: {
            color: theme.textPrimary,
            fontSize: 15,
            fontWeight: '700',
        },
        pressed: {
            opacity: 0.8,
        },
    });
