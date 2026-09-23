import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui';
import { AuthShell } from './auth-shell';

interface TwoFactorChallengeProps {
    email_obfuscated: string;
    expires_in_seconds?: number;
    status?: string;
    errors?: Record<string, string>;
}

export default function TwoFactorChallenge({
    email_obfuscated,
    expires_in_seconds = 300,
    status,
    errors,
}: TwoFactorChallengeProps) {
    const form = useForm({ code: '', trust_device: false });
    const [cooldown, setCooldown] = useState(45);
    const [resending, setResending] = useState(false);

    useEffect(() => {
        if (cooldown <= 0) {
            return;
        }

        const timer = setInterval(() => {
            setCooldown((prev) => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [cooldown]);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        form.post('/login/challenge');
    };

    const handleResend = () => {
        if (cooldown > 0 || resending) {
            return;
        }

        setResending(true);
        router.post(
            '/login/challenge/resend',
            {},
            {
                onFinish: () => {
                    setResending(false);
                    setCooldown(45);
                },
            },
        );
    };

    return (
        <AuthShell>
            <Head title="Two-factor verification" />
            <div className="flex items-center gap-2 text-brand-strong">
                <ShieldCheck
                    className="h-6 w-6 text-brand-strong"
                    aria-hidden="true"
                />
                <span className="text-xs font-semibold tracking-wider text-brand-strong uppercase">
                    Security Verification
                </span>
            </div>
            <h1
                id="auth-title"
                className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-ink"
            >
                Enter verification code
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
                A 6-digit code has been sent to{' '}
                <strong className="font-semibold text-ink">
                    {email_obfuscated}
                </strong>
                . Enter the code below to complete web sign-in (valid for{' '}
                {Math.ceil(expires_in_seconds / 60)} minutes).
            </p>

            {status && (
                <p
                    role="status"
                    className="mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-green-800"
                >
                    {status}
                </p>
            )}

            {errors && Object.keys(errors).length > 0 && !form.errors.code && (
                <p
                    role="alert"
                    className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-strong"
                >
                    {Object.values(errors)[0]}
                </p>
            )}

            <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-ink">
                    6-digit code
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        autoComplete="one-time-code"
                        autoFocus
                        value={form.data.code}
                        onChange={(e) =>
                            form.setData(
                                'code',
                                e.target.value.replace(/\D/g, '').slice(0, 6),
                            )
                        }
                        placeholder="000000"
                        className="mt-1 h-12 w-full rounded-lg border border-line bg-surface px-3 text-center font-mono text-2xl font-bold tracking-[0.3em] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        aria-invalid={Boolean(form.errors.code)}
                    />
                    {form.errors.code && (
                        <span
                            className="mt-1 block text-sm text-red-700"
                            role="alert"
                        >
                            {form.errors.code}
                        </span>
                    )}
                </label>

                <div className="bg-surface-muted/40 flex items-start gap-3 rounded-lg border border-line p-3">
                    <input
                        type="checkbox"
                        id="trust_device"
                        checked={form.data.trust_device}
                        onChange={(e) =>
                            form.setData('trust_device', e.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 rounded border-line text-brand-strong focus-visible:outline-2 focus-visible:outline-brand"
                    />
                    <label
                        htmlFor="trust_device"
                        className="cursor-pointer text-sm font-medium text-ink"
                    >
                        <span>Trust this device for 30 days.</span>
                        <span className="block text-xs font-normal text-ink-soft">
                            Only on a device you control.
                        </span>
                    </label>
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    disabled={form.processing || form.data.code.length !== 6}
                    className="w-full"
                >
                    {form.processing ? (
                        <>
                            <Loader2
                                className="h-4 w-4 animate-spin"
                                aria-hidden="true"
                            />
                            Verifying…
                        </>
                    ) : (
                        'Verify and sign in'
                    )}
                </Button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-3 border-t border-line pt-4 text-sm text-ink-soft">
                <div className="flex items-center gap-1.5">
                    <span>Didn’t receive the code?</span>
                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={cooldown > 0 || resending}
                        className="font-medium text-brand-strong transition-colors hover:underline disabled:cursor-not-allowed disabled:text-ink-soft/60"
                    >
                        {cooldown > 0
                            ? `Resend in ${cooldown}s`
                            : resending
                              ? 'Sending…'
                              : 'Resend code'}
                    </button>
                </div>

                <Link
                    href="/login"
                    className="inline-flex items-center gap-1 text-xs text-ink-soft transition-colors hover:text-ink"
                >
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    Back to sign in
                </Link>
            </div>
        </AuthShell>
    );
}
