import React, { useState } from 'react';
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

/**
 * One optional photo from the seat: hour meter, warning lights, LMI. The
 * whole card is the button, with a visible "Add photo" call to action.
 */
export const DvirCabPhotoCard: React.FC<DvirCabPhotoCardProps> = ({
    photo,
    onCapturePhoto,
    onRemovePhoto,
}) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);
    const { loadingAngle, choosePhoto } = usePhotoCapture(onCapturePhoto);
    const [pressed, setPressed] = useState(false);
    const isLoading = loadingAngle === 'cab';

    return (
        <View style={styles.wrap}>
            <Pressable
                accessibilityHint="Opens the camera or photo library"
                accessibilityLabel={
                    photo
                        ? 'Retake cab / dashboard photo'
                        : 'Add cab / dashboard photo, optional'
                }
                accessibilityRole="button"
                accessibilityState={{ busy: isLoading }}
                android_ripple={{ color: theme.border }}
                disabled={isLoading}
                onPress={() => choosePhoto('cab', 'Cab / dashboard')}
                onPressIn={() => setPressed(true)}
                onPressOut={() => setPressed(false)}
                style={[
                    styles.card,
                    photo ? styles.cardCaptured : null,
                    pressed ? styles.cardPressed : null,
                ]}
                testID="dvir-cab-photo"
            >
                <View style={[styles.well, photo ? styles.wellPhoto : null]}>
                    {isLoading ? (
                        <ActivityIndicator color={theme.textSecondary} />
                    ) : photo ? (
                        <Image
                            accessibilityLabel="Cab photo thumbnail"
                            source={{ uri: photo.uri }}
                            style={styles.thumbnail}
                        />
                    ) : (
                        <Icon
                            color={theme.textPrimary}
                            name="camera"
                            size={24}
                        />
                    )}
                </View>

                <View style={styles.text}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>Cab / dashboard</Text>
                        {photo ? (
                            <Icon
                                color={theme.successEmeraldText}
                                name="check-circle"
                                size={16}
                            />
                        ) : (
                            <View style={styles.optionalPill}>
                                <Text style={styles.optionalText}>
                                    Optional
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.hint}>
                        Hour meter, warning lights and load moment indicator.
                    </Text>
                </View>

                <View style={styles.cta}>
                    <Icon color={theme.textPrimary} name="camera" size={16} />
                    <Text style={styles.ctaText}>
                        {photo ? 'Retake' : 'Add photo'}
                    </Text>
                </View>
            </Pressable>

            {photo ? (
                <Pressable
                    accessibilityLabel="Remove cab photo"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => onRemovePhoto('cab')}
                    style={styles.remove}
                    testID="remove-cab"
                >
                    <Icon color={theme.textSecondary} name="close" size={14} />
                    <Text style={styles.removeText}>Remove photo</Text>
                </Pressable>
            ) : null}
        </View>
    );
};

const createStyles = (theme: ThemeColors) =>
    StyleSheet.create({
        wrap: {
            marginBottom: 18,
        },
        card: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 14,
            borderWidth: 1.5,
            flexDirection: 'row',
            gap: 12,
            minHeight: 80,
            overflow: 'hidden',
            paddingHorizontal: 12,
            paddingVertical: 12,
        },
        cardCaptured: {
            borderColor: theme.successEmerald,
        },
        cardPressed: {
            backgroundColor: theme.surfaceHighlight,
        },
        well: {
            alignItems: 'center',
            backgroundColor: theme.surfaceHighlight,
            borderRadius: 12,
            height: 56,
            justifyContent: 'center',
            overflow: 'hidden',
            width: 56,
        },
        wellPhoto: {
            backgroundColor: theme.surface,
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
            gap: 6,
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
        // Visible secondary call to action: outlined, never gold.
        cta: {
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
            borderRadius: 10,
            borderWidth: 1,
            flexDirection: 'row',
            gap: 6,
            minHeight: 40,
            paddingHorizontal: 10,
        },
        ctaText: {
            color: theme.textPrimary,
            fontSize: 14,
            fontWeight: '700',
        },
        remove: {
            alignItems: 'center',
            alignSelf: 'flex-end',
            flexDirection: 'row',
            gap: 6,
            minHeight: 48,
            paddingHorizontal: 4,
        },
        removeText: {
            color: theme.textSecondary,
            fontSize: 14,
            fontWeight: '700',
        },
    });
