import { fireEvent, render } from '@testing-library/react-native/pure';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { PhotoAttachmentPicker } from '../components/attachments/PhotoAttachmentPicker';

jest.mock('expo-image-picker', () => ({
    requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    launchCameraAsync: jest.fn().mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///photo_1.jpg', fileName: 'photo_1.jpg', fileSize: 1024, base64: 'abc' }],
    }),
    launchImageLibraryAsync: jest.fn().mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///gallery_1.jpg', fileName: 'gallery_1.jpg', fileSize: 2048, base64: 'def' }],
    }),
}));

describe('PhotoAttachmentPicker', () => {
    it('renders attachment list, counter, and action buttons', async () => {
        const onAdd = jest.fn();
        const onRemove = jest.fn();

        const view = await render(
            <PhotoAttachmentPicker
                attachments={[
                    { uri: 'file:///existing_1.jpg', fileName: 'existing_1.jpg' },
                ]}
                maxCount={4}
                onAddAttachment={onAdd}
                onRemoveAttachment={onRemove}
                title="Defect Photo Evidence"
            />,
        );

        expect(view.getByText('Defect Photo Evidence')).toBeTruthy();
        expect(view.getByText('1 / 4')).toBeTruthy();
        expect(view.getByTestId('photo-attachment-picker-take-photo')).toBeTruthy();
        expect(view.getByTestId('photo-attachment-picker-choose-gallery')).toBeTruthy();

        // Remove existing photo
        fireEvent.press(view.getByTestId('photo-attachment-picker-remove-0'));
        expect(onRemove).toHaveBeenCalledWith(0);
    });

    it('triggers camera photo capture and callback', async () => {
        const onAdd = jest.fn();
        const onRemove = jest.fn();

        const view = await render(
            <PhotoAttachmentPicker
                attachments={[]}
                onAddAttachment={onAdd}
                onRemoveAttachment={onRemove}
            />,
        );

        await fireEvent.press(view.getByTestId('photo-attachment-picker-take-photo'));
        expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalled();
        expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({ uri: 'file:///photo_1.jpg' }),
        );
    });

    it('triggers gallery photo selection and callback', async () => {
        const onAdd = jest.fn();
        const onRemove = jest.fn();

        const view = await render(
            <PhotoAttachmentPicker
                attachments={[]}
                onAddAttachment={onAdd}
                onRemoveAttachment={onRemove}
            />,
        );

        await fireEvent.press(view.getByTestId('photo-attachment-picker-choose-gallery'));
        expect(ImagePicker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
        expect(onAdd).toHaveBeenCalledWith(
            expect.objectContaining({ uri: 'file:///gallery_1.jpg' }),
        );
    });
});
