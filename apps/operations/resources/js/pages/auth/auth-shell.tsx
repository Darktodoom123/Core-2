import type { PropsWithChildren } from 'react';
import { DevUserSwitcher } from '@/components/dev-user-switcher';

export function AuthShell({ children }: PropsWithChildren) {
    return (
        <main className="min-h-screen bg-surface text-ink">
            <div className="grid min-h-screen lg:grid-cols-2 xl:grid-cols-[3fr_2fr]">
                <section
                    className="relative min-h-[18rem] overflow-hidden bg-[#111214] lg:min-h-screen"
                    aria-label="Core 2 operations platform"
                >
                    <img
                        src="/images/core2-auth-left-panel.png"
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-cover object-top lg:object-left"
                    />
                </section>
                <section
                    className="relative flex min-h-[calc(100vh-18rem)] flex-col justify-center bg-surface px-6 py-12 sm:px-10 lg:min-h-screen lg:px-14 xl:px-20"
                    aria-labelledby="auth-title"
                >
                    <div className="mx-auto w-full max-w-[30rem] xl:translate-x-6">
                        <img
                            src="/images/alibaton-logo-black.png"
                            alt="Alibaton Construction Incorporated"
                            className="block h-auto w-[min(100%,22rem)]"
                        />
                        <div className="mt-10">{children}</div>
                    </div>
                </section>
            </div>
            <DevUserSwitcher />
        </main>
    );
}
