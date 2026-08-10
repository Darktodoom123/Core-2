import { Head, Link, useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { AuthShell } from './auth-shell';

export default function Login({ status }: { status?: string }) {
    const form = useForm({ username: '', password: '' });
    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/login', { onFinish: () => form.reset('password') });
    };

    return (
        <AuthShell>
            <Head title="Sign in" />
            <h1
                id="auth-title"
                className="text-2xl font-semibold tracking-[-0.02em] text-ink"
            >
                Sign in to operations
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
                Use your company account. Access is limited to active internal
                personnel.
            </p>
            {status && (
                <p
                    role="status"
                    className="mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-green-800"
                >
                    {status}
                </p>
            )}
            <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-ink">
                    Username
                    <input
                        type="text"
                        value={form.data.username}
                        onChange={(e) =>
                            form.setData('username', e.target.value)
                        }
                        autoComplete="username"
                        autoFocus
                        className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink"
                    />
                    {form.errors.username && (
                        <span className="mt-1 block text-sm text-red-700">
                            {form.errors.username}
                        </span>
                    )}
                </label>
                <label className="block text-sm font-medium text-ink">
                    Password
                    <input
                        type="password"
                        value={form.data.password}
                        onChange={(e) =>
                            form.setData('password', e.target.value)
                        }
                        autoComplete="current-password"
                        className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink"
                    />
                    {form.errors.password && (
                        <span className="mt-1 block text-sm text-red-700">
                            {form.errors.password}
                        </span>
                    )}
                </label>
                <button
                    type="submit"
                    disabled={form.processing}
                    className="h-11 w-full rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                    {form.processing ? 'Signing in…' : 'Sign in'}
                </button>
            </form>
            <Link
                href="/forgot-password"
                className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-brand-strong"
            >
                Forgot password?
            </Link>
        </AuthShell>
    );
}
