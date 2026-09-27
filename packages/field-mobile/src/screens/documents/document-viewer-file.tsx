import React from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Icon } from '../../components/common/Icon';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { ComplianceDocument } from '../../types/index';
import { fileNameFromUri, isImageFile } from './document-catalog';

export interface DocumentViewerFileProps {
    doc: ComplianceDocument;
    isDownloading: boolean;
    onMakeOffline: (doc: ComplianceDocument) => void;
    onRemoveOffline: (doc: ComplianceDocument) => void;
}

/**
 * The real file: what it is, whether a copy is on this device, and a preview
 * when the saved copy is an image. Nothing here is drawn to look official.
 */
export const DocumentViewerFile: React.FC<DocumentViewerFileProps> = ({
    doc,
    isDownloading,
    onMakeOffline,
    onRemoveOffline,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const hasFile = Boolean(doc.fileUri || doc.localFileUri);
    const fileName =
        doc.fileName || fileNameFromUri(doc.localFileUri) || doc.documentNumber;

    return (
        <View style={styles.section} testID="doc-viewer-file">
            <Text style={styles.sectionTitle}>FILE</Text>
            {hasFile ? (
                <View style={styles.fileRow}>
                    <Icon
                        color={theme.textSecondary}
                        name="file-text"
                        size={18}
                    />
                    <View style={styles.fileText}>
                        <Text numberOfLines={1} style={styles.fileName}>
                            {fileName}
                        </Text>
                        <Text style={styles.fileMeta}>
                            {doc.fileSizeLabel || 'Source file'}
                        </Text>
                    </View>
                </View>
            ) : null}

            {isImageFile(doc.localFileUri) ? (
                <Image
                    accessibilityLabel={`Saved copy of ${doc.title}`}
                    resizeMode="contain"
                    source={{ uri: doc.localFileUri ?? undefined }}
                    style={styles.preview}
                />
            ) : null}

            {doc.isAvailableOffline ? (
                <View style={styles.offlineRow}>
                    <View style={styles.savedTag}>
                        <Icon
                            color={theme.successEmeraldText}
                            name="check"
                            size={14}
                        />
                        <Text style={styles.savedTagText}>
                            Saved on this device
                        </Text>
                    </View>
                    <Pressable
                        accessibilityLabel="Remove offline copy"
                        accessibilityRole="button"
                        onPress={() => onRemoveOffline(doc)}
                        style={styles.removeBtn}
                        testID="remove-offline-copy-btn"
                    >
                        <Icon
                            color={theme.hazardRedText}
                            name="trash"
                            size={16}
                        />
                        <Text style={styles.removeBtnText}>Remove Copy</Text>
                    </Pressable>
                </View>
            ) : doc.fileUri ? (
                <>
                    <Text style={styles.hint}>
                        The file is online only. Save it to open it without a
                        connection.
                    </Text>
                    <Pressable
                        accessibilityLabel="Make document available offline"
                        accessibilityRole="button"
                        accessibilityState={{ busy: isDownloading }}
                        disabled={isDownloading}
                        onPress={() => onMakeOffline(doc)}
                        style={[styles.saveBtn, isDownloading && styles.busy]}
                        testID="make-offline-btn"
                    >
                        {isDownloading ? (
                            <ActivityIndicator
                                color={theme.surfaceDark}
                                size="small"
                            />
                        ) : (
                            <>
                                <Icon
                                    color={theme.surfaceDark}
                                    name="download"
                                    size={16}
                                />
                                <Text style={styles.saveBtnText}>
                                    Make Available Offline
                                </Text>
                            </>
                        )}
                    </Pressable>
                </>
            ) : (
                <Text style={styles.hint}>
                    No file is attached to this record.
                </Text>
            )}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        section: {
            borderTopColor: theme.border,
            borderTopWidth: 1,
            gap: 10,
            marginTop: 16,
            paddingTop: 16,
        },
        sectionTitle: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.5,
        },
        fileRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 10,
        },
        fileText: {
            flex: 1,
            minWidth: 0,
        },
        fileName: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        fileMeta: {
            color: theme.textSecondary,
            fontSize: 12,
        },
        preview: {
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.border,
            borderRadius: 10,
            borderWidth: 1,
            height: 240,
            width: '100%',
        },
        offlineRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'space-between',
        },
        savedTag: {
            alignItems: 'center',
            backgroundColor: theme.successEmeraldLight,
            borderColor: theme.successEmerald,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            flexShrink: 1,
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 6,
        },
        savedTagText: {
            color: theme.successEmeraldText,
            fontSize: 13,
            fontWeight: '700',
        },
        removeBtn: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.hazardRed,
            borderRadius: 12,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            justifyContent: 'center',
            minHeight: 48,
            paddingHorizontal: 14,
        },
        removeBtnText: {
            color: theme.hazardRedText,
            fontSize: 14,
            fontWeight: '700',
        },
        hint: {
            color: theme.textSecondary,
            fontSize: 13,
            lineHeight: 18,
        },
        saveBtn: {
            alignItems: 'center',
            backgroundColor: theme.brandAmber,
            borderRadius: 12,
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'center',
            minHeight: 52,
            paddingHorizontal: 16,
        },
        busy: {
            opacity: 0.6,
        },
        saveBtnText: {
            color: theme.surfaceDark,
            fontSize: 15,
            fontWeight: '700',
        },
    });
