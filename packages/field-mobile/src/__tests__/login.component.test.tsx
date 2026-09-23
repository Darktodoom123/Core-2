import {
    cleanup,
    fireEvent,
    render,
    waitFor,
} from '@testing-library/react-native/pure';
import '@testing-library/react-native/matchers';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { LoginScreen } from '../auth/LoginScreen';

jest.mock('../auth/AuthContext', () => ({
    useAuth: jest.fn(),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function authValue(
    overrides: Partial<ReturnType<typeof useAuth>> = {},
): ReturnType<typeof useAuth> {
    return {
        user: null,
        status: 'unauthenticated',
        error: null,
        isInitializing: false,
        hasPendingRevocation: false,
        isChallenging: false,
        challengeData: null,
        isOffline: false,
        login: jest.fn().mockResolvedValue(undefined),
        verifyChallenge: jest.fn().mockResolvedValue(undefined),
        resendChallenge: jest.fn().mockResolvedValue(undefined),
        cancelChallenge: jest.fn(),
        logout: jest.fn().mockResolvedValue(true),
        bootstrap: jest.fn().mockResolvedValue(undefined),
        clearError: jest.fn(),
        apiClient: {} as ReturnType<typeof useAuth>['apiClient'],
        ...overrides,
    };
}

describe('LoginScreen', () => {
    afterEach(async () => {
        await cleanup();
        jest.clearAllMocks();
    });

    it('shows the field brand and security reassurance', async () => {
        mockedUseAuth.mockReturnValue(authValue());

        const view = await render(<LoginScreen />);

        const wordmark = view.getByText('Core 2 Field');
        expect(wordmark).toBeTruthy();
        expect(StyleSheet.flatten(wordmark.props.style)).toMatchObject({
            fontSize: 30,
            lineHeight: 38,
        });
        expect(view.getByText('Field operations')).toBeTruthy();
        expect(view.queryByText('Sign in to your account')).toBeNull();
        expect(
            view.queryByText(
                'Access assigned field jobs and equipment dispatches.',
            ),
        ).toBeNull();
        expect(view.getByText('Secure access')).toBeTruthy();
    });

    it('removes the card chrome on mobile widths', async () => {
        mockedUseAuth.mockReturnValue(authValue());

        const view = await render(<LoginScreen />);
        expect(view.getByTestId('login-safe-area').props.edges).toMatchObject({
            top: 'off',
            left: 'additive',
            right: 'additive',
            bottom: 'additive',
        });
        expect(
            view.getByTestId('login-screen').props
                .contentInsetAdjustmentBehavior,
        ).toBe('never');
        const cardStyle = StyleSheet.flatten(
            view.getByTestId('login-card').props.style,
        );

        expect(cardStyle).toMatchObject({
            backgroundColor: '#F1F5F9',
            borderRadius: 0,
            borderWidth: 0,
            overflow: 'visible',
        });
    });

    it('keeps sign-in disabled until both required fields are filled', async () => {
        mockedUseAuth.mockReturnValue(authValue());

        const view = await render(<LoginScreen />);
        const submit = view.getByTestId('login-submit-button');

        expect(submit).toBeDisabled();
        expect(submit).toHaveStyle({ backgroundColor: '#FFBF00' });

        await fireEvent.changeText(
            view.getByTestId('login-username-input'),
            'field.user',
        );
        expect(submit).toBeDisabled();

        await fireEvent.changeText(
            view.getByTestId('login-password-input'),
            'password',
        );

        await waitFor(() => expect(submit).not.toBeDisabled());
    });

    it('supports revealing the password without changing auth behavior', async () => {
        mockedUseAuth.mockReturnValue(authValue());

        const view = await render(<LoginScreen />);
        const passwordInput = view.getByTestId('login-password-input');

        expect(passwordInput.props.secureTextEntry).toBe(true);

        await fireEvent.press(view.getByTestId('password-visibility-button'));

        expect(passwordInput.props.secureTextEntry).toBe(false);
        expect(view.getByLabelText('Hide password')).toBeTruthy();
    });

    it('locks the form while login is pending and submits trimmed credentials', async () => {
        let resolveLogin: (() => void) | undefined;
        const login = jest.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveLogin = resolve;
                }),
        );
        mockedUseAuth.mockReturnValue(authValue({ login }));

        const view = await render(<LoginScreen />);
        await fireEvent.changeText(
            view.getByTestId('login-username-input'),
            '  field.user  ',
        );
        await fireEvent.changeText(
            view.getByTestId('login-password-input'),
            'password',
        );
        await fireEvent.press(view.getByTestId('login-submit-button'));

        await waitFor(() => {
            expect(login).toHaveBeenCalledWith('field.user', 'password');
            expect(view.getByTestId('login-submit-button')).toBeDisabled();
        });

        resolveLogin?.();
        await waitFor(() =>
            expect(view.getByTestId('login-submit-button')).not.toBeDisabled(),
        );
    });

    describe('Verification Challenge', () => {
        const challengeData = {
            requires_verification: true as const,
            challenge_id: 'ch-12345',
            email_obfuscated: 't***@example.com',
            expires_in_seconds: 300,
            cooldown_seconds: 45,
            message: 'A verification code has been sent.',
        };

        it('renders verification challenge screen when isChallenging is true', async () => {
            mockedUseAuth.mockReturnValue(
                authValue({
                    isChallenging: true,
                    challengeData,
                }),
            );

            const view = await render(<LoginScreen />);

            expect(view.getByText('Device Verification')).toBeTruthy();
            expect(view.getByText('t***@example.com')).toBeTruthy();
            expect(view.getByTestId('verification-code-input')).toBeTruthy();
            expect(
                view.getByText('Trust this device for 30 days.'),
            ).toBeTruthy();
            expect(
                view.getByText('Only on a device you control.'),
            ).toBeTruthy();

            const verifyBtn = view.getByTestId('verify-code-button');
            expect(verifyBtn).toBeDisabled();
        });

        it('allows toggling trust device checkbox and submitting code', async () => {
            const verifyChallenge = jest.fn().mockResolvedValue(undefined);
            mockedUseAuth.mockReturnValue(
                authValue({
                    isChallenging: true,
                    challengeData,
                    verifyChallenge,
                }),
            );

            const view = await render(<LoginScreen />);
            const checkbox = view.getByTestId('trust-device-checkbox');
            const codeInput = view.getByTestId('verification-code-input');
            const verifyBtn = view.getByTestId('verify-code-button');

            // Initially unchecked
            expect(checkbox.props.accessibilityState.checked).toBe(false);

            // Toggle checkbox
            await fireEvent.press(checkbox);
            expect(checkbox.props.accessibilityState.checked).toBe(true);

            // Enter 6-digit code
            await fireEvent.changeText(codeInput, '123456');
            expect(verifyBtn).not.toBeDisabled();

            // Submit
            await fireEvent.press(verifyBtn);
            await waitFor(() => {
                expect(verifyChallenge).toHaveBeenCalledWith('123456', true);
            });
        });

        it('handles resend and back to sign in actions', async () => {
            const resendChallenge = jest.fn().mockResolvedValue(undefined);
            const cancelChallenge = jest.fn();

            mockedUseAuth.mockReturnValue(
                authValue({
                    isChallenging: true,
                    challengeData: {
                        ...challengeData,
                        cooldown_seconds: 0,
                    },
                    resendChallenge,
                    cancelChallenge,
                }),
            );

            const view = await render(<LoginScreen />);
            const resendBtn = view.getByTestId('resend-code-button');
            const cancelBtn = view.getByTestId('cancel-challenge-button');

            // Resend button should be enabled when cooldown is 0
            expect(resendBtn).not.toBeDisabled();
            await fireEvent.press(resendBtn);
            expect(resendChallenge).toHaveBeenCalled();

            // Cancel button
            await fireEvent.press(cancelBtn);
            expect(cancelChallenge).toHaveBeenCalled();
        });
    });
});
