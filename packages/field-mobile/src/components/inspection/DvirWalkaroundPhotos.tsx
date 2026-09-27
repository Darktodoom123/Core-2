import React from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';
import type { PhotoAttachment } from '../attachments/PhotoAttachmentPicker';
import { Icon } from '../common/Icon';
import { usePhotoCapture } from './use-photo-capture';

export type WalkaroundAngle =
    | 'driver_side'
    | 'front'
    | 'passenger_side'
    | 'back'
    | 'cab'
    | 'defect_1'
    | 'defect_2'
    | 'defect_3';

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

/** Close-ups of what is wrong; sent to the server as the `defect` angle. */
export const DEFECT_ANGLES: WalkaroundAngleConfig[] = [
    { key: 'defect_1', label: 'Defect 1', testID: 'slot-defect-1' },
    { key: 'defect_2', label: 'Defect 2', testID: 'slot-defect-2' },
    { key: 'defect_3', label: 'Defect 3', testID: 'slot-defect-3' },
];

export type WalkaroundPhotosMap = Partial<
    Record<WalkaroundAngle, PhotoAttachment>
>;

export interface DvirWalkaroundPhotosProps {
    photos: WalkaroundPhotosMap;
    onCapturePhoto: (angle: WalkaroundAngle, photo: PhotoAttachment) => void;
    onRemovePhoto: (angle: WalkaroundAngle) => void;
    title?: string;
    /** The slots to show; defaults to the four walkaround angles. */
    angles?: WalkaroundAngleConfig[];
    /** Shown next to the title, with how many photos are taken. */
    requirement?: 'required' | 'optional';
    testID?: string;
}

export const DvirWalkaroundPhotos: React.FC<DvirWalkaroundPhotosProps> = ({
    photos,
    onCapturePhoto,
    onRemovePhoto,
    title = 'Take walkaround photos',
    angles = WALKAROUND_ANGLES,
    requirement,
    testID = 'dvir-walkaround-photos',
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const { loadingAngle, choosePhoto } = usePhotoCapture(onCapturePhoto);
    const taken = angles.filter((angle) => photos[angle.key]).length;
    const isMissing = requirement === 'required' && taken < angles.length;

    return (
        <View style={styles.container} testID={testID}>
            <View style={styles.header}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {requirement ? (
                    <View
                        style={[
                            styles.badge,
                            isMissing ? styles.badgeMissing : null,
                        ]}
                        testID={`${testID}-requirement`}
                    >
                        {isMissing ? (
                            <Icon
                                color={theme.warningOrangeText}
                                name="camera"
                                size={12}
                            />
                        ) : null}
                        <Text
                            style={[
                                styles.badgeText,
                                isMissing ? styles.badgeTextMissing : null,
                            ]}
                        >
                            {requirement === 'required'
                                ? `REQUIRED · ${taken} of ${angles.length}`
                                : 'OPTIONAL'}
                        </Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.gridRow}>
                {angles.map((angleConfig) => {
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
                                    choosePhoto(
                                        angleConfig.key,
                                        angleConfig.label,
                                    );
                                }}
                                style={({ pressed }) => [
                                    styles.photoSlot,
                                    photo ? styles.photoSlotCaptured : null,
                                    pressed ? styles.pressed : null,
                                ]}
                                testID={angleConfig.testID}
                            >
                                {isLoading ? (
                                    <ActivityIndicator
                                        color={theme.textPrimary}
                                        size="small"
                                    />
                                ) : photo ? (
                                    <Image
                                        accessibilityLabel={`${angleConfig.label} thumbnail`}
                                        source={{ uri: photo.uri }}
                                        style={styles.thumbnailImage}
                                    />
                                ) : (
                                    <Icon
                                        color={theme.textPrimary}
                                        name="camera"
                                        size={24}
                                    />
                                )}
                            </Pressable>
                            {photo && !isLoading ? (
                                <Pressable
                                    accessibilityLabel={`Remove ${angleConfig.label} photo`}
                                    accessibilityRole="button"
                                    onPress={() =>
                                        onRemovePhoto(angleConfig.key)
                                    }
                                    style={styles.removeSlotBtn}
                                    testID={`remove-${angleConfig.key}`}
                                >
                                    <View style={styles.removeDot}>
                                        <Icon
                                            color={theme.textOnDark}
                                            name="close"
                                            size={12}
                                        />
                                    </View>
                                </Pressable>
                            ) : null}

                            <View style={styles.labelRow}>
                                {photo ? (
                                    <Icon
                                        color={theme.successEmeraldText}
                                        name="check-circle"
                                        size={12}
                                    />
                                ) : null}
                                <Text
                                    numberOfLines={1}
                                    style={[
                                        styles.slotLabel,
                                        photo ? styles.slotLabelTaken : null,
                                    ]}
                                >
                                    {angleConfig.label}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        container: {
            marginBottom: 18,
        },
        header: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 8,
            justifyContent: 'space-between',
            marginBottom: 12,
        },
        sectionTitle: {
            color: theme.textPrimary,
            flexShrink: 1,
            fontSize: 16,
            fontWeight: '700',
        },
        badge: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 8,
            flexDirection: 'row',
            gap: 4,
            paddingHorizontal: 8,
            paddingVertical: 4,
        },
        badgeMissing: {
            backgroundColor: theme.warningOrangeLight,
        },
        badgeText: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
            letterSpacing: 0.4,
        },
        badgeTextMissing: {
            color: theme.warningOrangeText,
        },
        gridRow: {
            flexDirection: 'row',
            gap: 10,
            justifyContent: 'space-between',
        },
        slotContainer: {
            alignItems: 'center',
            flex: 1,
            position: 'relative',
        },
        photoSlot: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderWidth: 1.5,
            height: 72,
            justifyContent: 'center',
            overflow: 'hidden',
            width: '100%',
        },
        photoSlotCaptured: {
            borderColor: theme.successEmerald,
            borderWidth: 2,
        },
        thumbnailImage: {
            borderRadius: 10,
            height: '100%',
            width: '100%',
        },
        // A 48dp target in the slot corner; the visible dot stays small.
        removeSlotBtn: {
            alignItems: 'flex-end',
            height: 48,
            padding: 4,
            position: 'absolute',
            right: 0,
            top: 0,
            width: 48,
        },
        removeDot: {
            alignItems: 'center',
            backgroundColor: theme.surfaceDark,
            borderRadius: 11,
            height: 22,
            justifyContent: 'center',
            width: 22,
        },
        labelRow: {
            alignItems: 'center',
            flexDirection: 'row',
            gap: 4,
            marginTop: 6,
        },
        slotLabel: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '500',
            textAlign: 'center',
        },
        slotLabelTaken: {
            color: theme.successEmeraldText,
            fontWeight: '700',
        },
        pressed: {
            opacity: 0.78,
        },
    });
