import type { PropsWithChildren } from 'react';
import { DevUserSwitcher } from '@/components/dev-user-switcher';

export function AuthShell({ children }: PropsWithChildren) {
    return (
        <main className="min-h-screen bg-surface text-ink">
            <div className="grid min-h-screen lg:grid-cols-[minmax(0,7fr)_minmax(22rem,3fr)]">
                <section
                    className="relative min-h-[18rem] overflow-hidden bg-[#111214] sm:min-h-[26rem] lg:min-h-screen"
                    aria-label="Core 2 operations platform"
                >
                    <img
                        src="/images/core2-auth-wide-backdrop.png"
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-cover object-[center_20%] lg:object-[35%_center] xl:object-center"
                    />
                </section>
                <section
                    className="relative flex min-h-[calc(100vh-18rem)] flex-col justify-center bg-surface px-6 py-12 sm:px-10 lg:min-h-screen lg:px-14 xl:px-6 2xl:px-8"
                    aria-labelledby="auth-title"
                >
                    <div className="mx-auto w-full max-w-[30rem]">
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
