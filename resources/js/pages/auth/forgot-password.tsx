import { Head, Link, useForm } from '@inertiajs/react';
import { AuthShell } from './auth-shell';

export default function ForgotPassword({ status }: { status?: string }) {
    const form = useForm({ email: '' });

    return (
        <AuthShell>
            <Head title="Reset password" />
            <h1 id="auth-title" className="text-2xl font-semibold text-ink">
                Reset your password
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
                Enter your company email and we’ll send a time-limited reset
                link.
            </p>
            {status && (
                <p
                    role="status"
                    className="mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-green-800"
                >
                    {status}
                </p>
            )}
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/forgot-password');
                }}
                className="mt-6 space-y-4"
            >
                <label className="block text-sm font-medium text-ink">
                    Email
                    <input
                        type="email"
                        value={form.data.email}
                        onChange={(e) => form.setData('email', e.target.value)}
                        autoComplete="email"
                        autoFocus
                        className="mt-1 h-11 w-full rounded-lg border border-line px-3"
                    />
                    {form.errors.email && (
                        <span className="mt-1 block text-sm text-red-700">
                            {form.errors.email}
                        </span>
                    )}
                </label>
                <button
                    disabled={form.processing}
                    className="h-11 w-full rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                    Send reset link
                </button>
            </form>
            <Link
                href="/login"
                className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-brand-strong"
            >
                Return to sign in
            </Link>
        </AuthShell>
    );
}
