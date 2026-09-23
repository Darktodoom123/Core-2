import {
    useSyncExternalStore,
    type CSSProperties,
    type PropsWithChildren,
} from 'react';
import { DevUserSwitcher } from '@/components/dev-user-switcher';

interface ZoomFrame {
    width: number;
    height: number;
    scale: number;
}

function subscribeToViewportResize(onChange: () => void) {
    window.addEventListener('resize', onChange);

    return () => window.removeEventListener('resize', onChange);
}

function getZoomSnapshot() {
    if (typeof window === 'undefined') {
        return 'normal';
    }

    const windowWidth = window.outerWidth;
    const scale = windowWidth / window.innerWidth;

    if (
        windowWidth < 1024 ||
        !Number.isFinite(scale) ||
        Math.abs(scale - 1) < 0.04
    ) {
        return 'normal';
    }

    const height = Math.round(window.innerHeight * scale);

    return `${windowWidth}:${height}:${scale}`;
}

function parseZoomFrame(snapshot: string): ZoomFrame | null {
    if (snapshot === 'normal') {
        return null;
    }

    const [width, height, scale] = snapshot.split(':').map(Number);

    return { width, height, scale };
}

export function AuthShell({ children }: PropsWithChildren) {
    const zoomFrame = parseZoomFrame(
        useSyncExternalStore(
            subscribeToViewportResize,
            getZoomSnapshot,
            () => 'normal',
        ),
    );

    const gridStyle: CSSProperties | undefined = zoomFrame
        ? {
              width: zoomFrame.width,
              height: zoomFrame.height,
              gridTemplateColumns: 'minmax(0, 7fr) minmax(22rem, 3fr)',
              flex: 'none',
          }
        : undefined;

    return (
        <main
            className={`min-h-screen bg-surface text-ink ${zoomFrame ? 'flex flex-col' : ''}`}
            style={
                zoomFrame
                    ? {
                          alignItems:
                              zoomFrame.scale < 1 ? 'center' : 'flex-start',
                          justifyContent:
                              zoomFrame.scale < 1 ? 'center' : 'flex-start',
                      }
                    : undefined
            }
        >
            <div
                className={`grid ${zoomFrame ? '' : 'min-h-screen lg:grid-cols-[minmax(0,7fr)_minmax(22rem,3fr)]'}`}
                style={gridStyle}
            >
                <section
                    className={`relative overflow-hidden bg-[#111214] ${zoomFrame ? 'min-h-0' : 'min-h-[18rem] sm:min-h-[26rem] lg:min-h-screen'}`}
                    aria-label="Core 2 operations platform"
                >
                    <img
                        src="/images/core2-auth-wide-backdrop.png"
                        alt=""
                        aria-hidden="true"
                        className={`absolute inset-0 h-full w-full object-cover ${zoomFrame ? 'object-center' : 'object-[center_20%] lg:object-[35%_center] xl:object-center'}`}
                    />
                </section>
                <section
                    className={`relative flex flex-col justify-center bg-surface px-6 py-12 sm:px-10 lg:px-14 xl:px-6 2xl:px-8 ${zoomFrame ? 'min-h-0' : 'min-h-[calc(100vh-18rem)] lg:min-h-screen'}`}
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
