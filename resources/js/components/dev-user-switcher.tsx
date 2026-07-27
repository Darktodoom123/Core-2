import { router, usePage } from '@inertiajs/react';
import { AlertTriangle, LoaderCircle, LogIn, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';

interface DevUser {
    id: number;
    name: string;
    email: string;
    role_label: string | null;
}

export function DevUserSwitcher() {
    const { is_local_env } = usePage().props;
    const [isOpen, setIsOpen] = useState(false);
    const [users, setUsers] = useState<DevUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [switchingUserId, setSwitchingUserId] = useState<number | null>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        if (!is_local_env || !isOpen || hasLoaded) {
            return;
        }

        const controller = new AbortController();

        fetch('/dev/users', {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Unable to load development accounts.');
                }

                return response.json() as Promise<DevUser[]>;
            })
            .then((data) => {
                setUsers(data);
                setHasLoaded(true);
                setIsLoading(false);
            })
            .catch((fetchError: unknown) => {
                if (
                    fetchError instanceof DOMException &&
                    fetchError.name === 'AbortError'
                ) {
                    return;
                }

                setError('Unable to load development accounts. Try again.');
                setIsLoading(false);
            });

        return () => controller.abort();
    }, [hasLoaded, isOpen, is_local_env]);

    if (!is_local_env) {
        return null;
    }

    const retry = () => {
        setError(null);
        setHasLoaded(false);
        setIsLoading(true);
    };

    return (
        <div className="fixed right-4 bottom-4 z-50">
            {isOpen && (
                <div
                    id="dev-user-switcher-panel"
                    role="region"
                    aria-label="Development quick login"
                    className="mb-2 w-72 rounded-xl border border-line bg-surface p-3 shadow-xl"
                >
                    <div className="mb-3 border-b border-line px-1 pb-3">
                        <p className="text-sm font-semibold text-ink">
                            Development quick login
                        </p>
                        <p className="mt-1 text-xs leading-5 text-ink-soft">
                            Choose a seeded account to inspect its role access.
                        </p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {isLoading && (
                            <div
                                className="flex items-center gap-2 px-2 py-3 text-sm text-ink-soft"
                                role="status"
                            >
                                <LoaderCircle
                                    className="h-4 w-4 animate-spin"
                                    aria-hidden="true"
                                />
                                Loading accounts...
                            </div>
                        )}
                        {error && (
                            <div
                                className="px-2 py-2 text-sm text-danger"
                                role="alert"
                            >
                                <div className="flex items-start gap-2">
                                    <AlertTriangle
                                        className="mt-0.5 h-4 w-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <span>{error}</span>
                                </div>
                                <Button
                                    size="sm"
                                    variant="quiet"
                                    className="mt-2 px-0 text-danger hover:bg-transparent hover:text-danger"
                                    onClick={retry}
                                >
                                    Try again
                                </Button>
                            </div>
                        )}
                        {!isLoading && !error && users.length === 0 && (
                            <div
                                className="px-2 py-3 text-sm text-ink-soft"
                                role="status"
                            >
                                No active seeded accounts found.
                            </div>
                        )}
                        {!isLoading &&
                            !error &&
                            users.map((user) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    disabled={switchingUserId !== null}
                                    onClick={() => {
                                        setSwitchingUserId(user.id);
                                        router.post(
                                            `/dev/login/${user.id}`,
                                            {},
                                            {
                                                onFinish: () =>
                                                    setSwitchingUserId(null),
                                            },
                                        );
                                    }}
                                    className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-subtle focus:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-wait disabled:opacity-60"
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
                                        {user.name
                                            .split(/\s+/)
                                            .map((part) => part.charAt(0))
                                            .join('')
                                            .slice(0, 2)
                                            .toUpperCase()}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-ink">
                                            {user.name}
                                        </span>
                                        <span className="block truncate text-xs text-ink-soft">
                                            {user.role_label ?? 'No role'} ·{' '}
                                            {user.email}
                                        </span>
                                    </span>
                                    {switchingUserId === user.id ? (
                                        <LoaderCircle
                                            className="h-4 w-4 shrink-0 animate-spin text-ink-soft"
                                            aria-label="Switching account"
                                        />
                                    ) : (
                                        <LogIn
                                            className="h-4 w-4 shrink-0 text-ink-soft"
                                            aria-hidden="true"
                                        />
                                    )}
                                </button>
                            ))}
                    </div>
                </div>
            )}
            <Button
                size="icon"
                aria-expanded={isOpen}
                aria-controls="dev-user-switcher-panel"
                aria-label={isOpen ? 'Close quick login' : 'Open quick login'}
                onClick={() => {
                    const nextIsOpen = !isOpen;

                    setIsOpen(nextIsOpen);
                    setIsLoading(nextIsOpen && !hasLoaded);

                    if (nextIsOpen) {
                        setError(null);
                    }
                }}
                className="h-12 w-12 rounded-full shadow-lg"
                title="Switch user in local development"
            >
                <Users className="h-5 w-5" aria-hidden="true" />
            </Button>
        </div>
    );
}
