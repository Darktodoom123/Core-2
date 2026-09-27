import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert } from 'react-native';
import type { PhotoAttachment } from '../attachments/PhotoAttachmentPicker';
import type { WalkaroundAngle } from './DvirWalkaroundPhotos';

const generatePhotoName = (angle: string, source: 'camera' | 'gallery') => {
    const timestamp = Math.floor(Date.now());

    return source === 'camera'
        ? `${angle}_${timestamp}.jpg`
        : `${angle}_gallery_${timestamp}.jpg`;
};

/** Camera or library capture for DVIR photo slots, shared by every slot layout. */
export function usePhotoCapture(
    onCapturePhoto: (angle: WalkaroundAngle, photo: PhotoAttachment) => void,
) {
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

    const choosePhoto = (angle: WalkaroundAngle, label: string) => {
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

    return { loadingAngle, choosePhoto };
}
