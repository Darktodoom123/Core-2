import { fireEvent, render } from '@testing-library/react-native/pure';
import React from 'react';
import { DigitalSignatureModal } from '../components/signature/DigitalSignatureModal';

describe('DigitalSignatureModal', () => {
    it('renders modal form inputs, canvas area, and close trigger', async () => {
        const onClose = jest.fn();
        const onConfirm = jest.fn();

        const view = await render(
            <DigitalSignatureModal
                clientName="Acme Industrial Corp"
                jobReference="JOB-2026-8812"
                onClose={onClose}
                onConfirmSignature={onConfirm}
                visible={true}
            />,
        );

        expect(view.getByText('Client Sign-Off & Job Completion')).toBeTruthy();
        expect(
            view.getByText(/Job Ref: JOB-2026-8812 · Acme Industrial Corp/),
        ).toBeTruthy();
        expect(view.getByTestId('digital-signature-modal-name-input')).toBeTruthy();
        expect(view.getByTestId('digital-signature-modal-role-input')).toBeTruthy();
        expect(view.getByTestId('digital-signature-modal-canvas')).toBeTruthy();

        // Close modal
        fireEvent.press(view.getByTestId('digital-signature-modal-close'));
        expect(onClose).toHaveBeenCalled();
    });

    it('requires signer name and drawing strokes before enabling submission', async () => {
        const onClose = jest.fn();
        const onConfirm = jest.fn();

        const view = await render(
            <DigitalSignatureModal
                clientName="Acme Industrial Corp"
                jobReference="JOB-2026-8812"
                onClose={onClose}
                onConfirmSignature={onConfirm}
                visible={true}
            />,
        );

        const submitBtn = view.getByTestId('digital-signature-modal-submit');
        expect(submitBtn.props.accessibilityState.disabled).toBe(true);

        // Fill in signer name
        fireEvent.changeText(
            view.getByTestId('digital-signature-modal-name-input'),
            'Johnathan Doe',
        );

        // Submit remains disabled until canvas has signature strokes
        fireEvent.press(submitBtn);
        expect(onConfirm).not.toHaveBeenCalled();
    });
});
