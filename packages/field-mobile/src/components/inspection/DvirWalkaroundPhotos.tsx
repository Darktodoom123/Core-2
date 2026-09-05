import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
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
import type { PhotoAttachment } from '../attachments/PhotoAttachmentPicker';
import { Icon } from '../common/Icon';
import { colors } from '../nativeStyles';

const generatePhotoName = (angle: string, source: 'camera' | 'gallery') => {
    const timestamp = Math.floor(Date.now());

    return source === 'camera'
        ? `${angle}_${timestamp}.jpg`
        : `${angle}_gallery_${timestamp}.jpg`;
};

export type WalkaroundAngle =
    'driver_side' | 'front' | 'passenger_side' | 'back';

export interface WalkaroundAngleConfig {
    key: WalkaroundAngle;
    label: string;
    testID: string;
}

export const WALKAROUND_ANGLES: WalkaroundAngleConfig[] = [
    { key: 'driver_side', label: 'Driver Side', testID: 'slot-driver-side' },
    { key: 'front', label: 'Front', testID: 'slot-front' },
    {
        key: 'passenger_side',
        label: 'Passenger Side',
        testID: 'slot-passenger-side',
    },
    { key: 'back', label: 'Back', testID: 'slot-back' },
];

export type WalkaroundPhotosMap = Partial<
    Record<WalkaroundAngle, PhotoAttachment>
>;

export interface DvirWalkaroundPhotosProps {
    photos: WalkaroundPhotosMap;
    onCapturePhoto: (angle: WalkaroundAngle, photo: PhotoAttachment) => void;
    onRemovePhoto: (angle: WalkaroundAngle) => void;
    title?: string;
    testID?: string;
}

export const DvirWalkaroundPhotos: React.FC<DvirWalkaroundPhotosProps> = ({
    photos,
    onCapturePhoto,
    onRemovePhoto,
    title = 'Take walkaround photos',
    testID = 'dvir-walkaround-photos',
}) => {
    const { isDarkHud } = useTheme();
    const [loadingAngle, setLoadingAngle] = useState<WalkaroundAngle | null>(
        null,
    );

    const handleTakePhoto = async (angle: WalkaroundAngle) => {
        try {
            const { status } =
                await ImagePicker.requestCameraPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert(
                    'Camera Permission Required',
                    'Please allow camera access in device settings to take walkaround photos.',
                );

                return;
            }

            setLoadingAngle(angle);
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];

                onCapturePhoto(angle, {
                    uri: asset.uri,
                    fileName:
                        asset.fileName || generatePhotoName(angle, 'camera'),
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
            setLoadingAngle(null);
        }
    };

    const handleSelectPhotoSource = (angle: WalkaroundAngle, label: string) => {
        Alert.alert(
            `Photo: ${label}`,
            'Capture with camera or select from library',
            [
                {
                    text: 'Take Photo',
                    onPress: () => void handleTakePhoto(angle),
                },
                {
                    text: 'Photo Library',
                    onPress: () => void handleChooseFromGallery(angle),
                },
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
            ],
        );
    };

    const handleChooseFromGallery = async (angle: WalkaroundAngle) => {
        try {
            const { status } =
                await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert(
                    'Photo Library Permission Required',
                    'Please allow photo library access in device settings.',
                );

                return;
            }

            setLoadingAngle(angle);
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 0.7,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];

                onCapturePhoto(angle, {
                    uri: asset.uri,
                    fileName:
                        asset.fileName || generatePhotoName(angle, 'gallery'),
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
            setLoadingAngle(null);
        }
    };

    return (
        <View style={styles.container} testID={testID}>
            <Text
                style={[
                    styles.sectionTitle,
                    isDarkHud && styles.darkSectionTitle,
                ]}
            >
                {title}
            </Text>

            <View style={styles.gridRow}>
                {WALKAROUND_ANGLES.map((angleConfig) => {
                    const photo = photos[angleConfig.key];
                    const isLoading = loadingAngle === angleConfig.key;

                    return (
                        <View
                            key={angleConfig.key}
                            style={styles.slotContainer}
                        >
                            <Pressable
                                accessibilityLabel={`${angleConfig.label} photo slot${photo ? ', captured' : ', empty'}`}
                                accessibilityRole="button"
                                disabled={isLoading}
                                onPress={() => {
                                    handleSelectPhotoSource(
                                        angleConfig.key,
                                        angleConfig.label,
                                    );
                                }}
                                style={({ pressed }) => [
                                    styles.photoSlot,
                                    isDarkHud && styles.darkPhotoSlot,
                                    photo && styles.photoSlotCaptured,
                                    isDarkHud &&
                                        photo &&
                                        styles.darkPhotoSlotCaptured,
                                    pressed && styles.pressed,
                                ]}
                                testID={angleConfig.testID}
                            >
                                {isLoading ? (
                                    <ActivityIndicator
                                        color={
                                            isDarkHud
                                                ? '#F59E0B'
                                                : colors.primary
                                        }
                                        size="small"
                                    />
                                ) : photo ? (
                                    <>
                                        <Image
                                            accessibilityLabel={`${angleConfig.label} thumbnail`}
                                            source={{ uri: photo.uri }}
                                            style={styles.thumbnailImage}
                                        />
                                        <View style={styles.checkmarkBadge}>
                                            <Icon
                                                color="#FFFFFF"
                                                name="check"
                                                size={12}
                                            />
                                        </View>
                                        <Pressable
                                            accessibilityLabel={`Remove ${angleConfig.label} photo`}
                                            accessibilityRole="button"
                                            hitSlop={8}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                onRemovePhoto(angleConfig.key);
                                            }}
                                            style={styles.removeSlotBtn}
                                            testID={`remove-${angleConfig.key}`}
                                        >
                                            <Icon
                                                color="#FFFFFF"
                                                name="close"
                                                size={12}
                                            />
                                        </Pressable>
                                    </>
                                ) : (
                                    <View style={styles.cameraIconWrapper}>
                                        <Icon
                                            color={
                                                isDarkHud
                                                    ? '#F59E0B'
                                                    : colors.primary
                                            }
                                            name="camera"
                                            size={26}
                                        />
                                    </View>
                                )}
                            </Pressable>

                            <Text
                                numberOfLines={1}
                                style={[
                                    styles.slotLabel,
                                    isDarkHud && styles.darkSlotLabel,
                                    photo &&
                                        (isDarkHud
                                            ? styles.darkSlotLabelActive
                                            : styles.slotLabelActive),
                                ]}
                            >
                                {angleConfig.label}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 18,
    },
    sectionTitle: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0.1,
        marginBottom: 12,
    },
    darkSectionTitle: {
        color: '#F8FAFC',
    },
    gridRow: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'space-between',
    },
    slotContainer: {
        alignItems: 'center',
        flex: 1,
    },
    photoSlot: {
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderColor: colors.borderStrong,
        borderRadius: 12,
        borderWidth: 1.5,
        height: 72,
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
    },
    darkPhotoSlot: {
        backgroundColor: '#101A2E',
        borderColor: '#1E3254',
    },
    photoSlotCaptured: {
        borderColor: '#059669',
        borderWidth: 2,
    },
    darkPhotoSlotCaptured: {
        borderColor: '#10B981',
    },
    cameraIconWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbnailImage: {
        borderRadius: 10,
        height: '100%',
        width: '100%',
    },
    checkmarkBadge: {
        alignItems: 'center',
        backgroundColor: '#10B981',
        borderRadius: 10,
        bottom: 4,
        height: 18,
        justifyContent: 'center',
        position: 'absolute',
        right: 4,
        width: 18,
    },
    removeSlotBtn: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        borderRadius: 10,
        height: 18,
        justifyContent: 'center',
        position: 'absolute',
        right: 4,
        top: 4,
        width: 18,
    },
    slotLabel: {
        color: colors.secondary,
        fontSize: 11,
        fontWeight: '700',
        marginTop: 6,
        textAlign: 'center',
    },
    darkSlotLabel: {
        color: '#94A3B8',
    },
    slotLabelActive: {
        color: colors.blue,
        fontWeight: '800',
    },
    darkSlotLabelActive: {
        color: '#38BDF8',
        fontWeight: '800',
    },
    pressed: {
        opacity: 0.78,
        transform: [{ scale: 0.96 }],
    },
});
