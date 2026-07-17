import { Head, useForm } from '@inertiajs/react';
import { AuthShell } from './auth-shell';

export default function ResetPassword({
    email,
    token,
}: {
    email: string;
    token: string;
}) {
    const form = useForm({
        email,
        token,
        password: '',
        password_confirmation: '',
    });

    return (
        <AuthShell>
            <Head title="Choose password" />
            <h1 id="auth-title" className="text-2xl font-semibold text-ink">
                Choose a new password
            </h1>
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    form.post('/reset-password', {
                        onFinish: () =>
                            form.reset('password', 'password_confirmation'),
                    });
                }}
                className="mt-6 space-y-4"
            >
                <label className="block text-sm font-medium text-ink">
                    Email
                    <input
                        readOnly
                        value={form.data.email}
                        className="mt-1 h-11 w-full rounded-lg border border-line bg-surface-subtle px-3"
                    />
                </label>
                <label className="block text-sm font-medium text-ink">
                    New password
                    <input
                        type="password"
                        value={form.data.password}
                        onChange={(e) =>
                            form.setData('password', e.target.value)
                        }
                        autoComplete="new-password"
                        className="mt-1 h-11 w-full rounded-lg border border-line px-3"
                    />
                    {form.errors.password && (
                        <span className="mt-1 block text-sm text-red-700">
                            {form.errors.password}
                        </span>
                    )}
                </label>
                <label className="block text-sm font-medium text-ink">
                    Confirm password
                    <input
                        type="password"
                        value={form.data.password_confirmation}
                        onChange={(e) =>
                            form.setData(
                                'password_confirmation',
                                e.target.value,
                            )
                        }
                        autoComplete="new-password"
                        className="mt-1 h-11 w-full rounded-lg border border-line px-3"
                    />
                </label>
                <button
                    disabled={form.processing}
                    className="h-11 w-full rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
                >
                    Update password
                </button>
            </form>
        </AuthShell>
    );
}
