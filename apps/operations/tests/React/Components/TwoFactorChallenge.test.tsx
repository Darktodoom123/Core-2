import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import TwoFactorChallenge from '@/pages/auth/two-factor-challenge';

describe('TwoFactorChallenge Page Component', () => {
    it('renders challenge prompt with masked email and submit button', () => {
        render(<TwoFactorChallenge email_obfuscated="ja**e@example.com" />);

        expect(screen.getByText('Security Verification')).toBeInTheDocument();
        expect(screen.getByText('Enter verification code')).toBeInTheDocument();
        expect(screen.getByText('ja**e@example.com')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Verify and sign in/i }),
        ).toBeInTheDocument();
    });

    it('displays status feedback and errors when provided', () => {
        render(
            <TwoFactorChallenge
                email_obfuscated="ja**e@example.com"
                status="A fresh code was sent."
                errors={{ code: 'The verification code is incorrect.' }}
            />,
        );

        expect(screen.getByText('A fresh code was sent.')).toBeInTheDocument();
        expect(
            screen.getByText('The verification code is incorrect.'),
        ).toBeInTheDocument();
    });
});
