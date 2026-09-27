import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { ComplianceDocument } from '../../types/index';
import { categoryLabel } from './document-catalog';
import { documentStatusTone } from './document-status-tone';

export interface DocumentCardProps {
    doc: ComplianceDocument;
    onOpen: (doc: ComplianceDocument) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ doc, onOpen }) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const status = documentStatusTone(theme, doc.validityStatus ?? doc.status);
    const isOffline = Boolean(doc.isAvailableOffline);

    return (
        <View style={styles.card} testID={`doc-card-${doc.id}`}>
            <Pressable
                accessibilityLabel={`View ${doc.title}`}
                accessibilityRole="button"
                onPress={() => onOpen(doc)}
                style={({ pressed }) => [
                    styles.pressable,
                    pressed && styles.pressed,
                ]}
                testID={`view-doc-btn-${doc.id}`}
            >
                <View style={styles.topRow}>
                    <Text style={styles.docNumber}>{doc.documentNumber}</Text>
                    <View style={styles.badges}>
                        <View
                            style={[
                                styles.badge,
                                isOffline
                                    ? styles.offlineReady
                                    : styles.offlineNone,
                            ]}
                        >
                            <Icon
                                color={
                                    isOffline
                                        ? theme.successEmeraldText
                                        : theme.textSecondary
                                }
                                name={isOffline ? 'check' : 'cloud'}
                                size={12}
                            />
                            <Text
                                style={[
                                    styles.badgeText,
                                    {
                                        color: isOffline
                                            ? theme.successEmeraldText
                                            : theme.textSecondary,
                                    },
                                ]}
                            >
                                {isOffline ? 'Saved offline' : 'Online only'}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.badge,
                                {
                                    backgroundColor: status.background,
                                    borderColor: status.border,
                                },
                            ]}
                            testID={`doc-status-${doc.id}`}
                        >
                            <Icon
                                color={status.text}
                                name={status.icon}
                                size={12}
                            />
                            <Text
                                style={[
                                    styles.badgeText,
                                    { color: status.text },
                                ]}
                            >
                                {status.label}
                            </Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.category}>{categoryLabel(doc)}</Text>
                <Text numberOfLines={2} style={styles.title}>
                    {doc.title}
                </Text>

                <View style={styles.metaRow}>
                    <Text numberOfLines={1} style={styles.authority}>
                        {doc.issuingAuthority}
                    </Text>
                    <Text style={styles.expiry}>
                        Exp: {doc.expiryDate || 'No Expiry Date'}
                    </Text>
                </View>

                {doc.lastSynchronized ? (
                    <Text style={styles.syncLabel}>
                        Last synced{' '}
                        {new Date(doc.lastSynchronized).toLocaleDateString()}
                    </Text>
                ) : null}

                {doc.notes ? (
                    <View style={styles.conditionStrip}>
                        <Text numberOfLines={2} style={styles.conditionText}>
                            {doc.notes}
                        </Text>
                    </View>
                ) : null}

                <View style={styles.footer}>
                    <View style={styles.fileTag}>
                        <Icon
                            color={theme.textSecondary}
                            name="file-text"
                            size={14}
                        />
                        <Text style={styles.fileTagText}>
                            {doc.fileSizeLabel || 'PDF'}
                        </Text>
                    </View>
                    <View style={styles.fileTag}>
                        <Text style={styles.inspectText}>Inspect</Text>
                        <Icon
                            color={theme.textSecondary}
                            name="chevron-right"
                            size={16}
                        />
                    </View>
                </View>
            </Pressable>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        // Resting card: border only, no shadow.
        card: {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 16,
            borderWidth: 1,
            marginBottom: 12,
            overflow: 'hidden',
        },
        pressable: {
            padding: 16,
        },
        pressed: {
            backgroundColor: theme.surfaceHighlight,
        },
        topRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'space-between',
            marginBottom: 8,
        },
        docNumber: {
            color: theme.textSecondary,
            flexShrink: 1,
            fontFamily: 'monospace',
            fontSize: 12,
            fontWeight: '700',
        },
        badges: {
            alignItems: 'center',
            flexDirection: 'row',
            flexShrink: 0,
            gap: 6,
        },
        badge: {
            alignItems: 'center',
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 3,
        },
        offlineReady: {
            backgroundColor: theme.successEmeraldLight,
            borderColor: theme.successEmerald,
        },
        offlineNone: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
        },
        badgeText: {
            fontSize: 12,
            fontWeight: '700',
        },
        category: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.4,
            marginBottom: 2,
            textTransform: 'uppercase',
        },
        title: {
            color: theme.textPrimary,
            fontSize: 17,
            fontWeight: '700',
            lineHeight: 22,
        },
        metaRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'space-between',
            marginTop: 6,
        },
        authority: {
            color: theme.textSecondary,
            flex: 1,
            fontSize: 13,
        },
        expiry: {
            color: theme.textPrimary,
            fontSize: 13,
            fontWeight: '700',
        },
        syncLabel: {
            color: theme.textSecondary,
            fontSize: 12,
            marginTop: 4,
        },
        conditionStrip: {
            backgroundColor: theme.surfaceHighlight,
            borderLeftColor: theme.borderStrong,
            borderLeftWidth: 3,
            borderRadius: 6,
            marginTop: 10,
            paddingHorizontal: 10,
            paddingVertical: 6,
        },
        conditionText: {
            color: theme.textPrimary,
            fontSize: 13,
            lineHeight: 18,
        },
        footer: {
            alignItems: 'center',
            borderTopColor: theme.border,
            borderTopWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 10,
        },
        fileTag: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 4,
        },
        fileTagText: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '500',
        },
        inspectText: {
            color: theme.textPrimary,
            fontSize: 13,
            fontWeight: '700',
        },
    });
