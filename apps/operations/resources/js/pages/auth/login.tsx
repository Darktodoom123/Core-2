import { Head, Link, useForm } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { AuthShell } from './auth-shell';

export default function Login({ status }: { status?: string }) {
    const form = useForm({ username: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.post('/login', { onFinish: () => form.reset('password') });
    };

    return (
        <AuthShell>
            <Head title="Sign in" />
            <h1
                id="auth-title"
                className="text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-ink sm:text-[3.25rem] xl:text-4xl 2xl:text-5xl"
            >
                Welcome back.
            </h1>
            <p className="mt-2 text-[1.625rem] leading-8 font-medium tracking-[-0.02em] text-ink-soft">
                Sign in to Core 2
            </p>
            {status && (
                <p
                    role="status"
                    className="mt-6 rounded-lg bg-success-soft px-3 py-2 text-sm text-green-800"
                >
                    {status}
                </p>
            )}
            <form onSubmit={submit} className="mt-9">
                <div className="space-y-2">
                    <label
                        htmlFor="username"
                        className="block text-base font-semibold text-ink"
                    >
                        Username
                    </label>
                    <input
                        id="username"
                        type="text"
                        required
                        value={form.data.username}
                        onChange={(e) =>
                            form.setData('username', e.target.value)
                        }
                        autoComplete="username"
                        autoFocus
                        placeholder="dispatch.admin"
                        aria-invalid={Boolean(form.errors.username)}
                        aria-describedby={
                            form.errors.username ? 'username-error' : undefined
                        }
                        className="h-14 w-full rounded-lg border border-line-strong bg-surface px-4 !text-lg text-ink placeholder:text-muted focus:border-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    />
                    {form.errors.username && (
                        <span
                            id="username-error"
                            className="block text-sm text-red-700"
                            role="alert"
                        >
                            {form.errors.username}
                        </span>
                    )}
                </div>
                <div className="mt-5 space-y-2">
                    <label
                        htmlFor="password"
                        className="block text-base font-semibold text-ink"
                    >
                        Password
                    </label>
                    <div className="relative">
                        <input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            value={form.data.password}
                            onChange={(e) =>
                                form.setData('password', e.target.value)
                            }
                            autoComplete="current-password"
                            aria-invalid={Boolean(form.errors.password)}
                            aria-describedby={
                                form.errors.password
                                    ? 'password-error'
                                    : undefined
                            }
                            className="h-14 w-full rounded-lg border border-line-strong bg-surface px-4 pr-14 !text-lg text-ink placeholder:text-muted focus:border-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        />
                        <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex w-14 items-center justify-center text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-brand"
                            onClick={() =>
                                setShowPassword((visible) => !visible)
                            }
                            aria-label={
                                showPassword ? 'Hide password' : 'Show password'
                            }
                            aria-pressed={showPassword}
                        >
                            {showPassword ? (
                                <EyeOff
                                    className="h-5 w-5"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Eye className="h-5 w-5" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                    {form.errors.password && (
                        <span
                            id="password-error"
                            className="block text-sm text-red-700"
                            role="alert"
                        >
                            {form.errors.password}
                        </span>
                    )}
                </div>
                <div className="flex justify-end">
                    <Link
                        href="/forgot-password"
                        className="inline-flex min-h-11 items-center text-base font-semibold text-accent-strong underline decoration-transparent underline-offset-4 transition-colors hover:text-accent hover:decoration-current"
                    >
                        Forgot password?
                    </Link>
                </div>
                <button
                    type="submit"
                    disabled={form.processing}
                    aria-busy={form.processing}
                    className="mt-3 h-14 w-full rounded-lg bg-brand px-4 !text-lg !font-bold text-brand-contrast transition-colors hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-60"
                >
                    {form.processing ? 'Signing in…' : 'Sign in'}
                </button>
            </form>
        </AuthShell>
    );
}
