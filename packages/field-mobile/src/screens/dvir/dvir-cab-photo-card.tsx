import React from 'react';
import {
    ActivityIndicator,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import type { PhotoAttachment } from '../../components/attachments/PhotoAttachmentPicker';
import { Icon } from '../../components/common/Icon';
import type { WalkaroundAngle } from '../../components/inspection';
import { usePhotoCapture } from '../../components/inspection/use-photo-capture';
import { useTheme, useThemedStyles } from '../../theme';
import type { ThemeColors } from '../../theme';

export interface DvirCabPhotoCardProps {
    photo?: PhotoAttachment;
    onCapturePhoto: (angle: WalkaroundAngle, photo: PhotoAttachment) => void;
    onRemovePhoto: (angle: WalkaroundAngle) => void;
}

/** One optional photo from the seat: hour meter, warning lights, LMI. */
export const DvirCabPhotoCard: React.FC<DvirCabPhotoCardProps> = ({
    photo,
    onCapturePhoto,
    onRemovePhoto,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const { loadingAngle, choosePhoto } = usePhotoCapture(onCapturePhoto);
    const isLoading = loadingAngle === 'cab';

    return (
        <View style={styles.card} testID="dvir-cab-photo">
            <Pressable
                accessibilityHint="Opens the camera or photo library"
                accessibilityLabel={
                    photo ? 'Retake cab photo' : 'Add cab / dashboard photo'
                }
                accessibilityRole="button"
                android_ripple={{ color: theme.border, borderless: false }}
                disabled={isLoading}
                onPress={() => choosePhoto('cab', 'Cab / dashboard')}
                style={[styles.slot, photo ? styles.slotCaptured : null]}
                testID="slot-cab"
            >
                {isLoading ? (
                    <ActivityIndicator color={theme.textSecondary} />
                ) : photo ? (
                    <Image
                        accessibilityLabel="Cab photo thumbnail"
                        source={{ uri: photo.uri }}
                        style={styles.thumbnail}
                    />
                ) : (
                    <Icon color={theme.textSecondary} name="camera" size={26} />
                )}
            </Pressable>

            <View style={styles.text}>
                <View style={styles.titleRow}>
                    <Text style={styles.title}>Cab / dashboard</Text>
                    <View style={styles.optionalPill}>
                        <Text style={styles.optionalText}>Optional</Text>
                    </View>
                </View>
                <Text style={styles.hint}>
                    Hour meter, warning lights and load moment indicator.
                </Text>
                {photo ? (
                    <Pressable
                        accessibilityLabel="Remove cab photo"
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => onRemovePhoto('cab')}
                        style={styles.remove}
                        testID="remove-cab"
                    >
                        <Icon
                            color={theme.textPrimary}
                            name="close"
                            size={14}
                        />
                        <Text style={styles.removeText}>Remove photo</Text>
                    </Pressable>
                ) : null}
            </View>
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        card: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderRadius: 14,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 14,
            marginBottom: 18,
            padding: 12,
        },
        slot: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderColor: theme.borderStrong,
            borderRadius: 12,
            borderStyle: 'dashed',
            borderWidth: 1.5,
            height: 72,
            justifyContent: 'center',
            overflow: 'hidden',
            width: 72,
        },
        slotCaptured: {
            borderColor: theme.successEmerald,
            borderStyle: 'solid',
        },
        thumbnail: {
            height: '100%',
            width: '100%',
        },
        text: {
            flex: 1,
            gap: 4,
        },
        titleRow: {
            alignItems: 'center',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        title: {
            color: theme.textPrimary,
            fontSize: 16,
            fontWeight: '700',
        },
        optionalPill: {
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 999,
            paddingHorizontal: 8,
            paddingVertical: 2,
        },
        optionalText: {
            color: theme.textSecondary,
            fontSize: 12,
            fontWeight: '700',
        },
        hint: {
            color: theme.textSecondary,
            fontSize: 13,
            lineHeight: 18,
        },
        remove: {
            alignItems: 'center',
            alignSelf: 'flex-start',
            flexDirection: 'row',
            gap: 6,
            minHeight: 48,
        },
        removeText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
    });
