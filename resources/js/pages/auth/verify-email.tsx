import { Head, router, useForm } from '@inertiajs/react';
import { AuthShell } from './auth-shell';

export default function VerifyEmail({ status }: { status?: string }) {
    const form = useForm({});

    return (
        <AuthShell>
            <Head title="Verify email" />
            <h1 id="auth-title" className="text-2xl font-semibold text-ink">
                Verify your email
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
                Open the verification link sent to your company email before
                entering operational data.
            </p>
            {status === 'verification-link-sent' && (
                <p
                    role="status"
                    className="mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-green-800"
                >
                    A new verification link was sent.
                </p>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button
                    onClick={() =>
                        form.post('/email/verification-notification')
                    }
                    disabled={form.processing}
                    className="min-h-11 flex-1 rounded-lg bg-brand px-4 text-sm font-semibold text-ink disabled:opacity-60"
                >
                    Resend verification
                </button>
                <button
                    onClick={() => router.post('/logout')}
                    className="min-h-11 flex-1 rounded-lg border border-line px-4 text-sm font-semibold text-ink"
                >
                    Sign out
                </button>
            </div>
        </AuthShell>
    );
}
