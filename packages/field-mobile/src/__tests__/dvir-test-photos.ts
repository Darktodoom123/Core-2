import { fireEvent } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

type Pressable = { getByTestId: (id: string) => unknown };

const WALKAROUND_SLOTS = [
    'slot-driver-side',
    'slot-front',
    'slot-passenger-side',
    'slot-back',
];

/**
 * Takes the four walkaround photos a clean pre-trip needs. The camera is
 * stubbed: the source prompt picks "Take photo" and each shot returns a
 * small fake image.
 */
export async function takeWalkaroundPhotos(view: Pressable): Promise<void> {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
        buttons?.[0]?.onPress?.();
    });
    jest.spyOn(ImagePicker, 'requestCameraPermissionsAsync').mockResolvedValue({
        status: 'granted',
        canAskAgain: true,
        expires: 'never',
        granted: true,
    } as Awaited<ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>>);

    for (const slot of WALKAROUND_SLOTS) {
        jest.spyOn(ImagePicker, 'launchCameraAsync').mockResolvedValueOnce({
            canceled: false,
            assets: [
                {
                    uri: `file:///${slot}.jpg`,
                    fileName: `${slot}.jpg`,
                    fileSize: 1024,
                    base64: 'fake_base64_photo_data',
                    width: 800,
                    height: 600,
                },
            ],
        } as ImagePicker.ImagePickerResult);

        await fireEvent.press(view.getByTestId(slot) as never);
    }
}
