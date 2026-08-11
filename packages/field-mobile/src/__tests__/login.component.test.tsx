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
        login: jest.fn().mockResolvedValue(undefined),
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
            backgroundColor: '#f4f6f8',
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
        expect(submit).toHaveStyle({ backgroundColor: '#e98a00' });

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
});
