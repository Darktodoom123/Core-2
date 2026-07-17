import type { PropsWithChildren } from 'react';

export function AuthShell({ children }: PropsWithChildren) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
            <section
                className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 sm:p-8"
                aria-labelledby="auth-title"
            >
                <div className="mb-7 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white">
                        C2
                    </div>
                    <div>
                        <p className="font-semibold text-ink">
                            Core Transaction 2
                        </p>
                        <p className="text-sm text-ink-soft">
                            Secure operations access
                        </p>
                    </div>
                </div>
                {children}
            </section>
        </main>
    );
}
