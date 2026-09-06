import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useTheme } from '../../theme';
import { colors } from '../nativeStyles';

export interface PhotoAttachment {
    uri: string;
    fileName?: string;
    fileSize?: number;
    base64?: string;
}

export interface PhotoAttachmentPickerProps {
    attachments: PhotoAttachment[];
    onAddAttachment: (attachment: PhotoAttachment) => void;
    onRemoveAttachment: (index: number) => void;
    maxCount?: number;
    title?: string;
    helperText?: string;
    testID?: string;
    style?: StyleProp<ViewStyle>;
}

export const PhotoAttachmentPicker: React.FC<PhotoAttachmentPickerProps> = ({
    attachments,
    onAddAttachment,
    onRemoveAttachment,
    maxCount = 4,
    title = 'Attach Photo Evidence',
    helperText = 'Add photos of defects, serial tags, or site hazards.',
    testID = 'photo-attachment-picker',
    style,
}) => {
    const { isDarkHud } = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const canAddMore = attachments.length < maxCount;

    const handleTakePhoto = async () => {
        if (!canAddMore) {
            return;
        }

        try {
            const { status } =
                await ImagePicker.requestCameraPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert(
                    'Camera Permission Required',
                    'Please allow camera access in device settings to take inspection photos.',
                );

                return;
            }

            setIsLoading(true);
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                onAddAttachment({
                    uri: asset.uri,
                    fileName: asset.fileName || `photo_${Date.now()}.jpg`,
                    fileSize: asset.fileSize,
                    base64: asset.base64 || undefined,
                });
            }
        } catch {
            Alert.alert(
                'Camera Error',
                'Unable to capture photo. Please try again.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleChooseFromGallery = async () => {
        if (!canAddMore) {
            return;
        }

        try {
            const { status } =
                await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert(
                    'Photo Library Permission Required',
                    'Please allow photo library access in device settings to select images.',
                );

                return;
            }

            setIsLoading(true);
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                onAddAttachment({
                    uri: asset.uri,
                    fileName: asset.fileName || `gallery_${Date.now()}.jpg`,
                    fileSize: asset.fileSize,
                    base64: asset.base64 || undefined,
                });
            }
        } catch {
            Alert.alert(
                'Gallery Error',
                'Unable to select photo. Please try again.',
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View
            style={[styles.container, isDarkHud && styles.darkContainer, style]}
            testID={testID}
        >
            <View style={styles.headerRow}>
                <Text style={[styles.title, isDarkHud && styles.darkTitle]}>
                    {title}
                </Text>
                <Text style={[styles.counter, isDarkHud && styles.darkCounter]}>
                    {attachments.length} / {maxCount}
                </Text>
            </View>
            {helperText ? (
                <Text style={[styles.helper, isDarkHud && styles.darkHelper]}>
                    {helperText}
                </Text>
            ) : null}

            {/* Thumbnail Preview Grid */}
            {attachments.length > 0 ? (
                <View
                    style={styles.thumbnailGrid}
                    testID={`${testID}-thumbnails`}
                >
                    {attachments.map((item, index) => (
                        <View
                            key={`${item.uri}-${index}`}
                            style={[
                                styles.thumbnailWrapper,
                                isDarkHud && styles.darkThumbnailWrapper,
                            ]}
                        >
                            <Image
                                source={{ uri: item.uri }}
                                style={styles.thumbnail}
                                accessibilityLabel={`Attached photo ${index + 1}`}
                            />
                            <Pressable
                                accessibilityLabel={`Remove photo ${index + 1}`}
                                accessibilityRole="button"
                                onPress={() => onRemoveAttachment(index)}
                                style={({ pressed }) => [
                                    styles.removeButton,
                                    pressed && styles.pressed,
                                ]}
                                testID={`${testID}-remove-${index}`}
                            >
                                <Text style={styles.removeIcon}>✕</Text>
                            </Pressable>
                        </View>
                    ))}
                </View>
            ) : null}

            {/* Action Buttons */}
            {canAddMore ? (
                <View style={styles.actionRow}>
                    <Pressable
                        accessibilityLabel="Take photo with camera"
                        accessibilityRole="button"
                        disabled={isLoading}
                        onPress={handleTakePhoto}
                        style={({ pressed }) => [
                            styles.actionButton,
                            isDarkHud && styles.darkActionButton,
                            pressed && styles.pressed,
                        ]}
                        testID={`${testID}-take-photo`}
                    >
                        {isLoading ? (
                            <ActivityIndicator
                                color={isDarkHud ? '#F59E0B' : colors.amberDark}
                                size="small"
                            />
                        ) : (
                            <Text
                                style={[
                                    styles.actionText,
                                    isDarkHud && styles.darkActionText,
                                ]}
                            >
                                Take Photo
                            </Text>
                        )}
                    </Pressable>

                    <Pressable
                        accessibilityLabel="Choose photo from gallery"
                        accessibilityRole="button"
                        disabled={isLoading}
                        onPress={handleChooseFromGallery}
                        style={({ pressed }) => [
                            styles.actionButton,
                            styles.galleryButton,
                            isDarkHud && styles.darkGalleryButton,
                            pressed && styles.pressed,
                        ]}
                        testID={`${testID}-choose-gallery`}
                    >
                        {isLoading ? (
                            <ActivityIndicator
                                color={
                                    isDarkHud
                                        ? colors.hudTextDim
                                        : colors.secondary
                                }
                                size="small"
                            />
                        ) : (
                            <Text
                                style={[
                                    styles.actionText,
                                    isDarkHud && styles.darkActionText,
                                ]}
                            >
                                Choose Photo
                            </Text>
                        )}
                    </Pressable>
                </View>
            ) : (
                <View
                    style={[
                        styles.maxNotice,
                        isDarkHud && styles.darkMaxNotice,
                    ]}
                >
                    <Text
                        style={[
                            styles.maxNoticeText,
                            isDarkHud && styles.darkMaxNoticeText,
                        ]}
                    >
                        Maximum {maxCount} photos attached.
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 12,
        padding: 14,
    },
    headerRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    title: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
    },
    counter: {
        color: colors.secondary,
        fontSize: 12,
        fontWeight: '700',
    },
    helper: {
        color: colors.muted,
        fontSize: 12,
        marginTop: 2,
    },
    thumbnailGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginVertical: 12,
    },
    thumbnailWrapper: {
        borderColor: colors.borderStrong,
        borderRadius: 8,
        borderWidth: 1,
        height: 72,
        overflow: 'hidden',
        position: 'relative',
        width: 72,
    },
    thumbnail: {
        height: '100%',
        width: '100%',
    },
    removeButton: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 10,
        height: 20,
        justifyContent: 'center',
        position: 'absolute',
        right: 3,
        top: 3,
        width: 20,
    },
    removeIcon: {
        color: colors.white,
        fontSize: 11,
        fontWeight: '900',
        lineHeight: 12,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    actionButton: {
        alignItems: 'center',
        backgroundColor: colors.amberSoft,
        borderColor: colors.amberBorder,
        borderRadius: 8,
        borderWidth: 1,
        flex: 1,
        flexDirection: 'row',
        gap: 6,
        justifyContent: 'center',
        minHeight: 48,
        paddingHorizontal: 12,
    },
    galleryButton: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.borderStrong,
    },
    actionIcon: {
        fontSize: 16,
    },
    actionText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    maxNotice: {
        backgroundColor: colors.surfaceMuted,
        borderRadius: 6,
        marginTop: 8,
        padding: 8,
    },
    maxNoticeText: {
        color: colors.secondary,
        fontSize: 12,
        textAlign: 'center',
    },
    darkContainer: {
        backgroundColor: colors.hudSurface,
        borderColor: colors.hudBorder,
    },
    darkTitle: {
        color: colors.hudText,
    },
    darkCounter: {
        color: colors.hudTextDim,
    },
    darkHelper: {
        color: colors.hudTextDim,
    },
    darkThumbnailWrapper: {
        borderColor: colors.hudBorder,
    },
    darkActionButton: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        borderColor: 'rgba(245, 158, 11, 0.45)',
    },
    darkGalleryButton: {
        backgroundColor: colors.surfaceDark,
        borderColor: colors.hudBorder,
    },
    darkActionText: {
        color: colors.hudText,
    },
    darkMaxNotice: {
        backgroundColor: colors.surfaceDark,
    },
    darkMaxNoticeText: {
        color: colors.hudTextDim,
    },
    pressed: {
        opacity: 0.75,
    },
});
